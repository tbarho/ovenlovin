export const HOUSEHOLD_COOKIE = "ovenlovin_household_id";
export const INVITE_COOKIE = "ovenlovin_invite_token";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const inviteTokenPattern = /^olinv_[a-f0-9]{32,128}$/;

export function isHouseholdId(value: string | undefined | null): value is string {
  return Boolean(value && uuidPattern.test(value));
}

export function readInviteToken(value: string | undefined | null): string | null {
  if (!value || !inviteTokenPattern.test(value)) return null;
  return value;
}

export const householdCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
};

export const inviteCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24,
  secure: process.env.NODE_ENV === "production",
};
