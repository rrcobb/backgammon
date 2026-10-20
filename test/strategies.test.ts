import { test, expect, describe } from "bun:test";
import type { Game, Player, Result, Roll } from "../src/backgammon";
import { constants as c, helpers as h } from "../src/backgammon";
import { useExpectimax, useSpeedExpectimax } from "../src/strategy/strategies";

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
  game.positions.fill(0); // Clear the board
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

  // spreading to the 6, 5, and 4 points bears off more on the next roll
  // (13.25 expected wHome) than stacking three on the 5 point (12.89)
  expect(result[0]).toEqual([
    [19, 20],
    [18, c.HOME],
  ]);
});

test("Expectimax chooses optimal move with some risk when bearing off", () => {
  const game = h.newGame();
  game.turn = c.WHITE;
  game.positions.fill(0);
  game.positions[18] = c.WHITE | 1; // White's 6-point
  game.positions[19] = c.WHITE | 1; // White's 5-point
  game.positions[20] = c.BLACK | 2; // White's 4-point
  game.positions[21] = c.WHITE | 1; // White's 3-point
  game.wHome = 12;
  game.bHome = 13;

  // very averse to getting hit
  const evalFn = (g: Game) => {
    if (g.wBar) return -100;
    return g.wHome - g.bHome;
  };
  // depth 2 scores the position right after black's reply; at depth 3 white
  // would re-enter from the bar before the leaf, and the hit wouldn't count
  const expectimax = useExpectimax(evalFn, 2);

  const roll: Roll = [3, 5];
  const moves = h.validMoves(game, roll);

  const result = expectimax(moves);

  expect(result[0]).toEqual([
    [18, 21],
    [19, c.HOME],
  ]);
});

describe("searches let the opponent move", () => {
  // the game in a Result still has turn set to the player who just moved,
  // so a search that doesn't switch turns has white moving twice
  const blackPositions = (g: Game) => Array.from(g.positions).map((p) => (p & c.BLACK ? p : 0));

  const searches = {
    expectimax: (evalFn) => useExpectimax(evalFn, 2),
    speedExpectimax: (evalFn) => useSpeedExpectimax(evalFn, 2, 21, 100),
  };

  for (const [name, make] of Object.entries(searches)) {
    test(name, () => {
      const game = h.newGame();
      game.turn = c.WHITE;
      const start = blackPositions(game);

      const leaves: { game: Game; player: Player }[] = [];
      const spy = (g: Game, player: Player) => {
        leaves.push({ game: g, player });
        return 0;
      };
      make(spy)(h.validMoves(game, [3, 1]));

      expect(leaves.length).toBeGreaterThan(0);
      // every leaf is scored for white, the player choosing at the root
      expect(leaves.every((l) => l.player === c.WHITE)).toBe(true);
      // and black has moved in every leaf
      expect(leaves.every((l) => JSON.stringify(blackPositions(l.game)) !== JSON.stringify(start))).toBe(true);
    });
  }
});
