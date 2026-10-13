import type { DeployInfo } from "@ovenlovin/core/onboarding";

export function VercelBand({ deploy }: { deploy: DeployInfo }) {
  const repoLabel =
    deploy.github.owner && deploy.github.slug
      ? `${deploy.github.owner}/${deploy.github.slug}`
      : "GitHub";
  const commitLabel = deploy.github.commitShort ? deploy.github.commitShort : "Latest commit";

  const links = [
    deploy.vercel.projectUrl
      ? { href: deploy.vercel.projectUrl, label: "Project dashboard" }
      : null,
    deploy.vercel.deploymentUrl
      ? { href: deploy.vercel.deploymentUrl, label: "This deployment" }
      : null,
    deploy.github.repoUrl ? { href: deploy.github.repoUrl, label: repoLabel } : null,
    deploy.github.commitUrl ? { href: deploy.github.commitUrl, label: commitLabel } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <aside className="vercel-band" aria-label="It's on Vercel">
      <p className="vercel-kicker">It&apos;s on Vercel</p>
      <p className="vercel-copy">
        {deploy.live
          ? `${deploy.environmentLabel} on Vercel — this kitchen, this deploy, this commit.`
          : "Deploy to Vercel and this panel will link the project dashboard, this deployment, and the GitHub commit that built it."}
      </p>
      {links.length > 0 ? (
        <div className="vercel-links">
          {links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      {deploy.github.commitMessage ? (
        <p className="vercel-commit">{deploy.github.commitMessage}</p>
      ) : null}
    </aside>
  );
}
