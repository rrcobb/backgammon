/*
 * Core backgammon game logic
 *
 * Game representation
 */
import { counts } from "./strategy/strategies";
import type { AppliedStrategy, Report } from "./strategy/strategies";

// binary game representation
const WHITE = 0b00010000;
const BLACK = 0b00100000;
const BAR = 0b01000000;
const HOME = 0b10000000;

type Player = typeof WHITE | typeof BLACK;

interface Game {
  bBar: number;
  wBar: number;
  bHome: number;
  wHome: number;
  turn: Player | undefined;
  positions: Uint8Array;

  // doubling cube: its value, and who holds it (undefined: centered, either player may double)
  cube: number;
  cubeOwner?: Player;
}

// 24 positions
// each byte is 0..00[player][count]
// player is one bit, count is the bottom bits
// white is playing from index 0 towards the end of the array
const INITIAL_POSITIONS: Game["positions"] = new Uint8Array([
  // v black's home board
  WHITE | 2, // 0
  0, // 1
  0, // 2
  0, // 3
  0, // 4
  BLACK | 5, // 5
  // v black's bar
  0, // 6
  BLACK | 3, // 7
  0, // 8
  0, // 9
  0, // 10
  WHITE | 5, // 11
  //
  BLACK | 5, // 12
  0, // 13
  0, // 14
  0, // 15
  WHITE | 3, // 16
  0, // 17
  // ^ white's bar
  // v white's home board
  WHITE | 5, // 18
  0, // 19
  0, // 20
  0, // 21
  0, // 22
  BLACK | 2, // 23
]);

function newGame(): Game {
  let temp = {
    bBar: 0,
    wBar: 0,
    bHome: 0,
    wHome: 0,
    turn: undefined, // players roll to determine who goes first
    positions: new Uint8Array(INITIAL_POSITIONS),
    cube: 1,
  };
  return temp;
}

// everything is a primitive except the positions typedarray
// copy for uint8array is relatively cheap
function cloneGame(game: Game): Game {
  return {
    bBar: game.bBar,
    wBar: game.wBar,
    bHome: game.bHome,
    wHome: game.wHome,
    turn: game.turn,
    positions: new Uint8Array(game.positions),
    cube: game.cube,
    cubeOwner: game.cubeOwner,
  };
}

// for use as a set key. see bench/keys
function movesKey(moves: Movement[]) {
  let result = "";
  for (const movement of moves) {
    if (!movement) continue;
    result += String.fromCharCode(movement[0], movement[1]);
  }
  return result;
}

function checkWinner(game: Game): Player | false {
  if (game.bHome == 15) return BLACK;
  if (game.wHome == 15) return WHITE;
  return false;
}

type GameResult = {
  winner: Player;
  points: 1 | 2 | 3; // per unit of cube: a single game, a gammon, or a backgammon
};

// a gammon: the loser hasn't borne off any checkers. A backgammon: a gammon where
// the loser also has a checker on the bar or in the winner's home board.
function gameResult(game: Game): GameResult | false {
  const winner = checkWinner(game);
  if (!winner) return false;
  const loserOff = winner === WHITE ? game.bHome : game.wHome;
  if (loserOff > 0) return { winner, points: 1 };
  const loserBar = winner === WHITE ? game.bBar : game.wBar;
  // white's home board is 18-23, black's is 0-5
  const [from, to] = winner === WHITE ? [18, 23] : [0, 5];
  const loser = winner === WHITE ? BLACK : WHITE;
  let inWinnersHome = false;
  for (let i = from; i <= to; i++) if ((game.positions[i] & loser) === loser) inWinnersHome = true;
  return { winner, points: loserBar > 0 || inWinnersHome ? 3 : 2 };
}

const MAX_CUBE = 64;

// a player may double when the cube is centered or theirs
function canDouble(game: Game, player: Player): boolean {
  return game.cube < MAX_CUBE && (game.cubeOwner === undefined || game.cubeOwner === player);
}

// the player to move; a new game has no player until the roll off
function toMove(game: Game): Player {
  if (!game.turn) throw new Error("game.turn is not set; roll off before moving");
  return game.turn;
}

type Die = 1 | 2 | 3 | 4 | 5 | 6;
type Roll = [Die, Die];
function rollOff(): [Player, Roll] {
  let whiteRoll: Die, blackRoll: Die;
  do {
    whiteRoll = generateDie();
    blackRoll = generateDie();
  } while (whiteRoll === blackRoll);

  return [
    whiteRoll > blackRoll ? WHITE : BLACK,
    [whiteRoll, blackRoll] as Roll
  ];
}

function generateDie(): Die {
  return Math.ceil(Math.random() * 6) as Die;
}

function generateRoll(): Roll {
  return [generateDie(), generateDie()];
}

const dice: Die[] = [1, 2, 3, 4, 5, 6];
const ALL_ROLLS: Roll[] = (function () {
  return dice.flatMap((d1) => dice.map((d2) => [d1, d2] as Roll));
})();

const UNIQUE_ROLLS: Roll[] = (function () {
  let uniq: Roll[] = [];
  for (let i = 1; i < 7; i++) {
    for (let j = i; j < 7; j++) {
      uniq.push([i, j] as Roll);
    }
  }
  return uniq;
})();

type Slot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
type Start = typeof BAR | Slot;
type Dest = typeof HOME | Slot;
type Movement = [Start, Dest] | null; // null: no valid options
type Play = [Movement, Movement];
type DoublePlay = [Movement, Movement, Movement, Movement];
type Move = Play | DoublePlay;

const nullMove: Move = [null, null];

function apply(game: Game, movement: Movement): void {
  if (!movement) return;
  let [start, dest] = movement;
  const player = toMove(game);
  const opponent = player == BLACK ? WHITE : BLACK;
  if (start == BAR) {
    // move off the bar
    player == BLACK ? game.bBar-- : game.wBar--;
  } else {
    // move from the start
    let val = game.positions[start];
    if (val == (player | 1)) {
      game.positions[start] = 0; // if there are no pieces left, clear the player
    } else {
      game.positions[start] = val - 1;
    }
  }

  // move to home
  if (dest == HOME) {
    player == BLACK ? game.bHome++ : game.wHome++;
  } else {
    let current = game.positions[dest];
    // hit a blot, send opponent to bar
    if (current == (opponent | 1)) {
      opponent == BLACK ? game.bBar++ : game.wBar++;
      game.positions[dest] = player | 1;
    } else {
      game.positions[dest] = player | (current + 1);
    }
  }
}

// is a spot valid to move to?
// - it's home
// - if it's not the opponent's slot
// - if it's an opponent's blot
function checkDest(game: Game, dest: Dest, opponent: Player): boolean {
  if (dest == HOME) {
    return true;
  }
  const current = game.positions[dest];
  return (current & opponent) == 0 || current == (opponent | 1);
}

// is this a valid start?
// - it has one of player's pieces
function checkStart(game: Game, start: Start, player: Player): boolean {
  return (game.positions[start] & player) == player;
}

function isDest(dest: number): dest is Dest {
  return dest >= 0 && dest < 24;
}

// returns: series of plays and the updated game state
type Result = [Move, Game];
type TempResult = [Movement[], Game, Die[]];
type Seen = Set<string>;
type ResultArray = TempResult[] & { minRolls: number };

function validMoves(game: Game, r: Roll): Result[] {
  if (!r) { throw new Error("no roll") }
  counts.validMoves++
  // doubles act twice
  const doubles = r[0] == r[1];
  let rolls: Die[] = doubles ? [r[0], r[0], r[0], r[0]] : r;
  const player = toMove(game);
  const opponent = player == BLACK ? WHITE : BLACK;

  // players play in opposite directions
  const direction = player == BLACK ? -1 : 1;
  const end = player == BLACK ? 0 : 23;
  const enter = player == BLACK ? 23 : 0;
  const homeboard = player == BLACK ? 5 : 18;
  const results = [] as unknown as ResultArray;
  // have to use as many rolls as possible
  // track the max rolls we've used / min rolls available we've seen
  results.minRolls = rolls.length;

  // are there pieces on the bar?
  const bar = player == BLACK ? game.bBar : game.wBar;
  if (bar > 0) {
    let early = handleBar(game, player, opponent, rolls, doubles, direction, enter, bar, results);
    if (early) return early;

    // is the bar cleared?
    if (results.length) {
      // results can only have length 1
      const [move, next] = results[0]; // the next game state
      const nextbar = player == BLACK ? next.bBar : next.wBar;
      if (nextbar) {
        // still pieces on the bar, so the entries are the whole move
        return [[(move.length > 1 ? move : [move[0], null]) as Move, next]];
      } else {
        // bar is clear; the rest of the move can use the rolls that are left
        results.minRolls = results[0][2].length;
      }
    } else  {
      // bar had pieces, but no move is possible
      return [[nullMove, game]];
    }
  }

  // ignore exact sequences of moves we've seen
  const seen: Seen = new Set();

  // iterate through the positions
  for (let start = enter as Start; start != end; start += direction) {
    // if there was anything on the bar, we can only use the existing results, not start from scratch
    if (!bar) {
      boardMoves([], game, rolls, start, player, opponent, direction, seen, results);
    }
    // add additional moves to the existing results
    for (let prev of results) {
      let [m, g, available] = prev;
      boardMoves(m, g, available, start, player, opponent, direction, seen, results);
    }
  }

  bearOff([], game, rolls, player, homeboard, end, direction, seen, results);
  // check again for any of the results
  for (let result of results) {
    let [m, g, available] = result;
    bearOff(m, g, available, player, homeboard, end, direction, seen, results);
  }

  // shape results and filter out moves that don't use the max number of rolls
  const final: Result[] = [];
  for (var k = 0; k < results.length; k++) {
    const [m, g, available] = results[k];
    if (available.length <= results.minRolls) {
      final.push([m as Move, g]);
    }
  }
  // no legal move: the only option is to pass
  if (!final.length) return [[nullMove, cloneGame(game)]];
  return final;
}

// prettier-ignore
function boardMoves(m: Movement[], g: Game, rolls: Die[], start: Start, player: Player, opponent: Player, direction: number, seen: Seen, results: ResultArray) {
  // if the position is owned by the player
  if (checkStart(g, start, player)) {
    for (var j = 0; j < rolls.length; j++) {
      const roll = rolls[j];
      const dest = start + roll * direction;
      if (!isDest(dest)) continue; // confirm dest is in range
      if (checkDest(g, dest, opponent)) {
        // is the target valid?
        addMovement([start, dest], m, g, rolls, seen, results, j);
      }
    }
  }
}

function handleBar(game: Game, player: Player, opponent: Player, rolls: Die[], doubles: boolean, direction: number, enter: number, bar: number, results: ResultArray): Result[] | undefined {
  for (let i = 0; i < rolls.length; i++) {
    const roll = rolls[i];
    const dest = (roll - 1) * direction + enter;
    if (!isDest(dest)) {
      throw new Error(`${dest} is not a valid dest. Roll was ${roll}`);
    }
    if (checkDest(game, dest, opponent)) {
      const movement: Movement = [BAR, dest];
      const next = cloneGame(game);
      if (doubles) {
        // push as many as 4 from the bar
        const count = Math.min(4, bar);
        const plays: Movement[] = [];
        const available = rolls.slice();
        for (let i = 0; i < count; i++) {
          plays.push(movement);
          apply(next, movement);
          available.pop(); // the roll is used up
        }
        results.push([plays, next, available]);
        // there's only one version of doubles entrances: move off the bar
        break;
      } else {
        if (results.length && bar > 1) {
          // the first die allowed us off the bar, and we have more bar pieces to move
          const [[m1], next1, _] = results[0];
          const next2 = cloneGame(next1);
          apply(next2, movement);
          const moveBothOff: Result = [[m1, movement], next2];
          return [moveBothOff]; // no other moves are possible
        }
        apply(next, movement);

        // push this roll, with the other roll still available
        results.push([[movement], next, [rolls[1 - i]]]);
      }
    }
  }
}

function bearOff(m: Movement[], g: Game, rolls: Die[], player: Player, homeboard: number, end: number, direction: number, seen: Seen, results: ResultArray) {
  if (isBearingOff(player, g)) {
    for (let i = 0; i < rolls.length; i++) {
      const roll = rolls[i];
      const bearsOffPos: Start = (end + direction - roll * direction) as Start;
      if (g.positions[bearsOffPos] & player) {
        // if we have a piece right on the spot we bear off, we can move it off
        addMovement([bearsOffPos, HOME], m, g, rolls, seen, results, i);
      } else {
        for (let h = homeboard as Start; h != end + direction; h += direction) {
          if (g.positions[h] & player) {
            // otherwise, we can bear off any homeboard points smaller than the roll
            // so long as no piece is further out than that
            if (direction * bearsOffPos > direction * h) break;
            addMovement([h, HOME], m, g, rolls, seen, results, i);
          }
        }
      }
    }
  }
}

function addMovement(movement: Movement, movements: Movement[], game: Game, available: Die[], seen: Seen, results: ResultArray, rollIndex: number) {
  const moves: Movement[] = movements.concat([movement]);
  const key = movesKey(moves);
  if (seen.has(key)) return; // skip if we've done these exact moves before
  seen.add(key);
  const next = cloneGame(game);
  apply(next, movement);
  const remaining = available.slice();
  remaining.splice(rollIndex, 1);
  results.push([moves, next, remaining]);
  if (remaining.length < results.minRolls) {
    results.minRolls = remaining.length;
  }
}

// bearing off if home + homeboard total 15 pieces
// last (first) 6 positions are the home board
function isBearingOff(player: Player, game: Game) {
  let pieceCount, start;
  if (player == WHITE) {
    if (game.wBar) return false;
    pieceCount = game.wHome;
    start = game.positions.length - 6;
  } else { // black
    if (game.bBar) return false;
    pieceCount = game.bHome;
    start = 0;
  }
  for (let i = start; i < start + 6; i++) {
    let slot = game.positions[i];
    pieceCount += slot & player ? slot ^ player : 0;
  }
  return 15 == pieceCount;
}

function takeTurn(game: Game, roll: Roll, strategy: AppliedStrategy, report?: Report): Result {
  let choice = strategy(game, roll, report);
  let move = choice ? choice[0] : nullMove;
  let next = choice ? choice[1] : game;
  next.turn = game.turn == BLACK ? WHITE : BLACK;
  return [move, next];
}

const constants = { ALL_ROLLS, UNIQUE_ROLLS, WHITE: WHITE as typeof WHITE, BLACK: BLACK as typeof BLACK, HOME: HOME as typeof HOME, BAR: BAR as typeof BAR, dice, nullMove };

const helpers = {
  isBearingOff,
  newGame,
  cloneGame,
  validMoves,
  generateRoll,
  apply,
  takeTurn,
  checkWinner,
  gameResult,
  canDouble,
  toMove,
  rollOff,
};

// types
export type { Player, Game, GameResult, Result, Die, Roll, Move, Movement, Start, Dest };

export { helpers, constants };
