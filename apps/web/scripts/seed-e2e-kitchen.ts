import { createDbClient } from "@ovenlovin/db";
import { seedE2eKitchen } from "../src/lib/e2e-kitchen";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to seed the e2e kitchen.");
  }
  const db = createDbClient(url);
  try {
    const result = await seedE2eKitchen(db);
    console.log(
      JSON.stringify(
        {
          householdId: result.householdId,
          userId: result.userId,
          created: result.created,
        },
        null,
        2
      )
    );
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
