import { headers } from "next/headers";
import { resolveOrigin } from "@/lib/origin";
import { publicOrigin } from "@/lib/public-origin";

export async function authRedirectOrigins(): Promise<string[]> {
  return [resolveOrigin(await headers()), publicOrigin()];
}
