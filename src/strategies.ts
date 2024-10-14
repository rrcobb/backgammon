import type { Result, Player, Game } from "./backgammon";
import { constants as c, helpers as h } from "./backgammon";
import { evaluate, factors as f, EvaluationFunction } from "./evaluationFns";

type Strategy = (options: Result[]) => Result;

// handful of random-ish strategies
const first = (options: Result[]) => options && options[0];
const second = (options: Result[]) => (options && options[1]) || options[0];
const last = (options: Result[]) => options && options[options.length - 1];
function random(options: Result[]): Result {
  let choice = options[Math.floor(Math.random() * options.length)];
  return choice;
}

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
function useEval(evalFn: EvaluationFunction): Strategy {
  return (options: Result[]) => {
    if (!options) return;
    return options.reduce((best, current) => {
      const player = current[1].turn;
      return evalFn(current[1], player) > evalFn(best[1], player) ? current : best;
    });
  };
}

const safety = useEval(evaluate(f.safetyFactors));
const aggressive = useEval(evaluate(f.aggressiveFactors));
const balanced = useEval(evaluate(f.balancedFactors));
const claude = useEval(evaluate(f.claudeFactors));

/*
  Add some global counters to keep track of calls to different functions.
*/
export const counts = { validMoves: 0, vmCacheHit: 0, evalFunc: 0, expectimax: 0 };
export const resetCounts = () => Object.keys(counts).map((key) => (counts[key] = 0));

function useExpectimax(evalFunc, startDepth) {
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
      counts.validMoves++;
      const moves = h.validMoves(game, roll);
      const scores = [];
      for (let r of moves) {
        let nextGame = r[1];
        scores.push(expectimax(nextGame, depth - 1, !isMaxPlayer));
      }
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

const aggressiveExpecti = useExpectimax(evaluate(f.aggressiveFactors), 2);
const balancedExpecti = useExpectimax(evaluate(f.balancedFactors), 2);
const claudeExpecti = useExpectimax(evaluate(f.claudeFactors), 2);

const Strategies = { random, balanced, claude, claudeExpecti };
export { Strategies, useExpectimax };
