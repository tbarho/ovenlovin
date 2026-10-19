export function iosShortcutUrl(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const value = env.NEXT_PUBLIC_IOS_SHORTCUT_URL?.trim();
  return value || undefined;
}
