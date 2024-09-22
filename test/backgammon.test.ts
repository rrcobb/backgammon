import {test, expect, describe} from "bun:test"
import { BAR, BLACK, WHITE, newGame, validMoves, apply, cloneGame} from '../src/backgammon.ts';

function blackToEnter(): Game { // fiction: black has two on the bar, and white has made 3 points
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
    expect(moves).toEqual([[[null, null], game]]);
  });

  test("roll of [3,4], black can move only the 3", () => {
    let roll = [3,4]
    let after = cloneGame(game);
    apply(after, [BAR, 21], BLACK, WHITE);

    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(1);
    let [move, next] = moves[0]
    expect(move).toEqual([[BAR, 21], null]);
    expect(next).toEqual(after); 
    expect(next.bBar).toEqual(1);
  });

  test("roll of [1,2], black has one entrance", () => {
    let roll = [1,2]
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(1);
    expect(moves[0][0][0]).toEqual([BAR, 23]);
    expect(moves[0][0][1]).toEqual([BAR, 22]);
  })
})

function blackWithSeveralMoves() {
  let game = newGame();

  // start point to black's 4 point
  game.positions[0] = 0;
  game.positions[3] = WHITE | 2;

  // white's 2 and 3 points
  game.positions[16] = WHITE | 2;
  game.positions[18] = WHITE | 2;
  game.positions[21] = WHITE | 2;
  game.positions[22] = WHITE | 2;

  game.turn = BLACK;
  return game;
}

const setify = (moveListList) => new Set(moveListList.map(JSON.stringify));

describe("black with several options", () => {
  let game = blackWithSeveralMoves();

  test("roll of [1,2], black has 2*2 places to go", () => {
    let roll = [1,2]
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(8);
    expect(setify(moves.map(([m, _]) => m)))
    .toEqual(
      setify([
        [[12,10], [10,9]],
        [[12,10], [7,6]],
        [[7,6], [7,5]],
        [[7,6], [6,4]],
        [[12,10], [5,4]],
        [[7,5], [7,6]],
        [[7,5], [5,4]],
        [[5,4], [4,2]]
      ])
    );
    expect(game).toEqual(blackWithSeveralMoves());
  })

  test("roll of [2,2], black has 11 ways to play it", () => {
    let roll = [2,2]
    expect(game).toEqual(blackWithSeveralMoves());
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(11);
    expect(setify(moves.map(([m, _]) => m))).toEqual(
      setify([ 
        [[12, 10], [12,10], [12,10], [12,10]],
        [[12, 10], [12,10], [12,10], [10,8]],
        [[12, 10], [12,10], [10,8], [10,8]],
        [[12, 10], [12,10], [10,8], [8,6]],
        [[12, 10], [12,10], [12,10], [7,5]],
        [[12, 10], [12,10], [10,8], [7,5]],
        [[12, 10], [10,8], [8,6], [7,5]],
        [[12, 10], [12,10], [7,5], [7,5]],
        [[12, 10], [10,8], [7,5], [7,5]],
        [[12, 10],[7,5], [7,5], [7,5]],
        [[12, 10], [10,8], [8,6], [6,4]],
      ])
    );
  })
});
