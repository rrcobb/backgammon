import { Game, Move, Player, safeUpdate, orderedValidPlays, allRolls, checkWinner } from './game';
import { toBinary } from './compress'

export type StrategyName = 'random' | 'evaluate' | 'expectimax' //  | 'mcts' | 'neural'
export type Strategy = (game: Game, moves: Move[][]) => Move[];
type StrategySet = {
  [name in StrategyName]: Strategy;
};

export const runtimeStats = {
  "makeKey": [],
  "safeUpdate": [],
  "evaluate": [],
  "expectimax": [],
}

export function measure(fn, name=undefined, doit=true) {
  if (!doit) { return fn }
  runtimeStats[name || fn.name] = [];
  return (...args) => {
    const start = performance.now();
    const result = fn(...args) 
    const end = performance.now();
    runtimeStats[name || fn.name].push(end - start)
    return result
  }
}

export const makeKey = measure((game: Game, moves: Move[]) => {
  let bin = toBinary(game)
  let result = ''
  for (var i = 0, itemLen = bin.length; i < itemLen; result += bin[i++]);
  result += '|'
  let movesArr = new Uint8Array(moves.flat());
  for (var i = 0, itemLen = movesArr.length; i < itemLen; result += movesArr[i++]);
  return result
}, 'makeKey')

export function memoize(fn, keyfn, name, skip=false) {
  if (skip) { return fn }
  let cache = {}
  return (...args) => {
    let key = keyfn(...args);
    if (cache[key]) {
      return cache[key];
    } else {
      if (runtimeStats[name]) {
        runtimeStats[name].cacheMisses = (runtimeStats[name].cacheMisses || 0) + 1
      }
      let result = fn(...args);
      cache[key] = result;
      return result;
    }
  }
}

// decide on a move among the possible moves, based on the current state of the game
export function choice(game: Game, moves: Move[][]): Move[] {
  let strat = game.turn == "w" ? game.wStrategy : game.bStrategy
  return STRATEGIES[strat](game, moves)
}

function chooseMove(game: Game, moves: Move[][]): Move[] {
  // This function chooses the best move statically, based on the current backgammon game state.
  let [bestMove, ...rest] = moves;
  let bestScore = evaluate(game, moves[0]);
  for (let move of rest) {
    let score = evaluate(game, move)
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove
}

const randomN = (arr, n) => {
  if (arr.length <= n) {
    return arr
  } else {
    return arr.slice().sort((a,b) => 0.5 > Math.random()).slice(0,n)
  }
}

const LOOKAHEAD_DEPTH = 1; // depth is tunable
const ROLL_PRUNING = 4; // take all the rolls (faster if more rolls are pruned)

const _expectimax = measure(function em(game: Game, moves: Move[][], depth: number): [Move[], number] {
  let scores;
  let bestFun;
  if (depth == 0) {
    // base case for recursion -- just use the evaluation function for the scores
    scores = moves.map(move => evaluate(game, move))
    // always maximizing the evaluation in the base case
    bestFun = Math.max
  } else {
    // depth > 0, so look deeper into the game tree
    scores = moves.map(move => {
      let nextGame = safeUpdate(game, move);
      let rollScores = [];
      for (let roll of randomN(allRolls, 36)) {
        let legalMoves = orderedValidPlays(nextGame, roll);
        let [move, score] = _expectimax(nextGame, legalMoves, depth - 1);
        rollScores.push(score);
      }
      return rollScores.reduce((sum, score) => sum+score) / rollScores.length;
    })
    // always minimize the score of your opponent
    bestFun = Math.min;
  }

  const bestScore = bestFun(...scores);
  const bestIndex = scores.indexOf(bestScore);
  return [moves[bestIndex] || [], bestScore];
}, '_expectimax')

const expectimax = measure(function expectimax(game: Game, moves: Move[][]): Move[] {
  let [move, score] = _expectimax(game, moves, LOOKAHEAD_DEPTH); 
  return move
})

// #########
// ## Backgammon evaluation function
// #########
//
// It attempts to make points, make and keep primes, hit the opponent's pieces,
// and when possible, not leave vulnerable blots, especially ones that are likely to be hit
// and closer to the player's home board.
//
// TODO: use the recommended starts table
// TODO: custom bearing-off function?
//   may not actually matter
//   fill an empty spot, instead of stacking

// TODO Risk level
// - settable
// - behind: increase risk-taking
// - if you have a good defensive prime: increase risk-taking with other pieces
// - affect willingness to leave a blot
// - affect willingness to hit your opponent, if it would leave you vulnerable
// returns a numeric score

// Tunable constants
const BAR_VALUE = 12;
const HOME_VALUE = 3;
const BLOCK_VALUE = 2;
const GOLDEN_VALUE = 2;
const GOLDEN_DISTANCE = 5;
const PRIME_VALUE = 1;
const BLOT_COST = 2;

const GOLDEN_WHITE = 18;
const GOLDEN_BLACK = 5;
const PRIME_VALUES = [0, 0, 1, 2, 4, 8, 16];

const evaluate = measure(memoize(function evaluate(game: Game, moves: Move[]): number {
  const ME = game.turn;
  const g = safeUpdate(game, moves);
  const winner = checkWinner(g);
  if (winner) {
    return winner == ME ? 1 : 0;
  }
  let score = 0;
  score += pointsAndPrimes(g)
  score += hitOpponent(g)
  score += home(g)
  score += blots(g)
  return Math.tanh(score / 50)
}, makeKey, 'evaluate', false), 'evaluate')

const pointsAndPrimes = measure(function pnp(next: Game): number {
  const myPoints: number[] = [];
  let score = 0;
  const golden = next.turn === "w" ? GOLDEN_WHITE : GOLDEN_BLACK;

  for (let i = 0; i < next.positions.length; i++) {
    const position = next.positions[i];
    if (position[0] === next.turn && position.length >= 2) {
      myPoints.push(i);
      score += BLOCK_VALUE;
      score += GOLDEN_VALUE * Math.floor(GOLDEN_DISTANCE / (Math.abs(golden - i) + 1));
    }
  }

  let currentRun = 1;
  for (let i = 1; i < myPoints.length; i++) {
    if (myPoints[i] === myPoints[i - 1] + 1) {
      currentRun++;
    } else {
      score += PRIME_VALUES[Math.min(currentRun, 6)];
      currentRun = 1;
    }
  }
  score += PRIME_VALUES[Math.min(currentRun, 6)];

  return score;
}, 'pointsAndPrimes', false)


const blots = measure(function blots(next: Game): number {
  let blotCount = 0;
  for (const position of next.positions) {
    if (position[0] === next.turn && position.length === 1) {
      blotCount++;
    }
  }
  return -(blotCount * BLOT_COST);
  // TODO
  // - if you have to leave a blot, leave it in places harder to reach
  // - or, further back in your board
  // - or, if you are beyond the last piece in your opponent
  // - unless you expect to hit your opponent soon
}, 'blots', false)

function home(next: Game): number {
  let h = next.turn == "w" ? "wHome" : "bHome";
  // sending more pieces home is better
  return next[h].length * HOME_VALUE;
}

function hitOpponent(next: Game) {
  return next.bar.filter(p => p !== next.turn).length * BAR_VALUE;
}

export const STRATEGIES: StrategySet = {
  'random': (_game, moves) =>  moves[Math.floor(Math.random() * moves.length)],
  'evaluate': chooseMove, // effectively depth-0 expectimax, no actual searching
  'expectimax': expectimax,
  // TODO implement alternative strategies
  // 'mcts': (_game, moves) => { throw "implement mcts"},
  // 'neural': (_game, moves) => { throw "implement neural-net" },
}
