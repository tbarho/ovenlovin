export type ConfigFlag = {
  id: "database" | "clerk" | "aiGateway";
  label: string;
  configured: boolean;
  reachable?: boolean;
  detail: string;
};

export type ConfigStatus = {
  ready: boolean;
  checks: ConfigFlag[];
};

export function describeConfigStatus(input: {
  databaseConfigured: boolean;
  databaseReachable?: boolean;
  clerkConfigured: boolean;
  aiGatewayConfigured: boolean;
}): ConfigStatus {
  const checks: ConfigFlag[] = [
    {
      id: "database",
      label: "Database",
      configured: input.databaseConfigured,
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
      configured: input.clerkConfigured,
      detail: input.clerkConfigured
        ? "Sign-in is configured."
        : "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, or install the Clerk Vercel integration during deploy.",
    },
    {
      id: "aiGateway",
      label: "AI Gateway",
      configured: input.aiGatewayConfigured,
      detail: input.aiGatewayConfigured
        ? "Recipe paste import can use the gateway."
        : "Set AI_GATEWAY_API_KEY to enable AI-backed paste import. URL import still works without it.",
    },
  ];

  return {
    ready: checks.every((check) => check.configured && check.reachable !== false),
    checks,
  };
}
