import { describe, expect, it } from "vitest";
import {
  assertExpectedSequence,
  getCurrentSequence,
  nextSequence,
  SequenceConflictError,
  validateEventSequence,
} from "../projector/index";

describe("sequence locking", () => {
  it("treats null last sequence as 0", () => {
    expect(getCurrentSequence(null)).toBe(0);
    expect(getCurrentSequence(undefined)).toBe(0);
    expect(nextSequence(null)).toBe(1);
  });

  it("increments sequence for append", () => {
    expect(nextSequence(5)).toBe(6);
  });

  it("passes when expected matches current", () => {
    expect(() => assertExpectedSequence(3, 3)).not.toThrow();
  });

  it("throws SequenceConflictError on mismatch", () => {
    expect(() => assertExpectedSequence(2, 5)).toThrow(SequenceConflictError);
    try {
      assertExpectedSequence(2, 5);
    } catch (err) {
      expect(err).toBeInstanceOf(SequenceConflictError);
      const e = err as SequenceConflictError;
      expect(e.expectedSequence).toBe(2);
      expect(e.actualSequence).toBe(5);
    }
  });

  it("validates contiguous replay sequences", () => {
    expect(() =>
      validateEventSequence([{ sequence: 1 }, { sequence: 2 }, { sequence: 3 }]),
    ).not.toThrow();
  });

  it("rejects gaps in replay sequences", () => {
    expect(() => validateEventSequence([{ sequence: 1 }, { sequence: 3 }])).toThrow(
      /sequence gap/,
    );
  });
});
