// binary game representation
const WHITE = 0b00010000;
const BLACK = 0b00100000;
const BAR   = 0b01000000;
const HOME  = 0b10000000;

type Player = typeof WHITE | typeof BLACK;

interface Game {
  // home and bars are really each a half a byte
  // using numbers for now for ease
  bBar: number,
  wBar: number,
  bHome: number,
  wHome: number,
  turn: Player | undefined,
  positions: Uint8Array,
  // doubling cube: not fully implemented
  cube: number,
}

// 24 positions
// each byte is 000[player][count]
// player is one bit, count is the bottom bits
// white is playing from index 0 towards the end of the array
const INITIAL_POSITIONS: Game['positions'] = new Uint8Array(
  [
               // v black's home board
    WHITE | 2, // 0
    0,         // 1
    0,         // 2
    0,         // 3
    0,         // 4
    BLACK | 5, // 5
               // v black's bar
    0,         // 6
    BLACK | 3, // 7
    0,         // 8
    0,         // 9
    0,         // 10
    WHITE | 5, // 11
               //
    BLACK | 5, // 12
    0,         // 13
    0,         // 14
    0,         // 15
    WHITE | 3, // 16
    0,         // 17
               // ^ white's bar
               // v white's home board
    WHITE | 5, // 18
    0,         // 19
    0,         // 20
    0,         // 21
    0,         // 22
    BLACK | 2  // 23
  ]
);

function newGame(): Game {
  return {
    bBar: 0,
    wBar: 0,
    bHome: 0,
    wHome: 0,
    turn: undefined,
    positions: new Uint8Array(INITIAL_POSITIONS),
    cube: 1,
  }
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
  }
}

// for use as a set key
// see bench/keys
function movesKey(moves: Movement[]) {
  let result = "";
  for (let i = 0; i < moves.length; i++) {
    for (let j = 0; j < moves[i].length; j++) {
      result += moves[i][j]
    }
    result += "|"
  }
  return result;
}

function checkWinner(game: Game) {
  if (game.bHome == 15) return BLACK;
  if (game.wHome == 15) return WHITE;
  return false;
}

type Die = 1 | 2 | 3 | 4 | 5 | 6;
type Roll = [Die, Die]
function generateRoll(): Roll {
  return [Math.ceil(Math.random() * 6) as Die, Math.ceil(Math.random() * 6) as Die]
}

const dice: Die[] = [1,2,3,4,5,6];
const ALL_ROLLS: Roll[] = (function() {
  return dice.flatMap(d1 => dice.map(d2 => ([d1,d2] as Roll)))
})();

type Slot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
type Start = typeof BAR | Slot;
type Dest = typeof HOME | Slot;
type Movement = [Start, Dest] | null; // null: no valid options
type Play = [Movement, Movement]
type DoublePlay = [Movement, Movement, Movement, Movement]
type Move = Play | DoublePlay

const nullMove: Move = [null, null]

function apply(game: Game, movement: Movement): void {
  let [start, dest] = movement;
  const player = game.turn;
  const opponent = (player == BLACK) ? WHITE : BLACK;
  if (start == BAR) {
    // move off the bar
    player == BLACK ? game.bBar-- : game.wBar--;
  } else {
    // move from the start
    let val = game.positions[start]
    if (val == (player | 1)) {
      game.positions[start] = 0; // no one's if there are no pieces
    } else {
      game.positions[start] = val - 1;
    }
  }

  // move to home?
  if (dest == HOME) {
    player == BLACK ? game.bHome++ : game.wHome++
  } else {
      let current = game.positions[dest]
      // hit a blot? send opponent to bar
      if (current == (opponent | 1)) {
        opponent == BLACK ? game.bBar++ : game.wBar++;
        game.positions[dest] = (player | 1);
      } else {
        game.positions[dest] = (player | current + 1);
      }
    }
}

// is a spot valid to move to?
// - it's home
// - if it's not the opponent's slot
// - if it's an opponent's blot
function checkDest(game: Game, dest: Dest, opponent: Player): boolean {
  if (dest == HOME) { return true }
  const current = game.positions[dest];
  return (current & opponent) == 0 || current == (opponent | 1)
}

// is this a valid start?
// - it has one of player's pieces
function checkStart(game: Game, start: Start, player: Player): boolean {
  return (game.positions[start] & player) == player
}

function isDest(dest: number): dest is Dest {
  return dest >= 0 && dest < 24;
}

// returns: series of plays and the updated game state
type Result = [Move, Game]
type TempResult = [Movement[], Game, Die[]]
type ResultArray = TempResult[] & { minRolls: number } 

function validMoves(game: Game, r: Roll): Result[] {
  // doubles act twice
  const doubles = r[0] == r[1]; 
  let rolls = doubles ? [r[0], r[0], r[0], r[0]]: r;
  const player = game.turn;
  const opponent = (player == BLACK) ? WHITE : BLACK;

  // players play in opposite directions
  const direction = (player == BLACK) ? -1 : 1;
  const end = (player == BLACK) ? 0 : 23;
  const enter = (player == BLACK) ? 23 : 0;
  const homeboard = (player == BLACK) ? 5 : 18;

  const results: ResultArray = ([] as ResultArray)
  // track the max rolls we've used / min rolls available we've seen
  results.minRolls = rolls.length;

  // are there pieces on the bar?
  const bar = player == BLACK ? game.bBar : game.wBar;
  if (bar > 0) {
    let early = handleBar(game, player, opponent, rolls, doubles, direction, enter, bar, results); 
    if (early) return early;

    // is the bar cleared?
    if (results.length) { // results can only have 0 or 1 length here
      const [move, next] = results[0];  // the next game state
      const nextbar = player == BLACK ? next.bBar : next.wBar;
      if (nextbar) {
        // still pieces on the bar, so we can only use one move
        return [[[move[0], null], next]];
      } else {
        // bar is clear, we used those rolls up
        results.minRolls = rolls.length - results[0][2].length;
      }
    } else {
      // bar had pieces, but no move is possible
      return [[nullMove, game]]
    }
  }

  // ignore exact sequences of moves we've seen
  const seen = new Set();

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
  const final = [];
  for (var k = 0; k < results.length; k++) {
    const [m, g, available] = results[k];
    if (available.length <= results.minRolls) {
      final.push([m,g])
    }
  }
  return final;
}

function boardMoves(m, g, rolls, start, player, opponent, direction, seen, results) {
  // if the position is owned by the player
  if (checkStart(g, start, player)) {
    for (var j = 0; j < rolls.length; j++) {
      const roll = rolls[j];
      const dest = start + (roll * direction);
      if (!isDest(dest)) continue; // confirm dest is in range
      if (checkDest(g, dest, opponent)) { // is the target valid?
        addMovement([start, dest], m, g, rolls, seen, results, j);
      }
    }
  }
}

function handleBar(game, player, opponent, rolls, doubles, direction, enter, bar, results): Result[] | undefined {
  for (let i in rolls) {
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
        const count = Math.min(4, bar)
        const plays: Movement[] = [];
        const available = rolls.slice()
        for (let i = 0; i < count; i++) {
          plays.push(movement);
          apply(next, movement);
          available.pop() // the roll is used up 
        }
        results.push([plays, next, available]) 
        // there's only one version of doubles entrances: move off the bar
        break;
      } else {
        if (results.length && bar > 1) {
          // the first die allowed us off the bar, and we have more bar pieces to move
          const [[m1], next1, _] = results[0];
          const next2 = cloneGame(next1);
          apply(next2, movement);
          const moveBothOff: Result = [[m1, movement], next2] 
          return [moveBothOff]; // no other moves are possible
        }
        apply(next, movement);

        // push this roll, with the other roll still available
        results.push([[movement], next, [rolls[i ? 0 : 1]]]) 
      }
    }
  }
}

function bearOff(m, g, rolls, player, homeboard, end, direction, seen, results) {
  if (isBearingOff(player, g)) {
    for (let i = 0; i < rolls.length; i++) {
      const roll = rolls[i];
      const bearsOff: Start = (end + direction) - (roll * direction) as Start;
      if (g.positions[bearsOff] & player) { 
        addMovement([bearsOff, HOME], m, g, rolls, seen, results, i);
      } else {
        for (let h = homeboard as Start; h != (end + direction); h += direction) {
          if (g.positions[h] & player) {
            if ((direction * bearsOff) > (direction * h)) break;
            addMovement([h, HOME], m, g, rolls, seen, results, i); 
          }
        }
      }
    }
  }
}

function addMovement(movement, movements, game, available, seen, results, rollIndex): number {
  const moves: Movement[] = movements.concat([movement]);
  const key = movesKey(moves);
  if (seen.has(key)) return; // skip if we've done these exact moves before
  seen.add(key);
  const next = cloneGame(game);
  apply(next, movement);
  const remaining = available.slice();
  remaining.splice(rollIndex, 1);
  results.push([moves, next, remaining]);
  if (remaining.length < results.minRolls) { results.minRolls = remaining.length }
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
    pieceCount = game.bHome
    start = 0;
  }
  for (let i = start; i < start + 6; i++) {
    let slot = game.positions[i];
    pieceCount += (slot & player) ? (slot ^ player) : 0; 
  }
  return 15 ==  pieceCount;
}

function show(moves: Move): string {
  let result = "(";
  for (let m in moves) {
    let move = moves[m]
    if (move) {
      result += (1 + move[0]) + "=>" + (1 + move[1]);
    } else {
      result += "none"
    }
    if (+m < moves.length - 1) result += ",";
  }
  result += ")"
  return result
}

type Strategy = (options: Result[]) => Result;

function takeTurn(game: Game, roll: Roll, strategy: Strategy): Result {
  const options = validMoves(game, roll);
  let choice
  if (options.length) {
    choice = strategy(options);
  } 

  let move = choice ? choice[0] : nullMove;
  let next = choice ? choice[1] : game;
  next.turn = (game.turn == BLACK) ? WHITE : BLACK;
  return [move, next];
}

export { 
  WHITE, BLACK, HOME, BAR, Game, 
  newGame, cloneGame, validMoves, 
  apply, takeTurn, checkWinner,
  dice, generateRoll, ALL_ROLLS,
  Result, show, isBearingOff
}
