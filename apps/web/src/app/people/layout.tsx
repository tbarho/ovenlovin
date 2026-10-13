import { AppChrome } from "@/components/kitchen/AppChrome";
import "@/app/prototype/people/prototype.css";
import "@/components/people/people.css";

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return <AppChrome>{children}</AppChrome>;
}
