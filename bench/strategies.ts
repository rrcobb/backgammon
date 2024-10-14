import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata";
import { constants as c, helpers as h, clearCache } from "../src/backgammon.ts";
import { genGame, genGames, genRoll } from "../test/helpers";
import { Strategies, counts, resetCounts } from "../src/strategies";

const SCENARIOS = 10;
const games = genGames(SCENARIOS);
const scenarios = games.map((g) => {
  let roll = genRoll();
  let options = h.validMoves(g, roll);
  return options;
});

// compact(() => {
//   bench("genGame (test fc arb)", () => {
//     genGame();
//   });

//   bench("generateRoll", () => {
//     h.generateRoll();
//   });

//   // conceptually: this happens for each strategy run
//   // so, subtract it (and the apply step) from the strategy time
//   bench("game + roll + validMoves", () => {
//     const game = genGame();
//     const roll = h.generateRoll();
//     h.validMoves(game, roll);
//   });
// });

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
  clearCache();
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
    clearCache();
    strategy(scenario);
    if (counts.validMoves == 0) continue;
    console.log(`${name} (scenario ${i++} [_id ${games[i - 2]._id} ${scenario.length} options]):` + JSON.stringify(counts));
  }
});
