import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata";
import { constants as c, helpers as h } from "../src/backgammon.ts";
import { genGame, genGames, genRoll } from "../test/helpers";
import { Strategies, counts, resetCounts } from "../src/strategy/strategies";

const SCENARIOS = 10;
const games = genGames(SCENARIOS);
const scenarios = games.map((g) => {
  let roll = genRoll();
  return [g, roll];
});

summary(() => {
  Object.keys(Strategies).forEach((name) => {
    if (name == "random") return;
    bench(`apply ${name} to ${SCENARIOS} scenarios`, function () {
      let strategy = Strategies[name];
      scenarios.forEach(([game, roll]) => {
        strategy(game, roll);
      });
    });
  });
});

await run();

// enable counters for how many calls we make to different functions
Object.keys(Strategies).forEach((name) => {
  resetCounts();
  let strategy = Strategies[name];
  scenarios.forEach(([game, roll]) => {
    strategy(game, roll);
  });
  console.log(`${name} (total, ${SCENARIOS} scenarios):` + JSON.stringify(counts));
});
