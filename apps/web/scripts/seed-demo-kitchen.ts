import { createDbClient } from "@ovenlovin/db";
import { seedDemoKitchen } from "../src/lib/demo/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to seed a demo kitchen.");
  }
  const db = createDbClient(url);
  try {
    const result = await seedDemoKitchen(db, {
      clerkUserId: process.env.DEMO_CLERK_USER_ID || "user_demo_local",
      householdSlug: process.env.DEMO_HOUSEHOLD_SLUG || "demo-local",
      email: process.env.DEMO_USER_EMAIL || "demo-local@demo.ovenlovin.local",
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
