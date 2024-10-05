import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata"
import { constants as c, helpers as h } from '../src/backgammon.ts'
import { Strategies } from '../src/strategies'

summary(() => {
  const LIMIT = 1e5;
  const playGame = (s) => {
    let game = h.newGame();
    game.turn = c.WHITE;
    let turnCount = 0;
    while(!h.checkWinner(game)) {
      const roll = h.generateRoll();
      const [move, next] = h.takeTurn(game, roll, s);
      game = next
      turnCount++;
      if (turnCount > LIMIT) break;
    }
  }

  Object.entries(Strategies).map(([name, strategy]) => {
    bench(`${name} whole game`, () => {
      playGame(strategy)
    })
  });
});

await run();
