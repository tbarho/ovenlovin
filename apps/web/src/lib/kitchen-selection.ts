import { HOUSEHOLD_COOKIE, INVITE_COOKIE, isHouseholdId, readInviteToken } from "./kitchen-cookies";

type CookieStore = {
  get(name: string): { value: string } | undefined;
};

export function readKitchenCookies(store: CookieStore | null | undefined): {
  preferredHouseholdId: string | null;
  inviteToken: string | null;
} {
  const householdValue = store?.get(HOUSEHOLD_COOKIE)?.value;
  return {
    preferredHouseholdId: isHouseholdId(householdValue) ? householdValue : null,
    inviteToken: readInviteToken(store?.get(INVITE_COOKIE)?.value),
  };
}
