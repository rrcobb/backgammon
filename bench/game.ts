import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata"
import { newGame, cloneGame, validMoves, checkWinner, generateRoll, takeTurn, WHITE, BLACK } from '../src/backgammon.ts'
import { Strategies } from '../src/strategies'

summary(() => {
  const LIMIT = 1e5;
  const playGame = (s) => {
    let game = newGame();
    game.turn = WHITE;
    let turnCount = 0;
    while(!checkWinner(game)) {
      const roll = generateRoll();
      const [move, next] = takeTurn(game, roll, s);
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
