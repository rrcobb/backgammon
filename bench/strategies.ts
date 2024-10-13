import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata";
import { constants as c, helpers as h } from "../src/backgammon.ts";
import { genGame, genGames } from "../test/helpers";
import { Strategies, counts, resetCounts } from "../src/strategies";

compact(() => {
  bench("genGame", () => {
    genGame();
  });

  bench("generateRoll", () => {
    h.generateRoll();
  });

  // conceptually: this happens for each strategy run
  // so, subtract it (and the apply step) from the strategy time
  bench("game + roll + validMoves", () => {
    const game = genGame();
    const roll = h.generateRoll();
    h.validMoves(game, roll);
  });
});

const SCENARIOS = 10;
const games = genGames(SCENARIOS);
const scenarios = games.map((g) => {
  let roll = h.generateRoll();
  let options = h.validMoves(g, roll);
  return options;
});

summary(() => {
  Object.keys(Strategies).forEach((name) => {
    if (name == "random") return;
    bench(`apply ${name} to ${SCENARIOS} scenarios`, function () {
      let strategy = Strategies[name];
      scenarios.forEach((scenario) => {
        strategy(scenario);
      });
    });
  });
});

await run();

Object.keys(Strategies).forEach((name) => {
  resetCounts();
  let strategy = Strategies[name];
  scenarios.forEach((scenario) => {
    strategy(scenario);
  });
  if (counts.validMoves == 0) return;
  console.log(`${name} (total, ${SCENARIOS} scenarios):` + JSON.stringify(counts));
});

Object.keys(Strategies).forEach((name) => {
  let strategy = Strategies[name];
  let i = 1;
  for (let scenario of scenarios) {
    resetCounts();
    strategy(scenario);
    if (counts.validMoves == 0) continue;
    console.log(`${name} (scenario ${i++} [${scenario.length} options]):` + JSON.stringify(counts));
  }
});
