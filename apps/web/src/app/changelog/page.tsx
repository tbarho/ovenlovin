import type { Metadata } from "next";
import { DocsChrome } from "@/components/docs/DocsChrome";
import { formatChangelogDate, loadChangelog } from "@/lib/changelog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Changelog · OvenLovin",
  description: "What's new in OvenLovin, one ship day at a time.",
};

const INLINE = /(`[^`]+`|\[[^\]]+\]\([^)]+\)|#\d+)/g;

function Inline({ text }: { text: string }) {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return (
        <a key={i} href={link[2]}>
          {link[1]}
        </a>
      );
    if (/^#\d+$/.test(part)) {
      return (
        <a key={i} href={`https://github.com/tbarho/ovenlovin/pull/${part.slice(1)}`}>
          {part}
        </a>
      );
    }
    return part;
  });
}

function Block({ block }: { block: any }) {
  if (block.type === "h3")
    return (
      <h3>
        <Inline text={block.text} />
      </h3>
    );
  if (block.type === "ul") {
    return (
      <ul>
        {block.items.map((item: string) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p>
      <Inline text={block.text} />
    </p>
  );
}

export default function ChangelogPage() {
  const entries = loadChangelog();

  return (
    <DocsChrome current="changelog">
      <p className="eyebrow">Changelog</p>
      <h1>What&apos;s new in OvenLovin</h1>
      <p className="lead">New ways to cook, plan, and shop with your household and your agent.</p>
      <div className="changelog">
        {entries.map((entry) => (
          <section key={entry.date} id={entry.date} className="changelog-entry">
            <a className="changelog-date" href={`#${entry.date}`}>
              <time dateTime={entry.date}>{formatChangelogDate(entry.date)}</time>
              {entry.version ? <span className="changelog-version">v{entry.version}</span> : null}
            </a>
            <article className="changelog-body">
              <h2>{entry.title}</h2>
              {entry.blocks.map((block: any, i: number) => (
                <Block key={i} block={block} />
              ))}
            </article>
          </section>
        ))}
      </div>
    </DocsChrome>
  );
}
