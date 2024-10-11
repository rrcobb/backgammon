// allow compressing and decompressing game states
// allow compressing/decompressing a series of moves -- a game history
// reading and writing these to files
import { Player, Game, newGame } from "./game";

type TurnBinary = Uint8Array;
type GameHistory = Uint8Array;

// Bit Representation
// Inferred: home/borne off pieces, dice
// 1 byte - whose turn :/
// 1 byte - 8 bits: 2 bar representations: white and black counts - 4 bits each
// 1 bytes (5 bits): doubling cube - owner bit and value - 5 bits (3 empty bits after)
// 24 bytes (could be reduced to 15 bytes) - 24 positions, each has a color and count - 5 bits each, but 8 for comfort
const GAME_BYTES = 27;
const PLAYER_MASK = 0b10000;
const WHITE = 0b1;
const BLACK = 0b0;

export function toBinary(game: Game): TurnBinary {
  const result = new Uint8Array(GAME_BYTES);
  let byteIndex = 0;

  // Whose turn: a whole darn byte
  let currentTurn = game.turn;
  let turnByte = currentTurn === "w" ? WHITE : BLACK;
  result[byteIndex++] = turnByte;

  // bar: 4 bits white, then 4 bits black
  let whitebar = game.bar.filter((p) => p === "w").length;
  let blackbar = game.bar.filter((p) => p === "b").length;
  let barByte = (whitebar << 4) + blackbar;
  result[byteIndex++] = barByte;

  // doubling cube
  // TODO
  // currently, just push a 0 byte
  byteIndex++;

  // Positions
  for (let i = 0; i < game.positions.length; i++) {
    const p = game.positions[i];
    result[byteIndex++] = p.length > 0 ? ((p[0] === "w" ? WHITE : BLACK) << 4) | p.length : 0;
  }

  return result;
}

export function fromBinary(view: TurnBinary): Game {
  let game = newGame(); // default to a new game's settings
  let byteIndex = 0;
  // turn - byte 1
  game.turn = view[byteIndex++] == WHITE ? "w" : "b";

  // bar: doesn't perfectly roundtrip
  // the Game representation can mix the order of black and white in the bar -- maybe that's weird
  let barByte = view[byteIndex++];
  let blackBarCount = barByte & 0b11110000; // mask off white
  let whiteBarCount = barByte >> 4; // top 4 bits
  game.bar = [...new Array(blackBarCount).fill("b"), ...new Array(whiteBarCount).fill("w")];

  // cube
  // TODO: when we do the cube...
  game.cube = 1;
  byteIndex++;

  // positions
  game.positions = new Array(24).fill(null).map((_) => []);
  for (let pos of game.positions) {
    let byte = view[byteIndex++];
    let player = (byte & PLAYER_MASK) >> 4 == WHITE ? "w" : "b";
    let count = byte & ~PLAYER_MASK;
    pos.push(...Array(count).fill(player));
  }

  // reconstruct home
  let wCount = 0;
  let bCount = 0;
  for (let p of game.bar) {
    if (p == "w") {
      wCount++;
    } else {
      bCount++;
    }
  }
  for (let pos of game.positions) {
    for (let p of pos) {
      if (p == "w") {
        wCount++;
      } else {
        bCount++;
      }
    }
  }
  game.wHome = Array(15 - wCount).fill("w");
  game.bHome = Array(15 - bCount).fill("b");

  return game;
}

export function gameHistory(turns: TurnBinary[]): GameHistory {
  if (turns.length > 0 && turns[0].byteLength != GAME_BYTES) {
    throw new Error("turns bytelength is wrong");
  }

  let totalByteLength = turns.length * GAME_BYTES;
  let view = new Uint8Array(totalByteLength);
  let offset = 0;
  for (let t of turns) {
    view.set(new Uint8Array(t), offset);
    offset += GAME_BYTES;
  }

  return view;
}

// Compression
// uses bun's zlib deflate
export function compress(binary: Uint8Array): Uint8Array {
  return Bun.deflateSync(binary);
}

export function decompress(compressed: Uint8Array): Uint8Array {
  return Bun.inflateSync(compressed);
}
