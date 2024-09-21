import {test, expect, describe} from "bun:test"
import { BAR, BLACK, WHITE, newGame, validMoves } from './src/backgammon';

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
}

describe("black to enter, with white blocking", () => {
  let game = blackToEnter(); // setup

  test("roll of 6s, black can't move", () => {
    let roll = [6,6]
    let moves = validMoves(game, roll);
    expect(moves).toEqual([[null, null], game]);
  });

  test("roll of [1,2], black has one entrance", () => {
    let roll = [1,2]
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(1);
    expect(moves[0][0]).toEqual([BAR, 1]);
    expect(moves[0][1]).toEqual([BAR, 2]);
  })
})
