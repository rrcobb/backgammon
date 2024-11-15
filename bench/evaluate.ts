// evaluate.bench.ts
import { run, bench, summary } from "mitata";
import { genGames } from "../test/helpers";
import { factors as f } from "../src/strategy/factors";
import { evaluate } from "../src/strategy/evaluate";
import { constants as c } from "../src/backgammon";

const SCENARIOS = 1000;
const games = genGames(SCENARIOS);
const evalFn = evaluate(f.balancedFactors);

summary(() => {
  bench(`evaluate ${SCENARIOS} positions`, () => {
    games.forEach((game) => {
      evalFn(game, game.turn);
    });
  });
});

await run();
