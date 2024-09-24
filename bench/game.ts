import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata"
import { newGame, cloneGame, validMoves, checkWinner, generateRoll, takeTurn, WHITE, BLACK } from '../src/backgammon.ts'
import { first, second, last, random, pseudorandom, cheapmod } from '../src/strategies'

summary(() => {
  const LIMIT = 1e5;
  const playGame = (s) => {
    let game = newGame();
    game.turn = WHITE;
    let turnCount = 0;
    while(!checkWinner(game)) {
      const roll = generateRoll();
      game = takeTurn(game, roll, s);
      turnCount++;
      if (turnCount > LIMIT) break;
    }
  }

  bench("first valid option", () => {
    playGame(first); 
  });

  bench("second valid option", () => {
    playGame(second); 
  });

  bench("last valid option", () => {
    playGame(last); 
  });

  bench("random option", () => {
    playGame(random); 
  });

  bench("pseudorandom option", () => {
    playGame(pseudorandom);
  });

  bench("cheap modulo option", () => {
    playGame(cheapmod);
  });
});

await run();
