"use client";

import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";

export function CodeSample({
  title,
  lang,
  code,
}: {
  title: string;
  lang: string;
  code: string;
}): React.ReactElement {
  return (
    <div className="ol-code-sample overflow-hidden rounded-lg border border-[var(--ol-border)] bg-[var(--ol-code-bg)]">
      <div className="flex items-center gap-2 border-b border-[var(--ol-border)] px-4 py-2">
        <span className="size-2 rounded-full bg-[#eaeaea] dark:bg-[#333]" />
        <span className="font-mono text-xs text-muted-foreground">{title}</span>
      </div>
      <DynamicCodeBlock lang={lang} code={code} />
    </div>
  );
}
