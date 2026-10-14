import { describe, expect, it } from "vitest";
import { parseForAttendeesParam } from "./recipe-attendee-filter";

describe("parseForAttendeesParam", () => {
  it("accepts repeated and comma-separated person ids", () => {
    expect(parseForAttendeesParam(["person-a", "person-b,person-c"])).toEqual([
      "person-a",
      "person-b",
      "person-c",
    ]);
  });

  it("drops blanks", () => {
    expect(parseForAttendeesParam(["", " person-a , ", "person-b"])).toEqual([
      "person-a",
      "person-b",
    ]);
  });
});
