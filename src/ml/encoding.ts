import { constants as c } from "../backgammon";
import type { Game, Player } from "../backgammon";

/*
  The TD-Gammon input encoding: 198 units.

  For each of the 24 points and each player, 4 units for the checker count n:
  n >= 1, n >= 2, n >= 3, and (n - 3) / 2 for the checkers beyond 3.
  That's 192. Then, for each player, the checkers on the bar (n / 2) and the
  checkers borne off (n / 15), and two units for whose turn it is.

  Points are in board index order (white moves from 0 to 23), so the encoding
  is absolute rather than from the mover's side; the turn units say who's on roll.
*/

const INPUT_SIZE = 198;

const OFFSET = {
  white: 0, // 24 points x 4
  black: 96, // 24 points x 4
  wBar: 192,
  bBar: 193,
  wHome: 194,
  bHome: 195,
  whiteToMove: 196,
  blackToMove: 197,
};

function encodePoint(out: Float32Array, at: number, n: number) {
  out[at] = n >= 1 ? 1 : 0;
  out[at + 1] = n >= 2 ? 1 : 0;
  out[at + 2] = n >= 3 ? 1 : 0;
  out[at + 3] = n > 3 ? (n - 3) / 2 : 0;
}

// `onRoll` is the player who rolls next
function encode(game: Game, onRoll: Player, out = new Float32Array(INPUT_SIZE)): Float32Array {
  for (let i = 0; i < 24; i++) {
    const pos = game.positions[i];
    const n = pos & 0b1111;
    encodePoint(out, OFFSET.white + i * 4, (pos & c.WHITE) === c.WHITE ? n : 0);
    encodePoint(out, OFFSET.black + i * 4, (pos & c.BLACK) === c.BLACK ? n : 0);
  }
  out[OFFSET.wBar] = game.wBar / 2;
  out[OFFSET.bBar] = game.bBar / 2;
  out[OFFSET.wHome] = game.wHome / 15;
  out[OFFSET.bHome] = game.bHome / 15;
  out[OFFSET.whiteToMove] = onRoll === c.WHITE ? 1 : 0;
  out[OFFSET.blackToMove] = onRoll === c.BLACK ? 1 : 0;
  return out;
}

// a short name for each input unit, for looking at weights
function inputName(unit: number): string {
  if (unit < 192) {
    const side = unit < 96 ? "white" : "black";
    const i = Math.floor((unit % 96) / 4);
    const which = ["n>=1", "n>=2", "n>=3", "(n-3)/2"][unit % 4];
    return `${side} index ${i} ${which}`;
  }
  return ["white bar", "black bar", "white off", "black off", "white to move", "black to move"][unit - 192];
}

export { encode, inputName, INPUT_SIZE, OFFSET };
