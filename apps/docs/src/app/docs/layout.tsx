import { source } from "@/lib/source";
import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

export default function Layout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <span className="font-bold">
            <span className="text-primary">OvenLovin</span>
          </span>
        ),
        url: "/",
      }}
      links={[
        {
          text: "GitHub",
          url: "https://github.com/tbarho/ovenlovin",
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
