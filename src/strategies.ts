import type { Result, Player, Game, Roll } from "./backgammon";
import { constants as c, helpers as h, generateGameKey } from "./backgammon";
import { evaluate, factors as f, EvaluationFunction } from "./evaluationFns";
import { useMCTS } from "./mcts"

export type Strategy = (options: Result[]) => Result;
export type AppliedStrategy = (game: Game, roll: Roll) => Result;

function applyStrategy(game: Game, roll: Roll, strategy: Strategy): Result {
  const options = h.validMoves(game, roll);
  let choice;
  if (options.length) {
    choice = strategy(options);
  }
  return choice
}

function makeApplied(strategy: Strategy): AppliedStrategy {
  return function(game, roll) {
    return applyStrategy(game, roll, strategy);
  }
}

// handful of random-ish strategies
// todo: make these applied
const first = (options: Result[]) => options && options[0];
const second = (options: Result[]) => (options && options[1]) || options[0];
const last = (options: Result[]) => options && options[options.length - 1];
function _random(options: Result[]): Result {
  let choice = options[Math.floor(Math.random() * options.length)];
  return choice;
}

const random = makeApplied(_random);

var randi = 0;
const pseudorandom = (options: Result[]) => {
  return options && options[randi++ % options.length];
};

var i = 0;
function cheapmod(options: Result[]): Result {
  i = (i & 0b00011111) + 1;
  const index = i & (options.length - 1);
  let choice = options && options[index];
  return choice;
}

// strategies use an evaluation function (depth = 0)
function useEval(evalFn: EvaluationFunction): AppliedStrategy {
  return makeApplied((options: Result[]) => {
    if (!options) return;
    return options.reduce((best, current) => {
      const player = current[1].turn;
      return evalFn(current[1], player) > evalFn(best[1], player) ? current : best;
    });
  });
}

/*
  Add some global counters to keep track of calls to different functions.
*/
export const counts = { pruned: 0, validMoves: 0, eCacheHit: 0, evalFunc: 0, expectimax: 0, evaluate: 0 };
export const resetCounts = () => Object.keys(counts).map((key) => (counts[key] = 0));

function useExpectimax(evalFunc: EvaluationFunction, startDepth: number) {
  function expectimax(game: Game, depth: number, isMaxPlayer: boolean): number {
    counts.expectimax++;

    if (depth === 0 || h.checkWinner(game)) {
      let result = evalFunc(game, game.turn);
      counts.evalFunc++;
      return result;
    }

    // there's a chance node in between players
    let total = 0;
    for (let roll of c.UNIQUE_ROLLS) {
      const moves = h.validMoves(game, roll);
      // let extremum = isMaxPlayer ? -Infinity : Infinity;
      const scores: number[] = [];
      for (let r of moves) {
        let nextGame = r[1];
        let score = expectimax(nextGame, depth - 1, !isMaxPlayer);
        scores.push(score);
        // extremum = isMaxPlayer !== score > extremum ? extremum : score;
      }
      // let score = extremum;
      let score = isMaxPlayer ? Math.max(...scores) : Math.min(...scores);
      let rollWeight = roll[0] === roll[1] ? 1 : 2;
      total += score * rollWeight;
    }
    const result = total / 36; // c.ALL_ROLLS.length;
    return result;
  }

  function _expecti(options: Result[]): Result {
    let maxScore = -Infinity;
    let maxOption = null;
    for (let option of options) {
      let [move, game] = option;
      let score = expectimax(game, startDepth - 1, false);
      if (score > maxScore) {
        maxScore = score;
        maxOption = option;
      }
    }
    return maxOption;
  }

  return _expecti;
}

const useAbPruning = (evalFunc: EvaluationFunction, startDepth: number) => {
  function expectimax(game: Game, depth: number, isMaxPlayer: boolean, alpha: number = -Infinity, beta: number = Infinity): number {
    counts.expectimax++;

    if (depth === 0 || h.checkWinner(game)) {
      counts.evalFunc++;
      return evalFunc(game, game.turn);
    }

    let total = 0;
    for (let roll of c.UNIQUE_ROLLS) {
      const moves = h.validMoves(game, roll);
      let rollScore = isMaxPlayer ? -Infinity : Infinity;
      // scope these here to not pollute other rolls
      let a = alpha;
      let b = beta;
      for (let [_, nextGame] of moves) {
        let score = expectimax(nextGame, depth - 1, !isMaxPlayer, alpha, beta);
        if (isMaxPlayer) {
          // max
          rollScore = score > rollScore ? score : rollScore;
          a = rollScore > a ? rollScore : a;
        } else {
          // min
          rollScore = rollScore < score ? rollScore : score;
          b = rollScore < b ? rollScore : b;
        }
        if (a >= b) {
          counts.pruned++;
          break; // Prune
        }
      }
      let rollWeight = roll[0] === roll[1] ? 1 : 2;
      total += rollScore * rollWeight;
    }
    return total / 36;
  }

  function _expecti(options: Result[]): Result {
    let maxScore = -Infinity;
    let maxOption = null;
    let alpha = -Infinity;
    for (let option of options) {
      let [move, game] = option;
      let score = expectimax(game, startDepth - 1, false, alpha, Infinity);
      if (score > maxScore) {
        maxScore = score;
        maxOption = option;
      }
      alpha = score > alpha ? score : alpha;
    }
    return maxOption;
  }

  return _expecti;
};

function sample<T>(list: Array<T>, sampleSize: number): Array<T> {
  if (list.length < sampleSize) return list;

  const s: Set<T> = new Set();
  for (let i = 0; i < sampleSize; i++) {
    let index = Math.floor(Math.random() * list.length);
    s.add(list[index]);
  }
  return Array.from(s);
}

function bestN<T>(list: Array<T>, sampleSize: number, metric: (a: T) => number): Array<T> {
  if (sampleSize > list.length) return list;

  const best = new Array(sampleSize);
  const bestScores = new Array(sampleSize).fill(-Infinity);

  for (let item of list) {
    const score = metric(item);
    
    let insertIndex = -1;
    for (let i = 0; i < sampleSize; i++) {
      if (score > bestScores[i]) {
        insertIndex = i;
        break;
      }
    }
    
    if (insertIndex !== -1) {
      // Shift elements to make room for the new item
      for (let i = sampleSize - 1; i > insertIndex; i--) {
        best[i] = best[i - 1];
        bestScores[i] = bestScores[i - 1];
      }
      
      // Insert the new item
      best[insertIndex] = item;
      bestScores[insertIndex] = score;
    }
  }

  return best;
}

function useSpeedExpectimax(evalFunc: EvaluationFunction, startDepth: number, nSampleRolls: number, sampleMoves: number) {
  const evaluateOption = ([move, game]) => evalFunc(game, game.turn)

  function expectimax(game: Game, depth: number, isMaxPlayer: boolean): number {
    counts.expectimax++;

    if (depth === 0 || h.checkWinner(game)) {
      let result = evalFunc(game, game.turn);
      counts.evalFunc++;
      return result;
    }

    // there's a chance node in between players
    let total = 0;
    let weights = 0;
    let sampleRolls = sample(c.UNIQUE_ROLLS, nSampleRolls);
    for (let roll of sampleRolls) {
      const moves = bestN(h.validMoves(game, roll), sampleMoves, evaluateOption);
      let extremum = isMaxPlayer ? -Infinity : Infinity;
      for (let r of moves) {
        let nextGame = r[1];
        let score = expectimax(nextGame, depth - 1, !isMaxPlayer);

        // typescript likes !== for XOR; this would be ^ otherwise
        extremum = isMaxPlayer !== score > extremum ? extremum : score;
      }
      let rollWeight = roll[0] === roll[1] ? 1 : 2;
      weights += rollWeight;
      total += extremum * rollWeight;
    }
    const result = total / weights;
    return result;
  }

  function _speedExpecti(options: Result[]): Result {
    let maxScore = -Infinity;
    let maxOption = null;
    let sampleOptions = bestN(options, sampleMoves, evaluateOption)
    for (let option of sampleOptions) {
      let [move, game] = option;
      let score = expectimax(game, startDepth - 1, false);
      if (score > maxScore) {
        maxScore = score;
        maxOption = option;
      }
    }
    return maxOption;
  }

  return _speedExpecti;
}

const balanced = useEval(evaluate(f.balancedFactors));
const runner = useEval(evaluate(f.runnerFactors));

const balancedExpecti = makeApplied(useExpectimax(evaluate(f.balancedFactors), 2));
// pruning, which...ugh.
const balancedAbPrune = makeApplied(useAbPruning(evaluate(f.balancedFactors), 2));

// sampling for speed!
const speedOne = makeApplied(useSpeedExpectimax(evaluate(f.balancedFactors), 1, 10, 5));
const balancedSpeedExpecti = makeApplied(useSpeedExpectimax(evaluate(f.balancedFactors), 2, 10, 5));

const mctsR = useMCTS({ explore: 0.3, simulations: 50, rolloutStrategy: random, });
const mctsB = useMCTS({ explore: 0.3, simulations: 50, rolloutStrategy: balanced, });

const Strategies = {
  // random,
  balanced,
  runner,
  // balancedAbPrune, // ... pruning isn't very good...
  // balancedExpecti,
  // balancedSpeedExpecti,
  // speedOne,
  // mctsR,
  // mctsB,
};
export { Strategies, makeApplied, useExpectimax, useAbPruning, useSpeedExpectimax, random };
