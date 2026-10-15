export function clerkUnavailableCopy(demo: boolean): {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
} {
  if (demo) {
    return {
      title: "Sign-in isn't available in the demo",
      body: "This sandbox is already open. You can go back to the kitchen without creating an account.",
      href: "/recipes",
      linkLabel: "Back to recipes",
    };
  }
  return {
    title: "Sign-in isn't set up yet",
    body: "This kitchen isn't accepting accounts on this deploy. Go back to the kitchen, or ask the host to finish setup.",
    href: "/",
    linkLabel: "Back home",
  };
}
