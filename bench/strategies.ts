import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata";
import { constants as c, helpers as h } from "../src/backgammon.ts";
import { genGame, genGames } from "../test/helpers";
import { Strategies } from "../src/strategies";

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

const count = 10;
const games = genGames(count);
const scenarios = games.map((g) => {
  let roll = h.generateRoll();
  let options = h.validMoves(g, roll);
  return options;
});

summary(() => {
  Object.keys(Strategies).forEach((name) => {
    if (name == "random") return;
    bench(`apply ${name} to ${count} scenarios`, function () {
      let strategy = Strategies[name];
      scenarios.forEach((scenario) => {
        strategy(scenario);
      });
    });
  });
});

await run();
