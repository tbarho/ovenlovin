/* eslint-disable no-undef */
import { z } from "zod";
import type { RecipeSourceType } from "@ovenlovin/core";

/**
 * Confidence score for parsed fields (0-1)
 * - 1.0: Extracted from structured data (JSON-LD, schema.org)
 * - 0.8-0.9: High-confidence LLM extraction
 * - 0.6-0.7: Medium confidence (ambiguous units, missing data)
 * - 0.4-0.5: Low confidence (handwritten, poor OCR)
 * - < 0.4: Needs review
 */
export type ConfidenceScore = number;

/**
 * Confidence threshold for triggering review
 */
export const CONFIDENCE_THRESHOLD_REVIEW = 0.6;

/**
 * Raw extraction result from source-specific parser
 */
export interface RawExtraction {
  sourceType: RecipeSourceType;
  sourceUrl?: string;
  sourceBlobs?: string[];
  pageImages?: string[];
  author?: string;
  attribution?: string;
  rawData: Record<string, unknown>;
  extractedAt: Date;
  extractorVersion: string;
  modelUsed?: string;
}

/**
 * Structured recipe ingredient with confidence
 */
export interface ParsedIngredient {
  rawText: string;
  quantity?: { min: number; max?: number };
  unit?: string;
  originalUnit?: string;
  ingredient?: string;
  preparation?: string;
  isOptional?: boolean;
  substitutionNotes?: string;
  confidence: ConfidenceScore;
  confidenceReasons?: string[];
}

/**
 * Structured recipe step with confidence
 */
export interface ParsedStep {
  text: string;
  order: number;
  timers?: Array<{ duration: number; label?: string }>;
  confidence: ConfidenceScore;
  confidenceReasons?: string[];
}

/**
 * Recipe draft ready for storage
 */
export interface RecipeDraft {
  title: string;
  description?: string;
  yieldQuantity?: number;
  yieldUnit?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  activeTimeMinutes?: number;
  methodTags?: string[];
  cuisine?: string;
  course?: string;
  difficulty?: string;
  equipment?: string[];
  images?: string[];
  notes?: string;
  nutrition?: {
    perServing: boolean;
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };

  ingredients: ParsedIngredient[];
  steps: ParsedStep[];

  source: {
    type: RecipeSourceType;
    url?: string;
    canonicalUrl?: string;
    author?: string;
    attribution?: string;
    blobRefs?: string[];
    importerName: string;
    importerVersion: string;
    modelUsed?: string;
    rawExtractionJson: Record<string, unknown>;
    licenseNote?: string;
  };

  overallConfidence: ConfidenceScore;
  needsReview: boolean;
  reviewReasons: string[];
  /** Named fields a reviewer should check after a low-confidence extract. */
  uncertainFields?: string[];
  /** Allergen catalog hits for extracted ingredient lines (not per-person rules). */
  allergenClassifications?: DraftAllergenHit[];
}

export type DraftAllergenHit = {
  ingredientText: string;
  allergenCode: string;
  allergenName: string;
  relation: string;
};

/**
 * Common interface for all importers
 */
export interface Importer<TInput> {
  name: string;
  version: string;
  sourceType: RecipeSourceType;

  canHandle(input: TInput): boolean;
  extract(input: TInput): Promise<RawExtraction>;
  toDraft(raw: RawExtraction): Promise<RecipeDraft>;
}

/**
 * Base input types for importers
 */
export interface UrlImportInput {
  url: string;
}

export interface PasteImportInput {
  text: string;
  url?: string;
  author?: string;
}

export interface PhotoImportInput {
  images: Array<{ blob: string; filename?: string }>;
  isHandwritten?: boolean;
}

/**
 * Importer configuration
 */
export interface ImporterConfig {
  modelId?: string;
  visionModelId?: string;
  confidenceThreshold?: number;
  abortSignal?: AbortSignal;
}

/**
 * Zod schema for importer config
 */
export const importerConfigSchema = z.object({
  modelId: z.string().optional(),
  visionModelId: z.string().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
});
