import { CookbookService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { loadOwned } from "@/lib/api/owned";

export function loadOwnedCookbook(id: string, householdId: string) {
  return loadOwned("Cookbook", id, householdId, (cookbookId) =>
    new CookbookService(getDatabase()).getCookbook(cookbookId)
  );
}
