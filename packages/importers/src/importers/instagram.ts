import {
  canonicalInstagramPermalink,
  draftFromInstagramCaption,
  instagramFailurePresentation,
  type InstagramPostKind,
  type InstagramReadFailureCode,
  type RecipeImportDraft,
} from "@ovenlovin/core";

export type InstagramRead =
  | {
      ok: true;
      caption: string;
      handle?: string;
      permalink: string;
      kind: InstagramPostKind;
      coverUrl?: string;
      coverStorable: boolean;
    }
  | {
      ok: false;
      code: InstagramReadFailureCode;
      handle?: string;
      permalink?: string;
      kind?: InstagramPostKind;
    };

export interface InstagramAdapter {
  readInstagramPost(url: string): Promise<InstagramRead>;
}

/**
 * Ships with no Meta credential. Every link read is unavailable, so the
 * cook pastes the caption. A later adapter can replace this without UI changes.
 */
export const pasteOnlyAdapter: InstagramAdapter = {
  async readInstagramPost(url: string): Promise<InstagramRead> {
    const parsed = canonicalInstagramPermalink(url);
    return {
      ok: false,
      code: "unavailable",
      permalink: parsed?.permalink,
      kind: parsed?.kind,
    };
  },
};

export async function readInstagramPost(
  url: string,
  adapter: InstagramAdapter = pasteOnlyAdapter
): Promise<InstagramRead> {
  return adapter.readInstagramPost(url);
}

export async function draftFromInstagramRead(
  read: Extract<InstagramRead, { ok: true }>
): Promise<RecipeImportDraft> {
  return draftFromInstagramCaption({
    caption: read.caption,
    permalink: read.permalink,
    handle: read.handle,
    kind: read.kind,
    coverUrl: read.coverUrl,
    coverStorable: read.coverStorable,
  });
}

export function instagramReadError(read: Extract<InstagramRead, { ok: false }>) {
  return instagramFailurePresentation({
    code: read.code,
    handle: read.handle,
    kind: read.kind,
    permalink: read.permalink,
  });
}

/**
 * Instagram link reads and caption pastes. Returns null so a normal URL or
 * recipe-text paste keeps the existing importer.
 */
export async function instagramImportDraft(input: {
  source: "url" | "paste";
  content: string;
  sourceUrl?: string;
  creator?: string;
  adapter?: InstagramAdapter;
}): Promise<RecipeImportDraft | null> {
  if (input.source === "url") {
    if (!canonicalInstagramPermalink(input.content)) return null;
    const read = await readInstagramPost(input.content, input.adapter);
    if (!read.ok) throw instagramReadError(read);
    return draftFromInstagramRead(read);
  }
  const permalink = input.sourceUrl ? canonicalInstagramPermalink(input.sourceUrl) : null;
  if (!permalink && !input.creator?.trim()) return null;
  if (input.sourceUrl && !permalink) return null;
  return draftFromInstagramCaption({
    caption: input.content,
    permalink: permalink?.permalink,
    handle: input.creator,
    kind: permalink?.kind,
  });
}
