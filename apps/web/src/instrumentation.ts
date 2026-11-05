export async function register() {
  // This exact form lets the Edge build drop the import, which needs node:crypto.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerIngredientMatchEviction } = await import("@/lib/ingredient-match-store");
    registerIngredientMatchEviction();
  }
}
