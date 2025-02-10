import * as fc from "fast-check";
import { describe, it, expect, test } from "bun:test";
const xit = test.skip;
const xdescribe = test.skip;
import { arbitraryGame, expectGamesEqual } from "./helpers";

import { helpers as h, constants as c } from "../src/backgammon.ts";
import { useSpeedExpectimax, useExpectimax, useAbPruning } from "../src/strategy/strategies.ts";
import { evaluate, factors } from "../src/strategy/factors.ts";

// Property-based test
describe("Dice roll validity", () => {
  it("should always return two numbers between 1 and 6", () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const roll = h.generateRoll();
        expect(roll[0]).toBeGreaterThanOrEqual(1);
        expect(roll[0]).toBeLessThanOrEqual(6);
        expect(roll[1]).toBeGreaterThanOrEqual(1);
        expect(roll[1]).toBeLessThanOrEqual(6);
      }),
    );
  });
});

describe("validMoves direction", () => {
  it("should always move pieces in the correct direction", () => {
    fc.assert(
      fc.property(arbitraryGame, fc.constantFrom(...c.ALL_ROLLS), (game, roll) => {
        const moves = h.validMoves(game, roll);

        return moves.every(([move, _]) =>
          move.every((m) => {
            if (m === null) return true;
            const [start, end] = m;
            if (start === c.BAR) return true;
            if (end === c.HOME) return true;
            return game.turn === c.WHITE ? end > start : end < start;
          }),
        );
      }),
    );
  });
});

describe("validMoves blocked points", () => {
  it("should never move to a point with 2 or more opponent pieces", () => {
    fc.assert(
      fc.property(arbitraryGame, fc.constantFrom(...c.ALL_ROLLS), (game, roll) => {
        const moves = h.validMoves(game, roll);
        const opponent = game.turn === c.WHITE ? c.BLACK : c.WHITE;

        return moves.every(([move, _]) =>
          move.every((m) => {
            if (m === null || m[1] === c.HOME) return true;
            const [_, end] = m;
            const endPoint = game.positions[end];
            return (endPoint & opponent) === 0 || (endPoint & 0xf) < 2;
          }),
        );
      }),
    );
  });
});

describe("validMoves correct number of pieces", () => {
  it("should never move in such a way that either player has more or less than 15 pieces", () => {
    fc.assert(
      fc.property(arbitraryGame, fc.constantFrom(...c.ALL_ROLLS), (game, roll) => {
        const moves = h.validMoves(game, roll);
        const opponent = game.turn === c.WHITE ? c.BLACK : c.WHITE;

        return moves.every(([_, nextState]) => {
          const whiteCount = nextState.wBar + nextState.wHome + nextState.positions.reduce((sum, pos) => sum + (pos & c.WHITE ? pos & 0x0f : 0), 0);

          const blackCount = nextState.bBar + nextState.bHome + nextState.positions.reduce((sum, pos) => sum + (pos & c.BLACK ? pos & 0x0f : 0), 0);

          return whiteCount === 15 && blackCount === 15;
        });
      }),
    );
  });
});

describe("Bar entry priority", () => {
  it("should correctly handle moves based on the number of pieces on the bar", () => {
    fc.assert(
      fc.property(arbitraryGame, fc.constantFrom(...c.ALL_ROLLS), (game, roll) => {
        const moves = h.validMoves(game, roll);
        const currentPlayer = game.turn;
        const barCount = currentPlayer === c.WHITE ? game.wBar : game.bBar;

        return moves.every(([move, _]) => {
          let barMoves = 0;
          let nonBarMoves = 0;
          let total = 0;
          let totalNonNull = 0;

          move.forEach((movement) => {
            total++;
            if (movement !== null) {
              totalNonNull++;
              if (movement[0] === c.BAR) {
                barMoves++;
              } else {
                nonBarMoves++;
              }
            }
          });
          // have to have 2 or 4 die
          if (total != 2 && total != 4) {
            return false;
          }
          // can't move more off the bar than are on the bar
          if (barMoves > barCount) {
            return false;
          }

          const barCleared = barMoves == barCount;
          if (barCleared) {
            return nonBarMoves == totalNonNull - barMoves && nonBarMoves <= total - barCount;
          } else {
            return nonBarMoves == 0;
          }
        });
      }),
    );
  });
});

describe("ab pruning", () => {
  it("matches expectimax", () => {
    const evalFn = (g) => {
      const val = g.wHome * 10 - g.bHome * 10 + g.wBar * -50 + g.bBar * 50;
      return g.turn == c.WHITE ? val : -val;
    };
    const expectimax = useExpectimax(evalFn, 2);
    const abPruning = useAbPruning(evalFn, 2);
    fc.assert(
      fc.property(arbitraryGame, fc.constantFrom(...c.ALL_ROLLS), (game, roll) => {
        const moves = h.validMoves(game, roll);
        const currentPlayer = game.turn;

        const abResult = abPruning(moves);
        const expectiResult = expectimax(moves);

        expect(abResult).toEqual(expectiResult);
      }),
    );
  });
});

// const WHITE = 0b00010000;
// const BLACK = 0b00100000;
// bottom 4 bits are the position
function mirrorPositions(positions) {
  // convert back to Uint8Array
  return new Uint8Array(Array.from(positions)
    .reverse() // reverse the board
    .map(pos => {
      // flip the colors
      if (pos & c.WHITE) {
        return (pos & 0b1111) | c.BLACK
      } else if (pos & c.BLACK) {
        return (pos & 0b1111) | c.WHITE
      } else {
        return pos
      }
    }))
}

function mirror(game) {
  return {
    bBar: game.wBar,
    wBar: game.bBar,
    bHome: game.wHome,
    wHome: game.bHome,
    turn: game.turn == c.WHITE ? c.BLACK : c.WHITE,
    positions: mirrorPositions(game.positions),
    cube: 1,
  }
}

describe("mirror", async () => {
  it("should roundtrip", () => {
    fc.assert(fc.property(arbitraryGame, (game) => {
      expect(game).toEqual(mirror(mirror(game))); 
    }))
  })
})

describe("evaluate", async () => {
  it("is equivalent over a flip in player", () => {
    const evalFn = evaluate(factors.balancedFactors)
    fc.assert(
      fc.property(arbitraryGame, fc.constantFrom(...c.ALL_ROLLS), (game, roll) => {
        const score = evalFn(game, game.turn)
        const m = mirror(game)
        const mirrorScore = evalFn(m, m.turn);

        expect(score).toEqual(expect.closeTo(mirrorScore));
      }),
    );
  });
});
