import { sql } from "drizzle-orm";
import {
  describeConfigStatus,
  isAiGatewayConfigured,
  type ConfigStatus,
} from "@ovenlovin/core/onboarding";
import { isDemoModeEnabled } from "./demo/mode";

export async function getConfigStatus(): Promise<ConfigStatus> {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );
  const aiGatewayConfigured = isAiGatewayConfigured(process.env);

  let databaseReachable: boolean | undefined;
  if (databaseConfigured) {
    try {
      const { getDatabase } = await import("@ovenlovin/db");
      const db = getDatabase();
      await db.execute(sql`select 1`);
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  return describeConfigStatus({
    databaseConfigured,
    databaseReachable,
    clerkConfigured,
    aiGatewayConfigured,
    demoMode: isDemoModeEnabled(),
  });
}
