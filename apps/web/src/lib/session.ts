import { auth, currentUser } from "@clerk/nextjs/server";
import { HouseholdService, PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { UnauthorizedError } from "@/lib/api/errors";
import type { RequestContext } from "@/lib/api/middleware";

export async function getSessionContext(): Promise<RequestContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const db = getDatabase();
  const households = new HouseholdService(db);
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    `${userId}@users.clerk.local`;

  const bootstrapped = await households.ensureHouseholdForClerkUser({
    clerkUserId: userId,
    email,
    displayName: clerkUser?.fullName ?? clerkUser?.firstName ?? null,
    clerkOrgId: orgId ?? null,
  });

  const people = new PeopleService(db);
  const existingPeople = await people.listPeopleByHousehold(bootstrapped.household.id, {
    limit: 1,
  });
  if (existingPeople.items.length === 0) {
    await people.createPerson({
      householdId: bootstrapped.household.id,
      userId: bootstrapped.user.id,
      displayName: bootstrapped.user.displayName ?? "You",
      createdBy: bootstrapped.user.id,
    });
  }

  return {
    userId: bootstrapped.user.id,
    clerkUserId: userId,
    householdId: bootstrapped.household.id,
    membershipRole: bootstrapped.membership.role,
  };
}
