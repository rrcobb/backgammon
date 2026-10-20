import { describe, it, expect } from "bun:test";
import { Strategies } from "../src/strategy/strategies";
import { compareTwo, playGame, roundRobinTournament } from "../src/evals/tournament";

const { balanced, runner, random } = Strategies;

describe("tournament", () => {
  it("plays the same game for the same seed", () => {
    const winners = [1, 2, 3, 4, 5].map((seed) => playGame(balanced, runner, seed));
    const again = [1, 2, 3, 4, 5].map((seed) => playGame(balanced, runner, seed));
    expect(again).toEqual(winners);
  });

  it("scores a deterministic strategy against itself at exactly 50%", () => {
    // both games in a pair are identical, so the same color wins both, and each strategy wins one
    const result = compareTwo(balanced, balanced, { pairs: 20 });
    expect(result.winRate).toBe(0.5);
    expect(result.wins).toBe(20);
    expect(result.significant).toBe(false);
    // and the points cancel the same way
    expect(result.points.mean).toBe(0);
  });

  it("finds balanced stronger than random", () => {
    const result = compareTwo(balanced, random, { pairs: 50 });
    expect(result.significant).toBe(true);
    expect(result.winRate).toBeGreaterThan(0.5);
    const [low, high] = result.confidenceInterval;
    expect(low).toBeLessThanOrEqual(result.winRate);
    expect(high).toBeGreaterThanOrEqual(result.winRate);
    // gammons make points per game larger than 2 * win rate - 1
    expect(result.points.mean).toBeGreaterThan(2 * result.winRate - 1);
    expect(result.points.mean).toBeLessThanOrEqual(3);
  });

  it("fills a consistent round robin table", () => {
    const t = roundRobinTournament({ balanced, runner, random }, { pairs: 10, progress: false });
    expect(t.totalGames).toBe(3 * 10 * 2);
    for (let i = 0; i < 3; i++) {
      expect(t.results[i][i]).toBeNull();
      for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        expect(t.results[i][j]!.winRate + t.results[j][i]!.winRate).toBeCloseTo(1);
        expect(t.results[i][j]!.wins + t.results[j][i]!.wins).toBe(20);
      }
    }
  });
});
