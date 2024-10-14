import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata";
import { constants as c, helpers as h } from "../src/backgammon.ts";
import { Strategies, counts } from "../src/strategies";
import { genRolls } from "../test/helpers.ts";

const rolls = genRolls(1000);

(() => {
  const LIMIT = 1e5;
  const playGame = (s) => {
    let rollCounter = 0;
    const getRoll = () => {
      if (rollCounter >= rolls.length) {
        rollCounter = 0;
      }
      return rolls[rollCounter++];
    };
    let game = h.newGame();
    game.turn = c.WHITE;
    let turnCount = 0;
    while (!h.checkWinner(game)) {
      const roll = getRoll();
      const [move, next] = h.takeTurn(game, roll, s);
      game = next;
      turnCount++;
      if (turnCount > LIMIT) 1 / 0;
    }
  };

  Object.entries(Strategies).map(([name, strategy]) => {
    if (name == "random") return;
    bench(`${name} whole game`, () => {
      playGame(strategy);
    });
  });
})();

await run();
console.log(JSON.stringify(counts));
