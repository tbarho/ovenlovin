import type { EnvLike } from "./ai-gateway";

export type DeployEnvironment = "production" | "preview" | "development" | "local";

/** Slug-agnostic Vercel home. Used when the team/project slugs are unknown. */
export const VERCEL_DASHBOARD_URL = "https://vercel.com/dashboard";

export type VercelDashboardScope = {
  teamSlug: string;
  projectSlug: string;
};

export type VercelScopeCache = Map<string, Promise<VercelDashboardScope | null>>;

/* eslint-disable no-unused-vars -- call-signature parameter names */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
/* eslint-enable no-unused-vars */

export type ResolveVercelScopeOptions = {
  fetch?: FetchLike;
  cache?: VercelScopeCache;
};

export type DescribeDeployOptions = {
  origin?: string;
  /**
   * Pre-resolved Vercel dashboard scope. Pass `null` after a failed lookup so
   * we fall back to the dashboard instead of re-reading env overrides.
   * Omit to read `OVENLOVIN_VERCEL_*` overrides synchronously.
   */
  vercelScope?: VercelDashboardScope | null;
};

export type DeployInfo = {
  live: boolean;
  environment: DeployEnvironment;
  environmentLabel: string;
  headline: string;
  instanceUrl: string;
  instanceHost: string;
  deployedAt: string | null;
  vercel: {
    projectUrl: string | null;
    deploymentUrl: string | null;
  };
  github: {
    repoUrl: string | null;
    commitUrl: string | null;
    owner: string | null;
    slug: string | null;
    commitSha: string | null;
    commitShort: string | null;
    commitRef: string | null;
    commitMessage: string | null;
  };
};

export type DeployedAtDisplay = {
  iso: string;
  absolute: string;
  relative: string;
};

const ENV_LABEL: Record<DeployEnvironment, string> = {
  production: "Production",
  preview: "Preview",
  development: "Development",
  local: "Local",
};

export function hostFromOrigin(origin: string): string {
  return origin.replace(/^https?:\/\//, "").replace(/\/$/, "") || origin;
}

function httpsUrl(hostOrUrl?: string | null): string | null {
  const value = hostOrUrl?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, "");
  return `https://${value.replace(/\/$/, "")}`;
}

function resolveEnvironment(env: EnvLike): DeployEnvironment {
  if (
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview" ||
    env.VERCEL_ENV === "development"
  ) {
    return env.VERCEL_ENV;
  }
  if (env.VERCEL === "1") return "preview";
  return "local";
}

function resolveInstanceUrl(env: EnvLike, origin?: string): string {
  const fromOrigin = origin?.replace(/\/$/, "");
  if (fromOrigin) return fromOrigin;
  return (
    httpsUrl(env.NEXT_PUBLIC_APP_URL) ??
    httpsUrl(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    httpsUrl(env.VERCEL_URL) ??
    "http://localhost:3000"
  );
}

const VERCEL_SLUG = /^[a-zA-Z0-9._-]+$/;
const defaultVercelScopeCache: VercelScopeCache = new Map();

function vercelSlug(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !VERCEL_SLUG.test(trimmed)) return null;
  return trimmed;
}

function isVercelRuntime(env: EnvLike): boolean {
  return (
    env.VERCEL === "1" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview" ||
    env.VERCEL_ENV === "development"
  );
}

function vercelApiToken(env: EnvLike): string | null {
  return env.OVENLOVIN_VERCEL_TOKEN?.trim() || env.VERCEL_TOKEN?.trim() || null;
}

export function vercelScopeFromOverrides(env: EnvLike): VercelDashboardScope | null {
  const teamSlug = vercelSlug(env.OVENLOVIN_VERCEL_TEAM_SLUG);
  const projectSlug =
    vercelSlug(env.OVENLOVIN_VERCEL_PROJECT_SLUG) ?? vercelSlug(env.VERCEL_GIT_REPO_SLUG);
  if (!teamSlug || !projectSlug) return null;
  return { teamSlug, projectSlug };
}

export function vercelProjectDashboardUrl(scope: VercelDashboardScope | null): string | null {
  if (!scope) return null;
  return `https://vercel.com/${scope.teamSlug}/${scope.projectSlug}`;
}

export function vercelDeploymentDashboardUrl(
  scope: VercelDashboardScope | null,
  deploymentId?: string | null
): string | null {
  const projectUrl = vercelProjectDashboardUrl(scope);
  const id = deploymentId?.trim();
  if (!projectUrl || !id) return null;
  return `${projectUrl}/${id}`;
}

function vercelDashboardLinks(
  env: EnvLike,
  scope: VercelDashboardScope | null
): DeployInfo["vercel"] {
  const projectUrl = vercelProjectDashboardUrl(scope);
  if (projectUrl) {
    return {
      projectUrl,
      deploymentUrl: vercelDeploymentDashboardUrl(scope, env.VERCEL_DEPLOYMENT_ID),
    };
  }
  if (isVercelRuntime(env)) {
    return { projectUrl: VERCEL_DASHBOARD_URL, deploymentUrl: null };
  }
  return { projectUrl: null, deploymentUrl: null };
}

function vercelScopeCacheKey(env: EnvLike): string {
  return [
    env.OVENLOVIN_VERCEL_TEAM_SLUG?.trim() ?? "",
    env.OVENLOVIN_VERCEL_PROJECT_SLUG?.trim() ?? "",
    env.VERCEL_PROJECT_ID?.trim() ?? "",
    env.VERCEL_ORG_ID?.trim() ?? "",
    env.VERCEL_GIT_REPO_SLUG?.trim() ?? "",
    vercelApiToken(env) ?? "",
  ].join("|");
}

async function fetchVercelJson(
  fetchImpl: FetchLike,
  url: string,
  token: string
): Promise<Record<string, unknown> | null> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
}

function stringField(body: Record<string, unknown> | null, key: string): string | null {
  const value = body?.[key];
  return typeof value === "string" ? value : null;
}

async function resolveVercelScopeFromApi(
  env: EnvLike,
  token: string,
  fetchImpl: FetchLike
): Promise<VercelDashboardScope | null> {
  const projectId = env.VERCEL_PROJECT_ID?.trim();
  if (!projectId) return null;

  const teamId = env.VERCEL_ORG_ID?.trim();
  const teamQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const projectApiUrl = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${teamQuery}`;

  const project = await fetchVercelJson(fetchImpl, projectApiUrl, token);
  const projectSlug =
    vercelSlug(env.OVENLOVIN_VERCEL_PROJECT_SLUG) ??
    vercelSlug(stringField(project, "name")) ??
    vercelSlug(env.VERCEL_GIT_REPO_SLUG);
  const accountId = stringField(project, "accountId") ?? teamId;

  let teamSlug = vercelSlug(env.OVENLOVIN_VERCEL_TEAM_SLUG);
  if (!teamSlug && accountId) {
    const team = await fetchVercelJson(
      fetchImpl,
      `https://api.vercel.com/v2/teams/${encodeURIComponent(accountId)}`,
      token
    );
    teamSlug = vercelSlug(stringField(team, "slug"));
  }
  if (!teamSlug) {
    const user = await fetchVercelJson(fetchImpl, "https://api.vercel.com/v2/user", token);
    const userBody = user?.user;
    const username =
      userBody && typeof userBody === "object"
        ? stringField(userBody as Record<string, unknown>, "username")
        : stringField(user, "username");
    teamSlug = vercelSlug(username);
  }

  if (!teamSlug || !projectSlug) return null;
  return { teamSlug, projectSlug };
}

/**
 * Resolve the Vercel dashboard team/project slugs.
 *
 * Never uses `VERCEL_GIT_REPO_OWNER` - that is the GitHub owner, which 404s
 * when the Vercel team slug differs. Order:
 * 1. `OVENLOVIN_VERCEL_TEAM_SLUG` + project slug override or git repo slug
 * 2. Vercel REST API via `VERCEL_PROJECT_ID` when a token is available (cached)
 * 3. `null` so callers can link to {@link VERCEL_DASHBOARD_URL}
 */
export async function resolveVercelDashboardScope(
  env: EnvLike,
  options?: ResolveVercelScopeOptions
): Promise<VercelDashboardScope | null> {
  const fromOverrides = vercelScopeFromOverrides(env);
  if (fromOverrides) return fromOverrides;

  const token = vercelApiToken(env);
  const fetchImpl = options?.fetch;
  if (!token || !fetchImpl || !env.VERCEL_PROJECT_ID?.trim()) return null;

  const cache = options?.cache ?? defaultVercelScopeCache;
  const key = vercelScopeCacheKey(env);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = resolveVercelScopeFromApi(env, token, fetchImpl).catch(() => null);
  cache.set(key, pending);
  return pending;
}

export function clearVercelDashboardScopeCache(
  cache: VercelScopeCache = defaultVercelScopeCache
): void {
  cache.clear();
}

function githubLinks(env: EnvLike): DeployInfo["github"] {
  const owner = env.VERCEL_GIT_REPO_OWNER?.trim() || null;
  const slug = env.VERCEL_GIT_REPO_SLUG?.trim() || null;
  const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const repoUrl = owner && slug ? `https://github.com/${owner}/${slug}` : null;
  return {
    repoUrl,
    commitUrl: repoUrl && commitSha ? `${repoUrl}/commit/${commitSha}` : null,
    owner,
    slug,
    commitSha,
    commitShort: commitSha ? commitSha.slice(0, 7) : null,
    commitRef: env.VERCEL_GIT_COMMIT_REF?.trim() || null,
    commitMessage: env.VERCEL_GIT_COMMIT_MESSAGE?.trim() || null,
  };
}

export function formatDeployedAt(iso: string, now = new Date()): DeployedAtDisplay {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { iso, absolute: iso, relative: "" };
  }

  const absolute = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);

  return { iso, absolute, relative: formatRelativeTime(date, now) };
}

export function formatRelativeTime(then: Date, now = new Date()): string {
  const diffSec = Math.round((now.getTime() - then.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 45) return "just now";
  if (abs < 90) return rtf.format(-Math.sign(diffSec), "minute").replace(/^1 /, "a ");
  if (abs < 3600) return rtf.format(-Math.round(diffSec / 60), "minute");
  if (abs < 3600 * 36) return rtf.format(-Math.round(diffSec / 3600), "hour");
  if (abs < 3600 * 24 * 28) return rtf.format(-Math.round(diffSec / (3600 * 24)), "day");
  return rtf.format(-Math.round(diffSec / (3600 * 24 * 30)), "month");
}

export function describeDeploy(env: EnvLike, options?: DescribeDeployOptions): DeployInfo {
  const environment = resolveEnvironment(env);
  const instanceUrl = resolveInstanceUrl(env, options?.origin);
  const live = environment === "production" || environment === "preview";
  const scope =
    options && "vercelScope" in options
      ? (options.vercelScope ?? null)
      : vercelScopeFromOverrides(env);

  return {
    live,
    environment,
    environmentLabel: ENV_LABEL[environment],
    headline: live ? "You're live." : "Running locally.",
    instanceUrl,
    instanceHost: hostFromOrigin(instanceUrl),
    deployedAt: env.NEXT_PUBLIC_BUILD_TIME?.trim() || null,
    vercel: vercelDashboardLinks(env, scope),
    github: githubLinks(env),
  };
}

export async function describeDeployResolved(
  env: EnvLike,
  options?: { origin?: string; fetch?: FetchLike; cache?: VercelScopeCache }
): Promise<DeployInfo> {
  const vercelScope = await resolveVercelDashboardScope(env, options);
  return describeDeploy(env, { origin: options?.origin, vercelScope });
}
