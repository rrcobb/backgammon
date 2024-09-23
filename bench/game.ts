import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata"
import { newGame, cloneGame, validMoves, checkWinner, generateRoll, takeTurn, WHITE, BLACK } from '../src/backgammon.ts'

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

  const first = (options: Result[]) => options && options[0];
  bench("first valid option", () => {
    playGame(first); 
  });

  const second = (options: Result[]) => options && options[1] || options[0];
  bench("second valid option", () => {
    playGame(second); 
  });

  const last = (options: Result[]) => options && options[options.length - 1];
  bench("last valid option", () => {
    playGame(last); 
  });

  const random = (options: Result[]) => options && options[Math.floor(Math.random() * options.length)];
  bench("random option", () => {
    playGame(random); 
  });

  
  var randi = 0;
  const pseudorandom = (options: Result[]) => {
    return options && options[(randi++) % options.length]
  }
  bench("pseudorandom option", () => {
    playGame(pseudorandom);
  });

  var i = 0;
  const cheapmod = (options: Result[]) => {
    i = (i & 0b00011111) + 1;
    const index = i ^ options.length;
    return options && options[index]
  }
  bench("cheap modulo option", () => {
    playGame(cheapmod);
  });

});

await run();
