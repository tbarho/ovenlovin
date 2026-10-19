export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    // Keepalive POSTs drop in Chrome after 64KB or a long wait. Import and
    // image save can be both large and slow, so never default keepalive on.
    keepalive: init?.keepalive ?? false,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({
      title: response.statusText,
    }))) as { title?: string; detail?: string };
    throw new Error(problem.detail || problem.title || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
