export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "•".repeat(Math.max(trimmed.length, 4));
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-4);
  const hidden = Math.min(18, trimmed.length - 8);
  return `${head}${"•".repeat(hidden)}${tail}`;
}
