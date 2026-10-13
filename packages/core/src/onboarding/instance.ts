export const DEFAULT_INSTANCE_NAME = "Your OvenLovin";

export function getInstanceName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_INSTANCE_NAME;
}
