// backgammon game

import { choice, StrategyName } from './strategies'
export type Player = "b" | "w";

export interface Game {
  bar: Player[];
  wHome: Player[];
  bHome: Player[];
  positions: Player[][];
  cube: number;
  turn: Player;
  wStrategy: StrategyName,
  bStrategy: StrategyName,
}

// 24 spaces
// player w is playing 'forward' in the array
// player b is playing 'backward' in the array
const INITIAL: Player[][] = [
  // b homeboard
  ["w", "w"],
  [],
  [],
  [],
  [],
  ["b", "b", "b", "b", "b"],
  //
  [],
  ["b", "b", "b"],
  [],
  [],
  [],
  ["w", "w", "w", "w", "w"],
  //
  ["b", "b", "b", "b", "b"],
  [],
  [],
  [],
  ["w", "w", "w"],
  [],
  // w home board
  ["w", "w", "w", "w", "w"],
  [],
  [],
  [],
  [],
  ["b", "b"],
];

export function newGame(): Game {
    // TODO: implement the start of the game / first roll
  let first: Player = Math.random() > 0.5 ? "w": "b";  // :/ flip a coin for first
  return {
    bar: [],
    wHome: [],
    bHome: [],
    positions: structuredClone(INITIAL),
    cube: 1,
    wStrategy: "evaluate",
    bStrategy: "evaluate",
    turn: first,
  };
}

type Droll = 1 | 2 | 3 | 4 | 5 | 6 | -1 | -2 | -3 | -4 | -5 | -6
function die(): Droll {
  return Math.ceil(Math.random() * 6) as Droll;
}

type Roll = [Droll, Droll] | [Droll, Droll, Droll, Droll]
function roll(): Roll {
  let [i, j] = [die(), die()];
  return cleanRoll(i,j);
}

function cleanRoll<T>(i: T, j: T): [T,T] | [T,T,T,T] {
  if (i == j) {
    return [i,i,i,i];
  } else {
    return [i,j];
  }
}

const dice: Droll[] = [1,2,3,4,5,6]
export const allRolls: Roll[] = (function() {
  return dice.flatMap(d1 => dice.map(d2 => [d1, d2])).map(([i,j]) => cleanRoll(i,j))
})();

function orderings(rolls: Roll): Array<Roll> {
  // hack: we know that we only have one ordering if the die are equal, or if there's only one
  if (rolls.length < 2 || rolls[0] == rolls[1]) {
    return [rolls]
  } else {
    return [[rolls[0], rolls[1]], [rolls[1], rolls[0]]];
  }
}


type Start = 'bar' | number
type Dest = number | 'home'
export type Move = [Start, Dest]

// check destination is
//  in-bounds and not blocked
function valid(player: Player, move: Move, positions: Array<Array<Player>>): boolean {
  if (typeof move[1] == "number") {
    return (
      move[1] >= 0 &&
        move[1] < 24 && // inbounds
        (positions[move[1]].length < 2 || positions[move[1]][0] == player)
    );
  } else {
    return true // dest is "home", which can't be blocked
  }
}

function startingPositions(game: Game): number[] {
  let withIndex: Array<[Player[], number]> = game.positions.map((v: Player[], i: number) => [v, i])
  return  withIndex.filter(([a, i]) => a.length > 0 && a[0] == game.turn).map(([_, i]) => i);
}

function isBearingOff(starts: number[], player: Player): boolean {
  if (starts.length == 0) { return false }
  // can bear off if all pieces are in the nearest section
  if (player == "w") {
    return starts.every(start => start > 17)
  } else {
    return starts.every(start => start < 6)
  }
}

// Generate all the valid moves given one die roll and a game board.
// Move: [start, end]
// returns Array<Move>
function validMoves(roll: Droll, game: Game): Move[] {
  let player = game.turn;
  let barcount = game.bar.filter(p => p == player).length;
    // legal entrances get pieces off the bar first
  if (barcount > 0) {
    const start = player == 'b' ? 24 : -1;
    let entrance: Move = ['bar', start + roll]
    if (valid(player, entrance, game.positions)) {
      return [entrance]
    } else {
      return []
    }
  }

  let starts = startingPositions(game)
  let moves = starts.map(p => [p, p + roll]) as Move[]
  moves = moves.filter(move => valid(player, move, game.positions));
  if (isBearingOff(starts, player)) {
    // can bear off a piece
    // piece is exactly n away from home
    // _or_ the highest one, if all are less than the roll off
    let bears = starts.filter(start => (start + roll == -1) || (start + roll == 24)).map(start => [start, 'home'])
    let furthest = player == "w" ? Math.min(...starts) : Math.max(...starts)
    if ((roll + furthest < 0)  || (roll + furthest >= 24)) {
      bears = [[furthest, 'home']]
    }
    moves = moves.concat(bears as Move[])
  }
  return moves
}

export function orderedValidPlays(game: Game, rolls: Roll): Move[][] {
  if (game.turn == "b") {
     rolls = rolls.map(r => -r) as Roll
  }
  // order of moves matters, but only for the case of two different die
  let ords = orderings(rolls)
  return ords.flatMap(rls => validPlays(game, rls))
}

export function safeUpdate(game: Game, moves: Move[]) {
  let imaginedWorld = structuredClone(game)
  update(imaginedWorld, moves);
  return imaginedWorld
}

// Rolls: list of rolled dies
// Play: list of start/finish pairs e.g. [(start1, end1), (start2, end2)]
// returns: list of plays
function validPlays(game: Game, rolls: Array<Droll>): Move[][] {
  if (rolls.length == 0) { return [] }
  let [toTry, ...rest] = rolls
  let results: Move[][] = []
  let moves = validMoves(toTry, game)
  if (rest.length == 0) {
    return moves.map(move => [move])
  }
  for (let move of moves) {
    let imaginedWorld = safeUpdate(game, [move])
    let nextPlays = validPlays(imaginedWorld, rest)
    if (nextPlays.length > 0) {
      for (let play of nextPlays) {
        results.push([move, ...play])
      }
    } else {
      results.push([move])
    }
  }
  return results
}

// move the pieces
export function update(game: Game, moves: Move[]) {
  moves.forEach((m) => {
    let [origin, dest] = m;
    let piece: Player;
    if (origin == "bar") {
      // if moving in from the bar, remove one of that color from the bar
      piece = game.bar.splice(game.bar.indexOf(game.turn), 1)[0];
    } else {
      piece = game.positions[origin].pop() as Player;
    }

    // TODO: remove assertion
    console.assert(piece == game.turn, { move: m, moves, turn: game.turn, positions: game.positions})

    // if bearing off, move to home
    if (dest == "home") {
      let playerHome = game.turn == "w" ? "wHome" : "bHome";
      game[playerHome].push(piece)
      return;
    }

    // if it's a hit, move whatever's in dest to the bar
    let hit = game.positions[dest].length > 0 && game.positions[dest][0] != game.turn;
    if (hit) {
      let pieceHit = game.positions[dest].pop()
      if (pieceHit) {
        game.bar.push(pieceHit);
      }
    }

    game.positions[dest].push(piece);
  });
}

function formatStart(s: Start): string {
  if (typeof s == 'number') {
    return (s + 1).toString()
  } else {
    return s
  }
}
function formatDest(d: Dest): string {
  if (typeof d == 'number') {
    return (d + 1).toString()
  } else {
    return d
  }
}
function formatMove(move: Move): string {
  return `${formatStart(move[0])}>${formatDest(move[1])}`;
}

function formatTurn(player: Player, roll: Roll, moves: Move[]): string {
  return `\n${player} rolled ${roll}\n ${moves.map(formatMove).join(', ')}\n`
}

export type Win = Player | false

export function checkWinner(game: Game): Win {
  if (game.bHome.length == 15) {
    return 'b';
  } else if (game.wHome.length == 15) {
    return 'w';
  } else {
    return false
  }
}

type Log = (string) => void

export function takeTurn(game: Game, log: Log): Win {
  let winner = checkWinner(game);
  if (winner) { 
    log(winner + ' wins! Game over.\n');
    return winner
  }

  let rolls = roll();
  let mvs = orderedValidPlays(game, rolls);
  if (mvs.length > 0) {
    let c = choice(game, mvs);
    update(game, c);
    if (game.bar.length > 0) {
      log(`bar: ${game.bar.toString()}\n`)
    }
    if (game.bHome.length > 0) {
      log(`bHome: ${game.bHome.length}\n`)
    }
    if (game.wHome.length > 0) {
      log(`wHome: ${game.wHome.length}\n`)
    }
    log(formatTurn(game.turn, rolls, c));
  } else {
    log(`\n${game.turn} rolled ${rolls}\nNo available moves.\n`)
  }

  winner = checkWinner(game);
  if (winner) { 
    log(winner + ' wins! Game over.\n');
    return winner
  }

  log(`\n\n${game.turn}'s turn`)
  game.turn = game.turn == "w" ? "b" : "w"; // next player's turn
  return false
}
