import type { EnvLike } from "./ai-gateway";

export type DeployEnvironment = "production" | "preview" | "development" | "local";

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

function vercelProjectUrl(env: EnvLike): string | null {
  if (env.VERCEL_ORG_ID && env.VERCEL_PROJECT_ID) {
    return `https://vercel.com/${env.VERCEL_ORG_ID}/${env.VERCEL_PROJECT_ID}`;
  }
  if (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG) {
    return `https://vercel.com/${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}`;
  }
  return null;
}

function vercelDeploymentUrl(env: EnvLike, projectUrl: string | null): string | null {
  if (projectUrl && env.VERCEL_DEPLOYMENT_ID) {
    return `${projectUrl}/${env.VERCEL_DEPLOYMENT_ID}`;
  }
  return httpsUrl(env.VERCEL_URL);
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

export function describeDeploy(env: EnvLike, options?: { origin?: string }): DeployInfo {
  const environment = resolveEnvironment(env);
  const instanceUrl = resolveInstanceUrl(env, options?.origin);
  const vercelProject = vercelProjectUrl(env);
  const live = environment === "production" || environment === "preview";

  return {
    live,
    environment,
    environmentLabel: ENV_LABEL[environment],
    headline: live ? "You're live." : "Running locally.",
    instanceUrl,
    instanceHost: hostFromOrigin(instanceUrl),
    deployedAt: env.NEXT_PUBLIC_BUILD_TIME?.trim() || null,
    vercel: {
      projectUrl: vercelProject,
      deploymentUrl: vercelDeploymentUrl(env, vercelProject),
    },
    github: githubLinks(env),
  };
}
