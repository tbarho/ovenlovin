import type { Metadata } from "next";
import { PrototypeProvider } from "@/components/prototype/people/store";
import { PrototypeShell } from "@/components/prototype/people/PrototypeShell";
import "./prototype.css";

export const metadata: Metadata = {
  title: "People prototype · OvenLovin",
  description: "Clickable UX prototype for household people and dietary rules.",
};

export default function PrototypePeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrototypeProvider>
      <PrototypeShell>{children}</PrototypeShell>
    </PrototypeProvider>
  );
}
