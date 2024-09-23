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

  const second = (options: Result[]) => options && options[1];
  bench("second valid option", () => {
    playGame(second); 
  });

  const random = (options: Result[]) => options && options[Math.floor(Math.random() * options.length)];
  bench("random option", () => {
    playGame(random); 
  });

  const rands = [];
  const randlength = 50;
  for (let i = 0; i < randlength; i++) { rands.push(Math.floor(Math.random() * 1000)) }
  var randi = 0;
  const pseudorandom = (options: Result[]) => {
    if (!options) return null;
    randi++;
    if (randi > randlength) randi = 0;
    return options[rands[randi] % options.length]
  }

  bench("pseudorandom option", () => {
    playGame(pseudorandom);
  });
});

await run();
