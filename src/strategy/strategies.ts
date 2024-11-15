import type { Result, Player, Game, Roll } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import { factors as f, EvaluationFunction } from "./factors";
import { evaluate } from "./evaluate";
import { useMCTS } from "./mcts";

export type Strategy = (options: Result[]) => Result;
export type AppliedStrategy = ((game: Game, roll: Roll) => Result) & {
  description?: string;
  sname?: string;
};

function applyStrategy(game: Game, roll: Roll, strategy: Strategy): Result {
  const options = h.validMoves(game, roll);
  let choice;
  if (options.length) {
    choice = strategy(options);
  }
  return choice;
}

function makeApplied(strategy: Strategy): AppliedStrategy {
  return function (game, roll) {
    return applyStrategy(game, roll, strategy);
  };
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
  const evaluateOption = ([move, game]) => evalFunc(game, game.turn);

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
    let sampleOptions = bestN(options, sampleMoves, evaluateOption);
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

// handful of random-ish strategies
const first = (options: Result[]) => options && options[0];
const second = (options: Result[]) => (options && options[1]) || options[0];
const last = (options: Result[]) => options && options[options.length - 1];
function _random(options: Result[]): Result {
  let choice = options[Math.floor(Math.random() * options.length)];
  return choice;
}

const random = makeApplied(_random);
random.description = `Chooses a random valid move each turn.`;

const balanced = useEval(evaluate(f.balancedFactors));
balanced.description = `A well-rounded evaluation strategy.

Evaluation functions look at the next board state for each valid move, and choose by weighing different factors.

Mixes defensive positioning (blot protection, anchors), race progress, board control (primes, home board), and risk management.

Weights:
${JSON.stringify(f.balancedFactors, null, 2)}

Has proven most effective in practice.`;

const runner = useEval(evaluate(f.runnerFactors));
runner.description = `An aggressive racing strategy. Bring the pieces home!

Evaluation functions look at the next board state for each valid move, and choose by weighing different factors.

The racing strategy values pip count, with low weights on defensive positioning, and strong preference for home board occupation.

Features:
${JSON.stringify(f.runnerFactors, null, 2)}`;

const learned = useEval(evaluate(f.learned));
learned.description = `An evaluation function using machine-learned weights.

Evaluation functions look at the next board state for each valid move, and choose by weighing different factors.

Notable patterns:
- high blot penalty (4.45 vs 0.2 in balanced),
- emphasis on contact pip count (6.20 vs 0.005),
- low home board value
- moderate anchor importance

Features:
${JSON.stringify(f.learned, null, 2)}

See src/learnFactors.ts for details.`;

const expectimax = makeApplied(useExpectimax(evaluate(f.balancedFactors), 2));
expectimax.description = `Looks at future moves to (try) to choose the best path.

2-ply depth (searches 2 turns ahead). Considers all possible dice rolls.

Uses balanced evaluation for position assessment.

High branching factor limits search depth.`;

const balancedFastExpectimax = makeApplied(useSpeedExpectimax(evaluate(f.balancedFactors), 3, 5, 5));
balancedFastExpectimax.description = `Faster expectimax variant, using sampling.

Instead of exploring all possible future states, this looks at 5 dice rolls and 5 moves.

Trades complete analysis for speed, which allows deeper search: 3 moves ahead instead of 2 for vanilla expectimax.

Uses balanced factors for evaluation.`;

const learnedFastExp = makeApplied(useSpeedExpectimax(evaluate(f.learned), 3, 5, 5));
learnedFastExp.description = `Fast expectimax variant w/ sampling, using learned factors.

Instead of exploring all possible future states, this looks at 5 dice rolls and 5 moves.

Trades complete analysis for speed, which allows deeper search: 3 moves ahead instead of 2 for vanilla expectimax.

Uses learned factors for evaluation.`;

const fastOnePlyExpectimax = makeApplied(useSpeedExpectimax(evaluate(f.balancedFactors), 1, 10, 5));
fastOnePlyExpectimax.description = `Ultra-fast single-ply sampling expectimax. Samples 10 rolls
and 5 moves, but only looks one move ahead. Quick responses while maintaining some probability assessment.`;

const mcts = useMCTS({ explore: 0.3, simulations: 50, rolloutStrategy: balanced });
mcts.description = `(slow) Monte Carlo Tree Search with balanced evaluation rollouts.

Uses 50 simulations per move with 0.3 exploration constant.

Currently not performing well, possibly due to limited simulation count.`;

const mctsRandomRollouts = useMCTS({ explore: 0.3, simulations: 50, rolloutStrategy: random });
mctsRandomRollouts.description = `(slow) MCTS using random move selection for rollouts.

Same parameters as balanced MCTS (50 sims, 0.3 explore) but uses random moves during rollouts.

Interesting comparison point for heuristic impact on MCTS.`;

const mctsLearnedRollouts = useMCTS({ explore: 0.3, simulations: 50, rolloutStrategy: learned });
mctsLearnedRollouts.description = `(slow) MCTS using learned evaluation function for rollouts.`;

const prev = useEval(evaluate(f.prevLearned));
const prevPrev = useEval(evaluate(f.prevPrevLearned));
const Strategies = {
  random,
  balanced,
  runner,
  learned,
  expectimax,
  balancedFastExpectimax,
  learnedFastExp,
  fastOnePlyExpectimax,
  mcts,
  mctsRandomRollouts,
  mctsLearnedRollouts,
};
const forCompare = { learned, prev, prevPrev, random };
// export these to check how expectimax helps (or..doesn't)
// const forCompare = { prev, prevPrev, learned, learnedFastExp  }
export { Strategies, forCompare, makeApplied, useExpectimax, useAbPruning, useSpeedExpectimax, useEval, random };
