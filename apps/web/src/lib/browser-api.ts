export type ApiClientError = Error & {
  status?: number;
  recipeId?: string;
  recipeUrl?: string;
  code?: string;
  heading?: string;
  nextSteps?: unknown;
  permalink?: string;
  handle?: string;
  kind?: string;
};

export function apiErrorRecipeUrl(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const url = (error as ApiClientError).recipeUrl;
  return typeof url === "string" && url.startsWith("/") ? url : null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    keepalive: init?.keepalive ?? (init?.method === "PATCH" || init?.method === "POST"),
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({
      title: response.statusText,
    }))) as {
      title?: string;
      detail?: string;
      recipeId?: string;
      recipeUrl?: string;
      code?: string;
      heading?: string;
      nextSteps?: unknown;
      permalink?: string;
      handle?: string;
      kind?: string;
    };
    const error = new Error(
      problem.detail || problem.title || response.statusText
    ) as ApiClientError;
    error.status = response.status;
    if (typeof problem.recipeId === "string") error.recipeId = problem.recipeId;
    if (typeof problem.recipeUrl === "string") error.recipeUrl = problem.recipeUrl;
    if (typeof problem.code === "string") error.code = problem.code;
    if (typeof problem.heading === "string") error.heading = problem.heading;
    if (Array.isArray(problem.nextSteps)) error.nextSteps = problem.nextSteps;
    if (typeof problem.permalink === "string") error.permalink = problem.permalink;
    if (typeof problem.handle === "string") error.handle = problem.handle;
    if (typeof problem.kind === "string") error.kind = problem.kind;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
