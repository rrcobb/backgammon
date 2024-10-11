import { run, bench, compact, summary, group } from "mitata"
import { helpers as h, constants as c } from '../src/backgammon.ts';

compact(() => {
  const initial = h.newGame();
  initial.turn = c.WHITE;

  bench("generate roll", () => {
    h.generateRoll();
  });
  
  bench("calculate valid moves", () => {
    let roll = h.generateRoll();
    h.validMoves(initial, roll);
  });
});

summary(() => {
  const min = (a, b) => a <= b ? a : b;

  const pairs = [[4,5], [1,2], [100,200], [0,0]]
  
  bench("custom min", () => {
    for (let [a,b] of pairs) {
      min(a,b)
    }
  })

  bench("Math.min", () => {
    for (let [a,b] of pairs) {
      Math.min(a,b)
    }
  })
})

await run();
