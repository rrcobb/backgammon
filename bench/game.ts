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

  bench("first valid option", () => {
    playGame(Strategies.first); 
  });

  bench("second valid option", () => {
    playGame(Strategies.second); 
  });

  bench("last valid option", () => {
    playGame(Strategies.last); 
  });

  bench("random option", () => {
    playGame(Strategies.random); 
  });

  bench("pseudorandom option", () => {
    playGame(Strategies.pseudorandom);
  });

  bench("cheap modulo option", () => {
    playGame(Strategies.cheapmod);
  });

  bench("safety-focused eval fn", () => {
    playGame(Strategies.safety);
  });
});

await run();
