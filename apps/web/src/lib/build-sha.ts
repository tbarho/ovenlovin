export function shortBuildSha(env: NodeJS.ProcessEnv = process.env): string | null {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return sha ? sha.slice(0, 7) : null;
}
