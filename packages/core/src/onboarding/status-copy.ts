export type ConfigFlag = {
  id: "database" | "clerk" | "aiGateway" | "blob";
  label: string;
  configured: boolean;
  required: boolean;
  reachable?: boolean;
  detail: string;
};

export type ConfigStatus = {
  ready: boolean;
  mode: "demo" | "product";
  checks: ConfigFlag[];
};

export function describeConfigStatus(input: {
  databaseConfigured: boolean;
  databaseReachable?: boolean;
  clerkConfigured: boolean;
  aiGatewayConfigured: boolean;
  blobConfigured?: boolean;
  demoMode?: boolean;
}): ConfigStatus {
  const demo = input.demoMode === true;
  const checks: ConfigFlag[] = [
    {
      id: "database",
      label: "Database",
      configured: input.databaseConfigured,
      required: true,
      reachable: input.databaseReachable,
      detail: !input.databaseConfigured
        ? "Set DATABASE_URL, or connect Neon in the Vercel deploy flow."
        : input.databaseReachable === false
          ? "DATABASE_URL is set, but this instance could not reach Postgres. Confirm the Neon project is awake and the URL includes sslmode=require."
          : "Neon Postgres is connected.",
    },
    {
      id: "clerk",
      label: "Clerk",
      configured: demo ? true : input.clerkConfigured,
      required: !demo,
      detail: demo
        ? "Demo auth uses sandbox cookies and API keys. Clerk is not required."
        : input.clerkConfigured
          ? "Sign-in is configured."
          : "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, or install the Clerk Vercel integration during deploy.",
    },
    {
      id: "aiGateway",
      label: "AI Gateway",
      configured: input.aiGatewayConfigured,
      required: !demo,
      detail: aiGatewayStatusDetail(input.aiGatewayConfigured, demo),
    },
    {
      id: "blob",
      label: "Vercel Blob",
      configured: input.blobConfigured === true,
      required: false,
      detail:
        input.blobConfigured === true
          ? "Imported recipe photos are copied to Vercel Blob."
          : "Connect a Blob store to this Vercel project (Storage → Blob) so BLOB_READ_WRITE_TOKEN is set. Without it, imported images stay hot-linked to the source site.",
    },
  ];

  return {
    mode: demo ? "demo" : "product",
    ready: checks
      .filter((check) => check.required)
      .every((check) => check.configured && check.reachable !== false),
    checks,
  };
}

/** Same credential story as `isAiGatewayConfigured` — demo does not fake configured:true. */
export function aiGatewayStatusDetail(configured: boolean, demoMode: boolean): string {
  if (configured) {
    return demoMode
      ? "Photo import can use AI Gateway via OIDC or AI_GATEWAY_API_KEY. URL and paste import still work without vision."
      : "Recipe paste and photo import can use the gateway via OIDC or an API key.";
  }
  return demoMode
    ? "Photo import needs AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN. URL and paste import still work without it."
    : "On Vercel, AI Gateway authenticates with OIDC (VERCEL_OIDC_TOKEN) — no API key needed. For local or non-Vercel hosts, set AI_GATEWAY_API_KEY. URL import still works without it.";
}
