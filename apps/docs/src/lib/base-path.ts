/** Matches `basePath` in next.config.mjs for static GitHub Pages. */
export const BASE_PATH = "/ovenlovin";

export function withBasePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}
