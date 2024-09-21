// binary game representation
// plus fast functions for updating the game
export const WHITE = 0b00010000;
export const BLACK = 0b00100000;
const BAR   = 0b01000000;
const HOME  = 0b10000000;

type Player = WHITE | BLACK;

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
    // black's home board
    WHITE | 2,
    0, 0, 0, 0,
    BLACK | 5,
    // black's bar
    0,
    BLACK | 3,
    0, 0, 0,
    WHITE | 5,
    //
    BLACK | 5,
    0, 0, 0,
    WHITE | 3, // 16
    0, // 17
    // white's home board
    WHITE | 5, // 18
    0, // 19
    0, // 20
    0, // 21
    0, // 22
    BLACK | 2 // 23
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

// everything is a primitive except the positions typedarray
// copy is relatively cheap
function cloneGame(game: Game): Game {
  return {...game, positions: new Uint8Array(game.positions)}
}

function checkWinner(game: Game) {
  if (game.bHome == 15) return BLACK;
  if (game.wHome == 15) return WHITE;
  return false;
}



type Die = 1 | 2 | 3 | 4 | 5 | 6;
type Roll = [DIE, DIE]
function roll(): ROLL {
  return [Math.ceil(Math.random() * 6) as DIE, Math.ceil(Math.random() * 6) as DIE]
}
const dice = [1,2,3,4,5,6];
const ALL_ROLLS = (function() {
  return dice.flatmap(d1 => dice.map(d2 => [d1,d2]))
})();

type Slot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
type Start = BAR | Slot;
type Dest = HOME | Slot;
type Movement = [Start, Dest] | null; // null: no valid options
type Play = [Movement, Movement]
type DoublePlay = [Movement, Movement, Movement, Movement]
type Move = Play | DoublePlay

function apply(movement: Movement, game: Game, player: Player, opponent: Player) {
  let [start, dest] = movement;
  // move off the bar
  if (start == BAR) {
    let bar = player == BLACK ? game.bBar : game.wBar;
    bar--;
  }
  
  // move to home?
  if (dest == HOME) {
    let home = player == BLACK ? game.bHome : game.wHome
    home++;
  } else {
    let current = game.positions[index]
    // hit a blot? send opponent to bar
    if (current == (opponent | 1)) {
      let bar = opponent == BLACK ? game.bBar : game.wBar;
      bar++;
      game.positions[dest] = (player | 1);
    } else {
      game.positions[dest] = (player | current + 1);
    }
  }
}

// returns: plays and the updated game state
function validMoves(game: Game, r: Roll): [Move, Game][] {
  const results: [Play[], Game, Die[]] = [];
  // doubles act twice
  const doubles = r[0] == r[1]; 
  const rolls = doubles ? [r[0], r[0], r[0], r[0]]: r;
  const player = game.turn;
  const opponent = (player == BLACK) ? WHITE : BLACK;
  // player direction
  const direction = (player == BLACK) ? -1 : 1;
  const homeboard = (player == BLACK) ? 0 : 23;
  const enter = (player == BLACK) ? 23 : 0;
  // check the bar first
  // if there's no way to get everything off the bar, no other moves!
  let bar = player == BLACK ? game.bBar : game.wBar;
  if (bar > 0) {
    // check if there are empty / your positions that the rolls can hit
    for (let roll of rolls) {
      let dest = (roll - 1) * direction + enter;
      let current = game.positions[dest]
      // can enter if it's not the opponent's slot
      // or if it's an opponent's blot
      if ((current & opponent) == 0 || current == (opponent | 1)) {
        let next = cloneGame(game);
        if (doubles) {
          let movement = [BAR, dest];
          // push as many as 4 from the bar
        } else {
          let movement = [BAR, dest];
          results.push([[movement], next, availableRolls])
        }
      }
    }
  }

  if (isBearingOff(player, game)) {
  }
  // iterate through the positions
  // try to use each of the rolls
  // if the roll is unused in the results, add a step that uses it

  // filter out the moves with unused rolls, unless there are none that use all the rolls
  // rule is: you have to use the max number of rolls possible
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
  for (var i = start; i < start + 6; i++) {
    let slot = game.positions[i];
    pieceCount += (slot & player) ? (slot ^ player) : 0; 
  }
  return 15 ==  pieceCount;
}
