/**
 * Schema.org / JS `String(2/3)` noise as stored on imported recipe lines.
 * Display formatters must turn these into cooking fractions without rewriting storage.
 */
export const DECIMAL_TWO_THIRDS_CELERY = {
  rawText: "0.6666666667 cup celery",
  quantityMin: 2 / 3,
  unit: "cup",
} as const;

export const DECIMAL_TWO_THIRDS_CARROT = {
  rawText: "0.6666666667 cup carrot",
  quantityMin: 2 / 3,
  unit: "cup",
} as const;
