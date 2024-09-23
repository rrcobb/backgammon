import { run, bench, compact, group } from "mitata"
import { newGame, cloneGame, movesString, movesStringCustom, validMoves, checkWinner, generateRoll, takeTurn, WHITE, BLACK } from '../src/backgammon.ts'

compact(() => {
  const initial = newGame();
  initial.turn = WHITE;

  bench("generate roll", () => {
    generateRoll();
  });
  
  bench("calculate valid moves", () => {
    let roll = generateRoll();
    validMoves(initial, roll);
  });

  group(() => {
    bench("newgame", () => {
      const game = newGame();
    });

    bench("cloneGame", () => {
      cloneGame(initial);
    });
  })
});

await run();
