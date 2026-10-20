// test/scoring-snapshot.ts
// regenerate the snapshot with `bun test/scoring-snapshot.ts` after an intended change to evaluate
import { genGames } from "./helpers";
import { evaluate } from "../src/strategy/evaluate";
import { factors as f } from "../src/strategy/factors";

const GAMES = 10;
const games = genGames(GAMES);
const scores = games.map((game) => ({
  game: { ...game, positions: Array.from(game.positions) },
  score: evaluate(f.balancedFactors)(game, game.turn),
}));

await Bun.write("test/scoring-snapshot.json", JSON.stringify(scores, null, 2));
