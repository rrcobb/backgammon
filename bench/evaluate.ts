// evaluate.bench.ts
import { run, bench, summary } from "mitata";
import { genGames } from "../test/helpers";
import { evaluate, factors as f } from "../src/strategy/evaluationFns";
import { constants as c } from "../src/backgammon";

const SCENARIOS = 1000;
const games = genGames(SCENARIOS);
const evalFn = evaluate(f.balancedFactors);

summary(() => {
  bench(`evaluate ${SCENARIOS} positions`, () => {
    games.forEach(game => {
      evalFn(game, game.turn);
    });
  });
});

await run();
