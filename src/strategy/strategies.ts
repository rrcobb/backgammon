import type { Result, Player, Game, Roll, Move } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import { factors as f, EvaluationFunction } from "./factors";
import type { Factors } from "./factors";
import { evaluate } from "./evaluate";
import { useMCTS } from "./mcts";

/*
  A strategy picks a move. Callers that want to know why (the UI) pass a
  `report` callback, and the strategy calls it with what it computed: the moves
  it considered, best first, valued in its own measure. Callers in hot loops
  (tournaments, rollouts, searches) don't pass one, and pay nothing for it.
*/
export type Candidate = {
  move: Move;
  game: Game;
  value: number; // in the analysis's measure; NaN when there's nothing to compare
  detail?: string; // extra context, e.g. visit counts
};
export type Analysis = {
  measure: string; // what `value` is, e.g. "evaluation" or "rollout win rate"
  percent?: boolean; // value is a probability
  candidates: Candidate[]; // the moves the strategy considered, best first
};
export type Report = (analysis: Analysis) => void;

export type Strategy = (options: Result[], report?: Report) => Result;
export type AppliedStrategy = ((game: Game, roll: Roll, report?: Report) => Result) & {
  description?: string;
  sname?: string;
  factors?: Factors;
};

// validMoves always returns at least one option (a pass when nothing can move)
function applyStrategy(game: Game, roll: Roll, strategy: Strategy, report?: Report): Result {
  return strategy(h.validMoves(game, roll), report);
}

function makeApplied(strategy: Strategy): AppliedStrategy {
  return function (game, roll, report) {
    return applyStrategy(game, roll, strategy, report);
  };
}

const byValue = (a: Candidate, b: Candidate) => b.value - a.value;

// strategies use an evaluation function (depth = 0)
function useEval(evalFn: EvaluationFunction): AppliedStrategy {
  return makeApplied((options: Result[], report?: Report) => {
    let best = options[0];
    let bestScore = -Infinity;
    const candidates: Candidate[] = [];
    for (let current of options) {
      const player = h.toMove(current[1]);
      const score = evalFn(current[1], player)
      if (report) candidates.push({ move: current[0], game: current[1], value: score });
      if (score > bestScore) {
        best = current;
        bestScore = score
      }
    }

    report?.({ measure: "evaluation", candidates: candidates.sort(byValue) });
    return best
  });
}

function useFactors(f: Factors) {
  const strategy = useEval(evaluate(f));
  strategy.factors = f;
  return strategy;
}

/*
  Add some global counters to keep track of calls to different functions.
*/
export const counts = { validMoves: 0, eCacheHit: 0, evalFunc: 0, expectimax: 0, evaluate: 0 };
export const resetCounts = () => (Object.keys(counts) as (keyof typeof counts)[]).forEach((key) => (counts[key] = 0));

// The game states in a Result still have `turn` set to the player who just
// moved; takeTurn is what switches it. Searches call this before generating
// the next player's moves.
function nextToMove(game: Game): Game {
  const next = h.cloneGame(game);
  next.turn = game.turn === c.WHITE ? c.BLACK : c.WHITE;
  return next;
}

// Searches score every leaf from the point of view of the player choosing at the root.
function useExpectimax(evalFunc: EvaluationFunction, startDepth: number) {
  function expectimax(game: Game, depth: number, isMaxPlayer: boolean, player: Player): number {
    counts.expectimax++;

    if (depth === 0 || h.checkWinner(game)) {
      let result = evalFunc(game, player);
      counts.evalFunc++;
      return result;
    }

    // there's a chance node in between players
    let total = 0;
    const toMove = nextToMove(game);
    for (let roll of c.UNIQUE_ROLLS) {
      const moves = h.validMoves(toMove, roll);
      // let extremum = isMaxPlayer ? -Infinity : Infinity;
      const scores: number[] = [];
      for (let r of moves) {
        let nextGame = r[1];
        let score = expectimax(nextGame, depth - 1, !isMaxPlayer, player);
        scores.push(score);
        // extremum = isMaxPlayer !== score > extremum ? extremum : score;
      }
      // let score = extremum;
      let score = isMaxPlayer ? Math.max(...scores) : Math.min(...scores);
      let rollWeight = roll[0] === roll[1] ? 1 : 2;
      total += score * rollWeight;
    }
    const result = total / 36;
    return result;
  }

  function _expecti(options: Result[], report?: Report): Result {
    let maxScore = -Infinity;
    let maxOption = options[0];
    const player = h.toMove(options[0][1]);
    const candidates: Candidate[] = [];
    for (let option of options) {
      let [move, game] = option;
      let score = expectimax(game, startDepth - 1, false, player);
      if (report) candidates.push({ move, game, value: score, detail: `0-ply ${evalFunc(game, player).toFixed(2)}` });
      if (score > maxScore) {
        maxScore = score;
        maxOption = option;
      }
    }
    report?.({ measure: `expected evaluation, ${startDepth}-ply`, candidates: candidates.sort(byValue) });
    return maxOption;
  }

  return _expecti;
}

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
  const evaluateOption = ([, game]: Result) => evalFunc(game, h.toMove(game));

  function expectimax(game: Game, depth: number, isMaxPlayer: boolean, player: Player): number {
    counts.expectimax++;

    if (depth === 0 || h.checkWinner(game)) {
      let result = evalFunc(game, player);
      counts.evalFunc++;
      return result;
    }

    // there's a chance node in between players
    let total = 0;
    let weights = 0;
    const toMove = nextToMove(game);
    let sampleRolls = sample(c.UNIQUE_ROLLS, nSampleRolls);
    for (let roll of sampleRolls) {
      // the mover's best few moves, by the mover's own evaluation
      const moves = bestN(h.validMoves(toMove, roll), sampleMoves, evaluateOption);
      let extremum = isMaxPlayer ? -Infinity : Infinity;
      for (let r of moves) {
        let nextGame = r[1];
        let score = expectimax(nextGame, depth - 1, !isMaxPlayer, player);

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

  function _speedExpecti(options: Result[], report?: Report): Result {
    let maxScore = -Infinity;
    let maxOption = options[0];
    let sampleOptions = bestN(options, sampleMoves, evaluateOption);
    const player = h.toMove(options[0][1]);
    const candidates: Candidate[] = [];
    for (let option of sampleOptions) {
      let [move, game] = option;
      let score = expectimax(game, startDepth - 1, false, player);
      if (report) candidates.push({ move, game, value: score, detail: `0-ply ${evalFunc(game, player).toFixed(2)}` });
      if (score > maxScore) {
        maxScore = score;
        maxOption = option;
      }
    }
    report?.({
      measure: `expected evaluation, ${startDepth}-ply, sampling ${nSampleRolls} rolls; searched its ${sampleMoves} best moves by evaluation`,
      candidates: candidates.sort(byValue),
    });
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

const balanced = useFactors(f.balancedFactors);
balanced.description = `A well-rounded evaluation strategy.

Evaluation functions look at the next board state for each valid move, and choose by weighing different factors.

Mixes defensive positioning (blot protection, anchors), race progress, board control (primes, home board), and risk management.

Weights:
${JSON.stringify(f.balancedFactors, null, 2)}

Has proven most effective in practice.`;

const runner = useFactors(f.runnerFactors);
runner.description = `An aggressive racing strategy. Bring the pieces home!

Evaluation functions look at the next board state for each valid move, and choose by weighing different factors.

The racing strategy values pip count, with low weights on defensive positioning, and strong preference for home board occupation.

Features:
${JSON.stringify(f.runnerFactors, null, 2)}`;

const learned = useFactors(f.learned);
learned.description = `An evaluation function using machine-learned weights.

Evaluation functions look at the next board state for each valid move, and choose by weighing different factors.

The weights were evolved by a genetic algorithm (src/ml/linearFactors/geneticLearning.ts), seeded with
hand-tuned and hill-climbed weights (src/ml/linearFactors/learnFactors.ts).

Features:
${JSON.stringify(f.learned, null, 2)}`;

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

const fastOnePly = makeApplied(useSpeedExpectimax(evaluate(f.learned), 2, 10, 5));
fastOnePly.description = `Fast one-ply sampling expectimax. Takes its 5 best moves by the learned
evaluation, and for each one samples 10 of the opponent's rolls and their 5 best replies.`;

// with 50 simulations each move gets only a few rollouts, which plays close to random;
// against learned, 800 simulations about breaks even and 2000 comes out ahead
const mcts = useMCTS({ explore: 0.3, simulations: 1000, rolloutStrategy: balanced });
mcts.description = `(slow) Monte Carlo Tree Search with balanced evaluation rollouts.

Builds a search tree with chance nodes for the dice: 1000 simulations per move, each
played out to the end of the game by the balanced strategy.`;

const mctsRandomRollouts = useMCTS({ explore: 0.3, simulations: 2000, rolloutStrategy: random });
mctsRandomRollouts.description = `(slow) MCTS using random moves during rollouts, with 2000 simulations per move.

A comparison point for how much the rollout strategy matters.`;

const mctsLearnedRollouts = useMCTS({ explore: 0.3, simulations: 2000, rolloutStrategy: learned });
mctsLearnedRollouts.description = `(slow) MCTS with 2000 simulations per move, played out by the learned strategy.`;

const prev = useFactors(f.prevLearned);
const prevPrev = useFactors(f.prevPrevLearned);
const Strategies = {
  random,
  balanced,
  runner,
  learned,
  expectimax,
  balancedFastExpectimax,
  learnedFastExp,
  fastOnePly,
  mcts,
  mctsRandomRollouts,
  mctsLearnedRollouts,
};
const forCompare = { learnedFastExp, fastOnePly, learned };
// export these to check how expectimax helps (or..doesn't)
// const forCompare = { prev, prevPrev, learned, learnedFastExp  }
type StrategyName = keyof typeof Strategies;
const isStrategyName = (name: string | undefined): name is StrategyName => !!name && name in Strategies;

export { Strategies, forCompare, makeApplied, useExpectimax, useSpeedExpectimax, useEval, random, isStrategyName, type StrategyName };
