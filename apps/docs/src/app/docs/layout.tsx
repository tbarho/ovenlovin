import { source } from "@/lib/source";
import { baseOptions } from "@/app/layout.config";
import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

export default function Layout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
