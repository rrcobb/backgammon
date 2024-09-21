import { Game, Move, Player, safeUpdate, orderedValidPlays, allRolls, checkWinner } from './game';

export type StrategyName = 'random' | 'evaluate' | 'expectimax' //  | 'mcts' | 'neural'
export type Strategy = (game: Game, moves: Move[][]) => Move[];
type StrategySet = {
  [name in StrategyName]: Strategy;
};

export const STRATEGIES: StrategySet = {
  'random': (_game, moves) =>  moves[Math.floor(Math.random() * moves.length)],
  'evaluate': chooseMove, // effectively depth-0 expectimax, no actual searching
  'expectimax': expectimax,
  // TODO implement alternative strategies
  // 'mcts': (_game, moves) => { throw "implement mcts"},
  // 'neural': (_game, moves) => { throw "implement neural-net" },
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

function _expectimax(game: Game, moves: Move[][], depth: number): [Move[], number] {
  // base case for recursion -- just use the evaluation function for the scores
  let scores;
  if (depth == 0) {
    scores = moves.map(move => evaluate(game, move))
  } else {
    // depth > 0
    scores = moves.map(move => {
      let nextGame = safeUpdate(game, move);
      let rollScores = [];
      for (let roll of allRolls) {
        let legalMoves = orderedValidPlays(nextGame, roll);
        let [move, score] = _expectimax(nextGame, legalMoves, depth - 1);
        rollScores.push(score)
      }
      return rollScores.reduce((sum, score) => sum+score) / rollScores.length;
    })
  }

  const bestScore = Math.min(...scores);
  const bestIndex = scores.indexOf(bestScore);
  return [moves[bestIndex] || [], bestScore];
}

const LOOKAHEAD_DEPTH = 1; // depth is tunable
function expectimax(game: Game, moves: Move[][]): Move[] {
  let [move, score] = _expectimax(game, moves, LOOKAHEAD_DEPTH); 
  return move
}

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

function evaluate(game: Game, moves: Move[]): number {
  let ME = game.turn;
  let g = safeUpdate(game, moves);

  let winner = checkWinner(g);
  if (winner) {
    return winner == ME ? 1 : 0;
  }
  let score = 0;
  // make points and primes
  score += pointsAndPrimes(g)
  // try to hit your opponent
  score += hitOpponent(g)
  // try to get pieces home
  score += home(g)
  // don't leave vulnerable blots
  score += blots(g)

  return Math.tanh(score / 50)
}

function pointsAndPrimes(next: Game): number {
  let myPoints = next.positions
    .map((a, i) => [a, i] as [Player[], number])
    .filter(([a, i]) => (a[0] == next.turn) && a.length >= 2) // my points
    .map(([_, i]) => i)

  let score = 0
  // points for each block
  score += myPoints.length * BLOCK_VALUE

  // score higher for points closer to the golden prime
  let golden = next.turn == "w" ? 18 : 5;
  score += myPoints.reduce((total, block) => total += GOLDEN_VALUE * Math.floor(GOLDEN_DISTANCE/(Math.abs(golden - block) + 1)), 0)

  // score higher for points in sequence (primes)
  let runs: number[] = myPoints.reduce((rs, block: number) => {
    let run: number[] = rs[rs.length] || []
    if (run[run.length] + 1 == block) {
      run.push(block)
    } else {
      rs.push([block])
    }
    return rs
  }, [] as number[][]).map(a => a.length)

  // PRIME_VALUE ^ (length -1)
  score += runs.reduce(length => PRIME_VALUE ** (length - 1), 0)

  return score
}

function blots(next: Game): number {
  let myBlots = next.positions.map((a, i) => [a, i] as [Player[], number])
    .filter(([a, i]) => a[0] == next.turn && a.length == 1) // my blots
    .map(([_, i]) => i)

  // don't leave a blot
  return -(myBlots.length * BLOT_COST)
  // TODO
  // - if you have to leave a blot, leave it in places harder to reach
  // - or, further back in your board
  // - or, if you are beyond the last piece in your opponent
  // - unless you expect to hit your opponent soon
}

function home(next: Game): number {
  let h = next.turn == "w" ? "wHome" : "bHome";
  // sending more pieces home is better
  return next[h].length * HOME_VALUE;
}

function hitOpponent(next: Game) {
  // how many of the opponents pieces will move to the bar?
  let nextcount = next.bar.filter(p => p !== next.turn).length
  // how good is it to send the opponent to the bar?
  return nextcount * BAR_VALUE;
}
