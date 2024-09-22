import {test, expect, describe} from "bun:test"
import { BAR, BLACK, WHITE, newGame, validMoves, apply, cloneGame} from '../src/backgammon.ts';

function blackToEnter(): Game {
  // fiction: black has two on the bar, and white has made 3 points
  let game = newGame();
  game.positions[5] = BLACK | 3;
  game.bBar = 2;
  game.positions[16] = WHITE | 2;
  game.positions[18] = WHITE | 2;
  game.positions[19] = WHITE | 2;
  game.positions[20] = WHITE | 2;

  game.turn = BLACK;
  return game;
}

describe("black to enter 2 from the bar, with white blocking", () => {
  let game = blackToEnter(); // setup

  test("roll of [6,6], black can't move", () => {
    let roll = [6,6]
    let moves = validMoves(game, roll);
    expect(moves).toEqual([[null, null], game]);
  });

  test("roll of [3,4], black can move only the 3", () => {
    let roll = [3,4]
    let moves = validMoves(game, roll);
    // expect(moves.length).toEqual(1);
    let after = cloneGame(game);
    apply(after, [BAR, 21], BLACK, WHITE);
    expect(moves).toEqual([[[BAR, 21], null], after]);
  });

  test("roll of [1,2], black has one entrance", () => {
    let roll = [1,2]
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(1);
    expect(moves[0][0][0]).toEqual([BAR, 23]);
    expect(moves[0][0][1]).toEqual([BAR, 22]);
  })
})
