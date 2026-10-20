import { describe, expect, test } from "bun:test";
import { Strategies } from "../src/strategy/strategies";
import { compareByRollouts } from "../src/evals/differences";

const { balanced, learned } = Strategies;

describe("difference rollouts", () => {
  test("finds learned chooses better than balanced", () => {
    // both strategies are deterministic and the dice are seeded, so this is stable
    const r = compareByRollouts(learned, balanced, { positions: 40, rollouts: 40, policy: learned });
    expect(r.disagreements.length).toBe(40);
    expect(r.difference.low).toBeGreaterThan(0);
  });

  test("is deterministic for deterministic strategies", () => {
    const config = { positions: 5, rollouts: 10, policy: learned, seed: 3 };
    const a = compareByRollouts(balanced, learned, config);
    const b = compareByRollouts(balanced, learned, config);
    expect(a.disagreements.map((d) => d.values)).toEqual(b.disagreements.map((d) => d.values));
  });

  test("a strategy never disagrees with itself", () => {
    const r = compareByRollouts(learned, learned, { positions: 1, rollouts: 1, policy: learned, maxDecisions: 300 });
    expect(r.disagreements.length).toBe(0);
    expect(r.decisions).toBe(300);
  });
});
