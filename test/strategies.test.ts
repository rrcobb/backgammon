import { test, expect, describe } from "bun:test";
import type { Game, Result } from '../src/backgammon';
import { constants as c, helpers as h } from '../src/backgammon'
import { useExpectimax } from '../src/strategies';

test("Two-option expectimax", () => {
  const simpleEval = (game: Game) => game.wHome - game.bHome;
  const expectimax = useExpectimax(simpleEval, 2);

  const testGame = h.newGame();
  testGame.turn = c.WHITE;

  const move1 = [null, h.cloneGame(testGame)];
  move1[1].wHome = 1;
  const move2 = [null, h.cloneGame(testGame)];
  move2[1].wHome = 2;

  const result = expectimax([move1, move2]);

  expect(result).toEqual(move2);
});

test("Expectimax chooses optimal move", () => {
  const game = h.newGame();
  game.turn = c.WHITE;
  game.positions.fill(0);  // Clear the board
  game.positions[18] = c.WHITE | 2; // White 6 point
  game.positions[19] = c.WHITE | 2; // White 5 point
  game.positions[5] = c.BLACK | 2; // some home board position
  game.wHome = 11;
  game.bHome = 13;
  
  const evalFn = (g: Game) => g.wHome - g.bHome;
  const expectimax = useExpectimax(evalFn, 3);
  
  const roll: Roll = [6, 1];
  const moves = h.validMoves(game, roll);
  
  const result = expectimax(moves);
  
  expect(result[0]).toEqual([[18, 19], [18, c.HOME]]);
});

test("Expectimax chooses optimal move with some risk when bearing off", () => {
  const game = h.newGame();
  game.turn = c.WHITE;
  game.positions.fill(0);
  game.positions[18] = c.WHITE | 1;  // White's 6-point
  game.positions[19] = c.WHITE | 1;  // White's 5-point
  game.positions[20] = c.BLACK | 2;  // White's 4-point
  game.positions[21] = c.WHITE | 1;  // White's 3-point
  game.wHome = 12;
  game.bHome = 13; 

  // very averse to getting hit
  const evalFn = (g: Game) => {
    if (g.wBar) return -100;
    return g.wHome - g.bHome
  };
  const expectimax = useExpectimax(evalFn, 3);

  const roll: Roll = [3, 5];
  const moves = h.validMoves(game, roll);
  
  const result = expectimax(moves);
  
  expect(result[0]).toEqual([[18, 21], [19, c.HOME]]);
});
