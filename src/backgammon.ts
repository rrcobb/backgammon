// binary game representation
// plus fast functions for updating the game
export const WHITE = 0b00010000;
export const BLACK = 0b00100000;
export const BAR   = 0b01000000;
export const HOME  = 0b10000000;

type Player = typeof WHITE | typeof BLACK;

export interface Game {
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

export function newGame(): Game {
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

// everything is a primitive except the positions typedarray
// copy is relatively cheap
export function cloneGame(game: Game): Game {
  return {...game, positions: new Uint8Array(game.positions)}
}

export function checkWinner(game: Game) {
  if (game.bHome == 15) return BLACK;
  if (game.wHome == 15) return WHITE;
  return false;
}

type Die = 1 | 2 | 3 | 4 | 5 | 6;
type Roll = [Die, Die]
export function generateRoll(): Roll {
  return [Math.ceil(Math.random() * 6) as Die, Math.ceil(Math.random() * 6) as Die]
}
const dice = [1,2,3,4,5,6];
const ALL_ROLLS = (function() {
  return dice.flatMap(d1 => dice.map(d2 => [d1,d2]))
})();

type Slot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
type Start = typeof BAR | Slot;
type Dest = typeof HOME | Slot;
type Movement = [Start, Dest] | null; // null: no valid options
type Play = [Movement, Movement]
type DoublePlay = [Movement, Movement, Movement, Movement]
type Move = Play | DoublePlay

const nullMove: Move = [null, null]

export function apply(game: Game, movement: Movement, player: Player, opponent: Player): void {
  let [start, dest] = movement;
  if (start == BAR) {
    // move off the bar
    let bar = player == BLACK ? 'bBar' : 'wBar';
    game[bar]--;
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
    let home = player == BLACK ? 'bHome' : 'wHome'
    game[home]++;
  } else {
    let current = game.positions[dest]
    // hit a blot? send opponent to bar
    if (current == (opponent | 1)) {
      let bar = opponent == BLACK ? 'bBar' : 'wBar';
      game[bar]++;
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

const min = (a, b) => a >= b ? a : b;
function isDest(dest: number): dest is Dest {
  return dest >= 0 && dest < 24;
}

// returns: series of plays and the updated game state
type Result = [Move, Game]
type TempResult = [Movement[], Game, Die[]]

export function validMoves(game: Game, r: Roll): Result[] {
  const results: TempResult[] = [];
  // doubles act twice
  const doubles = r[0] == r[1]; 
  let rolls = doubles ? [r[0], r[0], r[0], r[0]]: r;
  const player = game.turn;
  const opponent = (player == BLACK) ? WHITE : BLACK;
  // player direction
  const direction = (player == BLACK) ? -1 : 1;
  const end = (player == BLACK) ? 0 : 23;
  const enter = (player == BLACK) ? 23 : 0;
  const homeboard = (player == BLACK) ? 5 : 18;

  /***********************
   * Move off the Bar
   ********************/
  const bar = player == BLACK ? game.bBar : game.wBar;
  if (bar > 0) {
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
          const count = min(4, bar)
          const plays: Movement[] = [];
          for (let i = 0; i < count; i++) {
            plays.push(movement);
            apply(next, movement, player, opponent);
            rolls.pop() // the roll is used up 
          }
          // there's only one version of doubles: move off the bar
          // if there are some die left and the bar is clear, we'll play more
          results.push([plays, next, rolls]) 
          break;
        } else {
          if (results.length && bar > 1) {
            // the first die also allowed us off the bar, and we still have a piece on the bar
            const [[m1], next1, _] = results[0];
            const next2 = cloneGame(next1);
            apply(next2, movement, player, opponent);
            const moveBothOff: Result = [[m1, movement], next2] 
            return [moveBothOff]; // no other moves are possible
          }

          apply(next, movement, player, opponent);
          // push this roll, with the other roll still available
          results.push([[movement], next, [rolls[i ? 0 : 1]]]) 
        }
      }
    }
    // is the bar cleared
    if (results.length) { // results can only have 0 or 1 length here
      const next = results[0][1];  // the next game state
      const nextbar = player == BLACK ? next.bBar : next.wBar;
      if (nextbar) {
        // bar is still there, we can only use one move
        const move: Move = [results[0][0][0], null];
        const g: Game = results[0][1];
        const result: Result = [move, g];
        return [result];
      } else {
        // can only use the remaining rolls
        rolls = results[0][2];
      }
    } else {
      // no move is possible
      const result: Result = [nullMove, game]
      return [result] 
    }
  }

  /**********************************
   * Moves to normal positions
   **********************************/
  // track the max rolls we've used / min rolls available we've seen
  let minRollsRemaining = rolls.length;
  // ignore exact sequences of moves we've seen
  const seen = new Set();
 
  // iterate through the positions
  for (let start = enter as Start; start != end; start += direction) {
    // if the position is owned by the player
    if (checkStart(game, start, player)) {
      const startPieces = game.positions[start] ^ player;
      //  try to use each of the rolls
      for (var j = 0; j < rolls.length; j++) {
        const roll = rolls[j];
        const dest = start + (roll * direction);
        if (!isDest(dest)) continue; // confirm dest is in range
        if (checkDest(game, dest, opponent)) { // is the target valid?
          const next = cloneGame(game);
          const movement: Movement = [start, dest];
          apply(next, movement, player, opponent);
          const remaining = rolls.slice();
          remaining.splice(j, 1);
          const result: TempResult = [[movement], next, remaining]
          if (remaining.length < minRollsRemaining) { minRollsRemaining = remaining.length }
          results.push(result);
        }
      }
    }

    // duplicate the above, but for all of the existing results
    for (let prev of results) {
      let [m, g, rollsAvailable] = prev;
      if (checkStart(g, start, player)) {
        for (var j = 0; j < rollsAvailable.length; j++) {
          const roll = rollsAvailable[j];
          const dest = start + (roll * direction);
          if (!isDest(dest)) continue; // confirm dest is in range
          if (checkDest(g, dest, opponent)) { // is the target valid?
            const movement: Movement = [start, dest];
            const moves: Movement[] = [...prev[0], movement]
            const key = movesKey(moves);
            if (seen.has(key)) continue
            seen.add(key);
            const next = cloneGame(g)
            apply(next, movement, player, opponent)
            // remove the roll from the available rolls
            const remaining = rollsAvailable.slice();
            remaining.splice(j, 1);
            results.push([moves, next, remaining]);
            if (remaining.length < minRollsRemaining) { minRollsRemaining = remaining.length }
          }
        }
      }
    }
  }

  /********************
   * Bearing Off
   ********************/
  if (isBearingOff(player, game)) {
    // For each roll:
    for (let i = 0; i < rolls.length; i++) {
      const roll = rolls[i];
      const bearsOff: Start = (end + direction) - (roll * direction) as Start;
      // is the roll exactly what's needed to take a piece off?
      if (game.positions[bearsOff] & player) { 
        const movement: Movement = [bearsOff, HOME];
        const moves = [movement];
        const key = movesKey(moves);
        if (seen.has(key)) continue;
        seen.add(key);
        const next = cloneGame(game);
        apply(next, movement, player, opponent);
        const remaining = rolls.slice();
        remaining.splice(i, 1);
        results.push([moves, next, remaining])
        if (remaining.length < minRollsRemaining) { minRollsRemaining = remaining.length }
      } else { // we aren't a direct hit
        // if the largest spot is smaller than the roll
        for (let h = homeboard as Start; h != end; h += direction) {
          if (game.positions[h] & player) {
            if ((direction * bearsOff) > (direction * h)) break;
            // we can bear off any of these
            const movement: Movement = [h, HOME];
            const moves: Movement[] = [movement];
            const key = movesKey(moves);
            if (seen.has(key)) continue;
            seen.add(key);
            const next = cloneGame(game);
            apply(next, movement, player, opponent);
            const remaining = rolls.slice();
            remaining.splice(i, 1);
            results.push([moves, next, remaining])
            if (remaining.length < minRollsRemaining) { minRollsRemaining = remaining.length }
          }
        }
      }
    }
  }

  // check again for any of the results
  for (let result of results) {
    let [m, g, available] = result;
    if (isBearingOff(player, g)) {
      for (let i = 0; i < available.length; i++) {
        const roll = available[i];
        const bearsOff: Start = (end + direction) - (roll * direction) as Start;
        if (g.positions[bearsOff] & player) { 
          const movement: Movement = [bearsOff, HOME];
          const moves: Movement[] = [...m, movement];
          const key = movesKey(moves);
          if (seen.has(key)) continue;
          seen.add(key);
          const next = cloneGame(g);
          apply(next, movement, player, opponent);
          const remaining = available.slice();
          remaining.splice(i, 1);
          results.push([moves, next, remaining]);
          if (remaining.length < minRollsRemaining) { minRollsRemaining = remaining.length }
        } else {
          for (let h = homeboard as Start; h != end; h += direction) {
            if (g.positions[h] & player) {
              if ((direction * bearsOff) < (direction * h)) break;
              const movement: Movement = [h, HOME];
              const moves: Movement[] = [...m, movement];
              const key = movesKey(moves);
              if (seen.has(key)) continue;
              seen.add(key);
              const next = cloneGame(g);
              apply(next, movement, player, opponent);
              const remaining = available.slice();
              remaining.splice(i, 1);
              results.push([moves, next, remaining]);
              if (remaining.length < minRollsRemaining) { minRollsRemaining = remaining.length }
            }
          }
        }
      }
    }
  }

  // filter out moves that don't use the max number of rolls
  // also filter out duplicates
  const final = [];
  for (var k = 0; k < results.length; k++) {
    const [m, g, available] = results[k];
    if (available.length <= minRollsRemaining) {
      final.push([m,g])
    }
  }
  return final;
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

type Strategy = (options: Result[]) => Result;
export function takeTurn(game: Game, roll: Roll, strategy: Strategy): Game {
  const options = validMoves(game, roll);
  const choice = strategy(options);  
  let next = choice ? choice[1] : game;
  next.turn = (game.turn == BLACK) ? WHITE : BLACK;
  return next;
}
