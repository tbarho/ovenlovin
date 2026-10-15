export function tapFeedback(ms = 14): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(ms);
  } catch {
    // haptic is a bonus - never block the tap
  }
}
