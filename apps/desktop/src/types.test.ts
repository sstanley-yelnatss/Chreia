import { describe, expect, it } from "vitest";
import { hygieneCategoryLabel, templateLabel } from "./types";

describe("templateLabel", () => {
  it("labels known templates", () => {
    expect(templateLabel("agent_devops")).toBe("Agent DevOps");
    expect(templateLabel("blank")).toBe("Blank");
  });

  it("falls back to the raw key for unknown templates", () => {
    expect(templateLabel("custom_template")).toBe("custom_template");
  });
});

describe("hygieneCategoryLabel", () => {
  it("labels known hygiene categories", () => {
    expect(hygieneCategoryLabel("still_open")).toBe("Still Open");
    expect(hygieneCategoryLabel("dead_ends")).toBe("Dead Ends");
  });

  it("falls back to the raw key when unknown", () => {
    expect(hygieneCategoryLabel("nope")).toBe("nope");
  });
});
