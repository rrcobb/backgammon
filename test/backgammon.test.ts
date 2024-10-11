import { test, expect, describe } from "bun:test";
import { constants as c, helpers as h } from "../src/backgammon.ts";

function blackToEnter(): Game {
  // fiction: black has two on the bar, and white has made 3 points
  let game = h.newGame();
  game.positions[5] = c.BLACK | 3;
  game.bBar = 2;
  game.positions[16] = c.WHITE | 2;
  game.positions[18] = c.WHITE | 2;
  game.positions[19] = c.WHITE | 2;
  game.positions[20] = c.WHITE | 2;

  game.turn = c.BLACK;
  return game;
}

describe("black to enter 2 from the bar, with white blocking", () => {
  let game = blackToEnter(); // setup

  test("roll of [6,6], black can't move", () => {
    let roll = [6, 6];
    let moves = h.validMoves(game, roll);
    expect(moves).toEqual([[[null, null], game]]);
  });

  test("roll of [3,4], black can move only the 3", () => {
    let roll = [3, 4];
    let after = h.cloneGame(game);
    h.apply(after, [c.BAR, 21], c.BLACK, c.WHITE);

    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(1);
    let [move, next] = moves[0];
    expect(move).toEqual([[c.BAR, 21], null]);
    expect(next).toEqual(after);
    expect(next.bBar).toEqual(1);
  });

  test("roll of [1,2], black has one entrance", () => {
    let roll = [1, 2];
    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(1);
    expect(moves[0][0][0]).toEqual([c.BAR, 23]);
    expect(moves[0][0][1]).toEqual([c.BAR, 22]);
  });

  test("roll of [1,1], black enters and moves", () => {
    let roll = [1, 1];
    let moves = h.validMoves(game, roll);
    expect(moveset(moves)).toEqual(
      setify([
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [23, 22],
          [23, 22],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [23, 22],
          [22, 21],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [23, 22],
          [7, 6],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [7, 6],
          [7, 6],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [7, 6],
          [6, 5],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [23, 22],
          [5, 4],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [7, 6],
          [5, 4],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [5, 4],
          [5, 4],
        ],
        [
          [c.BAR, 23],
          [c.BAR, 23],
          [5, 4],
          [4, 3],
        ],
      ]),
    );
  });
});

function blackWithSeveralMoves() {
  let game = h.newGame();

  // start point to black's 4 point
  game.positions[0] = 0;
  game.positions[3] = c.WHITE | 2;

  // white's 2 and 3 points
  game.positions[16] = c.WHITE | 2;
  game.positions[18] = c.WHITE | 2;
  game.positions[21] = c.WHITE | 2;
  game.positions[22] = c.WHITE | 2;

  game.turn = c.BLACK;
  return game;
}

const moveset = (rs) => setify(rs.map(([m, _]) => m));
const setify = (moveListList) => new Set(moveListList.map(JSON.stringify));

describe("black with several options", () => {
  let game = blackWithSeveralMoves();

  test("roll of [1,2], black has 2*2 places to go", () => {
    let roll = [1, 2];
    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(8);
    expect(moveset(moves)).toEqual(
      setify([
        [
          [12, 10],
          [10, 9],
        ],
        [
          [12, 10],
          [7, 6],
        ],
        [
          [7, 6],
          [7, 5],
        ],
        [
          [7, 6],
          [6, 4],
        ],
        [
          [12, 10],
          [5, 4],
        ],
        [
          [7, 5],
          [7, 6],
        ],
        [
          [7, 5],
          [5, 4],
        ],
        [
          [5, 4],
          [4, 2],
        ],
      ]),
    );
    expect(game).toEqual(blackWithSeveralMoves());
  });

  test("roll of [2,2], black has 11 ways to play it", () => {
    let roll = [2, 2];
    expect(game).toEqual(blackWithSeveralMoves());
    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(11);
    expect(moveset(moves)).toEqual(
      setify([
        [
          [12, 10],
          [12, 10],
          [12, 10],
          [12, 10],
        ],
        [
          [12, 10],
          [12, 10],
          [12, 10],
          [10, 8],
        ],
        [
          [12, 10],
          [12, 10],
          [10, 8],
          [10, 8],
        ],
        [
          [12, 10],
          [12, 10],
          [10, 8],
          [8, 6],
        ],
        [
          [12, 10],
          [12, 10],
          [12, 10],
          [7, 5],
        ],
        [
          [12, 10],
          [12, 10],
          [10, 8],
          [7, 5],
        ],
        [
          [12, 10],
          [10, 8],
          [8, 6],
          [7, 5],
        ],
        [
          [12, 10],
          [12, 10],
          [7, 5],
          [7, 5],
        ],
        [
          [12, 10],
          [10, 8],
          [7, 5],
          [7, 5],
        ],
        [
          [12, 10],
          [7, 5],
          [7, 5],
          [7, 5],
        ],
        [
          [12, 10],
          [10, 8],
          [8, 6],
          [6, 4],
        ],
      ]),
    );
  });

  test("roll of [3,1], black has 14 ways to play it", () => {
    let roll = [3, 1];
    expect(game).toEqual(blackWithSeveralMoves());
    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(14);
    expect(moveset(moves)).toEqual(
      setify([
        [
          [23, 20],
          [20, 19],
        ],
        [
          [12, 9],
          [9, 8],
        ],
        [
          [23, 20],
          [7, 6],
        ],
        [
          [12, 9],
          [7, 6],
        ],
        [
          [7, 4],
          [7, 6],
        ],
        [
          [7, 6],
          [7, 4],
        ],
        [
          [23, 20],
          [5, 4],
        ],
        [
          [12, 9],
          [5, 4],
        ],
        [
          [7, 4],
          [5, 4],
        ],
        [
          [7, 6],
          [5, 2],
        ],
        [
          [5, 2],
          [5, 4],
        ],
        [
          [5, 4],
          [5, 2],
        ],
        [
          [5, 4],
          [4, 1],
        ],
        [
          [5, 2],
          [2, 1],
        ],
      ]),
    );
  });
});

function blackFinalBearingOff(): Game {
  let game = h.newGame();
  // black with 6 on his 1 point
  game.positions = new Uint8Array([38, 17, 0, 0, 0, 0, 0, 0, 0, 0, 17, 0, 19, 0, 17, 17, 0, 0, 0, 0, 20, 18, 0, 18]);
  game.bHome = 9;
  game.turn = c.BLACK;
  return game;
}

describe("black bearing off", () => {
  test("can roll off 2 pieces with 6,2", () => {
    let game = blackFinalBearingOff();
    expect(h.isBearingOff(game.turn, game)).toEqual(true);
    let roll = [6, 2];
    let moves = h.validMoves(game, roll);
    expect(moveset(moves)).toEqual(
      setify([
        [
          [0, c.HOME],
          [0, c.HOME],
        ],
      ]),
    );
  });
});

function whiteToBearOff(): Game {
  let game = h.newGame();
  game.positions[0] = 0;
  game.positions[11] = 0;
  game.positions[16] = 0;
  game.positions[18] = 0;
  game.positions[19] = c.WHITE | 5;
  game.positions[20] = c.WHITE | 5;
  game.positions[21] = c.WHITE | 5;
  game.turn = c.WHITE;
  return game;
}

describe("white bearing off", () => {
  let game = whiteToBearOff();
  test("with [5,4] can bear off two", () => {
    let roll = [5, 4];
    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(2);
    expect(moveset(moves)).toEqual(
      setify([
        [
          [19, c.HOME],
          [20, c.HOME],
        ],
        [
          [20, c.HOME],
          [19, c.HOME],
        ],
      ]),
    );
  });

  test("with [6,5] can bear off 5 and any other", () => {
    let roll = [6, 5];
    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(3);
    expect(moveset(moves)).toEqual(
      setify([
        [
          [19, c.HOME],
          [19, c.HOME],
        ],
        [
          [20, c.HOME],
          [19, c.HOME],
        ],
        [
          [21, c.HOME],
          [19, c.HOME],
        ],
      ]),
    );
  });
});

describe("a complete game by picking the first valid move", () => {
  test("eventually finishes", () => {
    const s = (options: Result[]) => options && options[0];
    let game = h.newGame();
    game.turn = c.WHITE;
    let turnCount = 0;
    while (!h.checkWinner(game)) {
      const roll = h.generateRoll();
      let result = h.takeTurn(game, roll, s);
      game = result[1];
    }
    expect(h.checkWinner(game)).toBeTruthy();
  });
});

function whiteToWin(): Game {
  let game = h.newGame();
  game.positions[0] = 0;
  game.positions[11] = 0;
  game.positions[16] = 0;
  game.positions[18] = 0;
  game.positions[22] = c.WHITE | 1;
  game.wHome = 14;
  game.turn = c.WHITE;
  return game;
}

describe("when white wins in one move", () => {
  test("only one thing left...", () => {
    let game = whiteToWin();
    let roll = [6, 5];
    let moves = h.validMoves(game, roll);
    expect(moves.length).toEqual(1);
    expect(moveset(moves)).toEqual(setify([[[22, c.HOME]]]));
    expect(h.checkWinner(moves[0][1])).toEqual(c.WHITE);
  });
});
