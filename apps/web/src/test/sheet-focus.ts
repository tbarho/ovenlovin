import { expect } from "vitest";
import type { UserEvent } from "@testing-library/user-event";

export async function typeFullWordAndKeepFocus(user: UserEvent, input: HTMLElement, word: string) {
  await user.click(input);
  expect(document.activeElement).toBe(input);
  await user.clear(input);
  expect(document.activeElement).toBe(input);
  await user.keyboard(word);
  expect(input).toHaveValue(word);
  expect(document.activeElement).toBe(input);
}
