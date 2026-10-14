import { headers } from "next/headers";
import { buildLlmsTxt } from "@/lib/llms-txt";
import { resolveOrigin } from "@/lib/origin";

export async function GET() {
  const origin = resolveOrigin(await headers());
  return new Response(buildLlmsTxt(origin), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
