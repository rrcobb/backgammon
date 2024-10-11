import { run, bench, boxplot, barplot, lineplot, compact, summary, group } from "mitata"
import { constants as c, helpers as h } from '../src/backgammon.ts'
import { genGame } from '../test/helpers'
import { Strategies } from '../src/strategies'

compact(() => {
  bench('genGame', () => {
    genGame();
  });

  bench('generateRoll', () => {
    h.generateRoll();
  });

  // conceptually: this happens for each strategy run
  // so, subtract it (and the apply step) from the strategy time
  bench('game + roll + validMoves', () => {
    const game = genGame();
    const roll = h.generateRoll();
    h.validMoves(game, roll);
  });
})

summary(() => {
  const strategyTurn = (s) => {
    let game = genGame();
    let roll = h.generateRoll();
    const [move, next] = h.takeTurn(game, roll, s);
  }

  Object.entries(Strategies).map(([name, strategy]) => {
    bench(`${name} one turn`, () => {
      strategyTurn(strategy)
    })
  });
});

await run();
