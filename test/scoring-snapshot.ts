// test/scoring-snapshot.ts
import { genGames } from "./helpers";
import { evaluate, factors as f } from "../src/strategy/evaluationFns";

const GAMES = 10;
const games = genGames(GAMES);
const scores = games.map((game) => ({
  game,
  score: evaluate(f.balancedFactors)(game, game.turn),
}));

await Bun.write("test/scoring-snapshot.json", JSON.stringify(scores, null, 2));
