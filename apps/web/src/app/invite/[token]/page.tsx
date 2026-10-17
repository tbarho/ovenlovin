import Image from "next/image";
import Link from "next/link";
import { InviteService, isInviteToken } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { brandPublicPath } from "@ovenlovin/brand";
import { InviteAccept } from "@/components/settings/InviteAccept";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { DEMO_ENTER_PATH, safeDemoEnterNext } from "@/lib/demo/enter";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { getSessionContext } from "@/lib/session";

export const dynamic = "force-dynamic";

async function optionalSession() {
  try {
    return await getSessionContext({ allowRedirect: false });
  } catch {
    return null;
  }
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = isInviteToken(token)
    ? await new InviteService(getDatabase()).previewInvite(token)
    : null;
  const session = preview?.status === "pending" ? await optionalSession() : null;
  const returnTo = safeAuthRedirect(`/invite/${token}`);

  return (
    <div className="shell">
      <div className="wrap page-narrow invite-page">
        <Link href="/" className="brand">
          <Image src={brandPublicPath.mark} alt="" width={40} height={40} unoptimized />
          OvenLovin
        </Link>
        {!preview ? (
          <>
            <h1>Invite not found</h1>
            <p className="muted">This link is invalid or the kitchen is gone.</p>
            <Link className="btn" href="/">
              Back home
            </Link>
          </>
        ) : preview.status !== "pending" ? (
          <>
            <h1>This invite is no longer valid</h1>
            <p className="muted">
              {preview.status === "revoked"
                ? `${preview.householdName} revoked this link.`
                : `This link for ${preview.householdName} has expired.`}
            </p>
            <Link className="btn" href="/">
              Back home
            </Link>
          </>
        ) : (
          <>
            <p className="badge">
              <i />
              Kitchen invite
            </p>
            <h1>Join {preview.householdName}</h1>
            <p className="muted">
              You will share this kitchen&apos;s recipes, people, and plans as a {preview.role}.
            </p>
            {session?.userId ? (
              <InviteAccept token={token} householdName={preview.householdName} />
            ) : isDemoModeEnabled() ? (
              <Link
                className="btn primary"
                href={`${DEMO_ENTER_PATH}?next=${encodeURIComponent(safeDemoEnterNext(returnTo))}`}
              >
                Enter demo to join
              </Link>
            ) : (
              <div className="invite-auth">
                <Link
                  className="btn primary"
                  href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}
                >
                  Sign in to join
                </Link>
                <Link
                  className="btn"
                  href={`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`}
                >
                  Create an account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
