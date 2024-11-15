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

test("evaluate matches scoring snapshot", async () => {
  const snapshot = JSON.parse(await Bun.file("test/scoring-snapshot.json").text());
  const snapScores = snapshot.map(({ game, score }) => expect.closeTo(score, 3));
  const evalScores = snapshot.map(({ game, score }) => evaluate(f.balancedFactors)(game, game.turn));
  expect(snapScores).toEqual(evalScores);
});
