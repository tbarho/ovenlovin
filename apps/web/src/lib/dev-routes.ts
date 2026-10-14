import { isVercelProductionBuild, type EnvLike } from "./e2e-auth";

/** UX prototypes and fixture previews — never on the production host. */
export function isDevPreviewPath(pathname: string): boolean {
  return (
    pathname === "/prototype" ||
    pathname.startsWith("/prototype/") ||
    pathname === "/dev/people-preview" ||
    pathname.startsWith("/dev/people-preview/")
  );
}

export function isDevPreviewAllowed(env: EnvLike = process.env): boolean {
  return !isVercelProductionBuild(env);
}
