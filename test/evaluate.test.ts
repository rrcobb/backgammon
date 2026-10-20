// test/evaluate.test.ts
import { test, expect } from "bun:test";
import { genGames } from "./helpers";
import { evaluate } from "../src/strategy/evaluate";
import { factors as f } from "../src/strategy/factors";

// this doesn't ultimately matter, since we're persisting the games to evaluate in the snapshot
test("genGames produces consistent output with same seed", () => {
  const games1 = genGames(5);
  const games2 = genGames(5);

  expect(games1).toEqual(games2);
});

// regenerate with `bun test/scoring-snapshot.ts` after an intended change to evaluate
test("evaluate matches scoring snapshot", async () => {
  const snapshot = JSON.parse(await Bun.file("test/scoring-snapshot.json").text());
  const snapScores = snapshot.map(({ score }) => expect.closeTo(score, 6));
  const evalScores = snapshot.map(({ game }) => {
    const g = { ...game, positions: new Uint8Array(game.positions) };
    return evaluate(f.balancedFactors)(g, g.turn);
  });
  expect(evalScores).toEqual(snapScores);
});
