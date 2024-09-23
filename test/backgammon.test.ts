import {test, expect, describe} from "bun:test"
import { BAR, HOME, BLACK, WHITE, newGame, validMoves, apply, cloneGame, checkWinner, generateRoll, takeTurn } from '../src/backgammon.ts';

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

  test("roll of [3,1], black has 14 ways to play it", () => {
    let roll = [3,1]
    expect(game).toEqual(blackWithSeveralMoves());
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(14);
    expect(setify(moves.map(([m, _]) => m))).toEqual(
      setify([ 
        [[23,20],[20,19]],
        [[12,9],[9,8]],
        [[23,20],[7,6]],
        [[12,9],[7,6]],
        [[7,4],[7,6]],
        [[7,6],[7,4]],
        [[23,20],[5,4]],
        [[12,9],[5,4]],
        [[7,4],[5,4]],
        [[7,6],[5,2]],
        [[5,2],[5,4]],
        [[5,4],[5,2]],
        [[5,4],[4,1]],
        [[5,2],[2,1]],
      ])
    );
  })
});

function whiteToBearOff(): Game {
  let game = newGame();
  game.positions[0] = 0;
  game.positions[11] = 0;
  game.positions[16] = 0;
  game.positions[18] = 0;
  game.positions[19] = WHITE | 5;
  game.positions[20] = WHITE | 5;
  game.positions[21] = WHITE | 5;
  game.turn = WHITE;
  return game;
}


describe("white bearing off", () => {
  let game = whiteToBearOff();

  test("with [5,4] can bear off two (only)", () => {
    let roll = [5,4];
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(2);
    expect(setify(moves.map(([m, _]) => m))).toEqual(
      setify([
        [[19, HOME], [20, HOME]],
        [[20, HOME], [19, HOME]],
      ])
    );
  })

  test("with [6,5] can bear off 5 and any other", () => {
    let roll = [6,5];
    let moves = validMoves(game, roll);
    expect(moves.length).toEqual(3);
    expect(setify(moves.map(([m, _]) => m))).toEqual(
      setify([
        [[19, HOME], [19, HOME]],
        [[20, HOME], [19, HOME]],
        [[21, HOME], [19, HOME]],
      ])
    );
  })
});


describe("a complete game by picking the first valid move", () => {
  test("eventually finishes", () => {
    const s = (options: Result[]) => options && options[0];
    let game = newGame();
    game.turn = WHITE;
    let turnCount = 0;
    while(!checkWinner(game)) {
      const roll = generateRoll();
      game = takeTurn(game, roll, s);
    }
    expect(checkWinner(game)).toBeTruthy()
  });
});
