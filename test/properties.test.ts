import * as fc from 'fast-check';
import { helpers as h, constants as c} from '../src/backgammon.ts';

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
      })
    );
  });
});

// generate a number from 0-25
// 0-23 are the positions 24 is bar, 25 is home
const playerPieces = fc.array(fc.nat(25), {minLength: 15, maxLength: 15});

// map to the players' game positions 15 times
const arbitraryGame = fc
  .tuple(playerPieces, playerPieces, fc.oneof(fc.constant(c.WHITE), fc.constant(c.BLACK)))
  .map(([firstPieces, secondPieces, first]) => {
    let oneBar = 0, twoBar = 0, oneHome = 0, twoHome = 0;
    const positions = new Uint8Array(24);
    const second = (first == c.WHITE) ? c.BLACK : c.WHITE;

    for (let index of firstPieces) {
      if (index == 24) { oneBar++; continue }
      if (index == 25) { oneHome++; continue }
      positions[index] |= first;
      positions[index] += 1;
    }

    for (let index of secondPieces) {
      if (index == 24) { twoBar++; continue }
      if (index == 25) { twoHome++; continue }
      // if the first player has a piece in this spot, wrapping add
      while(positions[index] & first) {
        index++;
        if (index > 23) {
          index = 0;
        }
      }
      positions[index] |= second;
      positions[index] += 1;
    }

    let bBar, wBar, bHome, wHome;
    if (first == c.WHITE) {
      wBar = oneBar; wHome = oneHome; bBar = twoBar; bHome = twoHome; 
    } else {
      bBar = oneBar; bHome = oneHome; wBar = twoBar; wHome = twoHome; 
    }

    return {
      bBar,
      wBar,
      bHome,
      wHome,
      positions,
      turn: first,
      cube: 1
    }
  });


describe("validMoves direction", () => {
  it("should always move pieces in the correct direction", () => {
    fc.assert(
      fc.property(arbitraryGame, fc.constantFrom(...c.ALL_ROLLS), (game, roll) => {
        const moves = h.validMoves(game, roll);
        
        return moves.every(([move, _]) => 
          move.every(m => {
            if (m === null) return true;
            const [start, end] = m;
            if (start === c.BAR) return true;
            if (end === c.HOME) return true;
            return game.turn === c.WHITE ? end > start : end < start;
          })
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
          move.every(m => {
            if (m === null || m[1] === c.HOME) return true;
            const [_, end] = m;
            const endPoint = game.positions[end];
            return (endPoint & opponent) === 0 || (endPoint & 0xF) < 2;
          })
        );
      })
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
          const whiteCount = nextState.wBar + 
            nextState.wHome + 
            nextState.positions.reduce(
              (sum, pos) => sum + ((pos & c.WHITE) ? (pos & 0x0F) : 0), 0);

          const blackCount = nextState.bBar +
            nextState.bHome + 
            nextState.positions.reduce(
              (sum, pos) => sum + ((pos & c.BLACK) ? (pos & 0x0F) : 0), 0);
          
          return whiteCount === 15 && blackCount === 15;
        });
      })
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

          move.forEach(movement => {
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
          if (total != 2 && total != 4) { return false }
          // can't move more off the bar than are on the bar
          if (barMoves > barCount) { return false }

          const barCleared = (barMoves == barCount);
          if (barCleared) {
            return (nonBarMoves == totalNonNull - barMoves) &&
              (nonBarMoves <= total - barCount);
          } else {
            return nonBarMoves == 0;
          }
        });
      })
    );
  });
});
