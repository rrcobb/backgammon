import { describe, expect, test } from "bun:test";
import { constants as c, helpers as h } from "../src/backgammon";
import type { Roll } from "../src/backgammon";
import { Strategies, useExpectimax, makeApplied } from "../src/strategy/strategies";
import type { Analysis, AppliedStrategy } from "../src/strategy/strategies";
import { useMCTS } from "../src/strategy/mcts";

function startGame() {
  const game = h.newGame();
  game.turn = c.WHITE;
  return game;
}

function analyze(strategy: AppliedStrategy, roll: Roll = [3, 1]) {
  const reports: Analysis[] = [];
  const result = strategy(startGame(), roll, (a) => reports.push(a));
  return { result, reports };
}

const reporting = {
  learned: Strategies.learned,
  fastOnePly: Strategies.fastOnePly,
  expectimax: makeApplied(useExpectimax((g) => g.wHome - g.bHome, 2)),
  mcts: useMCTS({ explore: 0.3, simulations: 100, rolloutStrategy: Strategies.random }),
};

describe("strategy analysis", () => {
  for (const [name, strategy] of Object.entries(reporting)) {
    test(`${name} reports once, with the move it played first`, () => {
      const { result, reports } = analyze(strategy);
      expect(reports.length).toBe(1);
      const [analysis] = reports;
      expect(analysis.measure.length).toBeGreaterThan(0);
      expect(analysis.candidates.length).toBeGreaterThan(0);
      expect(analysis.candidates[0].move).toEqual(result[0]);
    });
  }

  test("candidates are best first by value, for evaluation strategies", () => {
    const { reports } = analyze(Strategies.learned);
    const values = reports[0].candidates.map((c) => c.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  test("the same move with or without a report", () => {
    for (const roll of [[3, 1], [6, 5], [2, 2]] as Roll[]) {
      const withReport = Strategies.learned(startGame(), roll, () => {});
      const without = Strategies.learned(startGame(), roll);
      expect(withReport[0]).toEqual(without[0]);
    }
  });

  test("mcts reports win rates as percentages, with visits", () => {
    const { reports } = analyze(reporting.mcts);
    const [analysis] = reports;
    expect(analysis.percent).toBe(true);
    expect(analysis.candidates.every((c) => c.value >= 0 && c.value <= 1)).toBe(true);
    expect(analysis.candidates.every((c) => c.detail?.endsWith("visits"))).toBe(true);
  });

  test("strategies without an analysis just play", () => {
    const { reports } = analyze(Strategies.random);
    expect(reports.length).toBe(0);
  });
});
