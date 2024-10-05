import type { Result, Player, Game } from './backgammon'
import { constants as c, helpers as h } from './backgammon'

type Strategy = (options: Result[]) => Result;

const first = (options: Result[]) => options && options[0];
const second = (options: Result[]) => options && options[1] || options[0];
const last = (options: Result[]) => options && options[options.length - 1];
function random(options: Result[]): Result { 
  let choice = options[Math.floor(Math.random() * options.length)];
  return choice
}

var randi = 0;
const pseudorandom = (options: Result[]) => {
  return options && options[(randi++) % options.length]
}

var i = 0;
function cheapmod(options: Result[]): Result {
  i = (i & 0b00011111) + 1;
  const index = i & (options.length - 1);
  let choice = options && options[index]
  return choice
}

type EvaluationFunction = (game: Game, player: Player) => number;

const evaluate: (f: Factors) => EvaluationFunction = (f: typeof safetyFactors) => (game, player) => {
  let score = 0;
  score -= (player === c.WHITE ? game.wBar : game.bBar) * f.barPenalty;
  score += (player === c.WHITE ? game.bBar : game.wBar) * f.barReward;
  score += (player === c.WHITE ? game.wHome : game.bHome) * f.homeReward;
  score -= (player === c.WHITE ? game.bHome : game.wHome) * f.homePenalty;

  for (let i = 0; i < 24; i++) {
    const pos = game.positions[i];
    if ((pos & player) === player) {
      const count = pos & 0b1111;
      if (count === 1) {
        score -= f.blotPenalty;
      } else if (count >= 2) {
        score += f.pointsReward;
      }
    }
  }

  score += detectPrimes(game, player) * f.primeReward;

  return score;
}

function detectPrimes(game: Game, player: Player): number {
  let primeCount = 0;
  let consecutivePoints = 0;

  for (let i = 0; i < 24; i++) {
    if ((game.positions[i] & player) === player && (game.positions[i] & 0b1111) >= 2) {
      consecutivePoints++;
      if (consecutivePoints >= 3) {
        primeCount++;
      }
    } else {
      consecutivePoints = 0;
    }
  }

  return primeCount;
}

function useEval(evalFn: EvaluationFunction): Strategy {
  return (options: Result[]) => {
    if (!options) return;
    return options.reduce((best, current) => {
      const player = current[1].turn;
      return evalFn(current[1], player) > evalFn(best[1], player) ? current : best
    });
  }
}

const safetyFactors = {
  barPenalty: 10,
  barReward: 0,
  homeReward: 1,
  homePenalty: 3,
  blotPenalty: 5,
  pointsReward: 1,
  primeReward: 0,
}
type Factors = typeof safetyFactors;
const aggressiveFactors: Factors = {
  barPenalty: 1,
  barReward: 5,
  homeReward: 5,
  homePenalty: 3,
  blotPenalty: 0,
  pointsReward: 0,
  primeReward: 5,
}
const balancedFactors: Factors = {
  barPenalty: 2,
  barReward: 4,
  homeReward: 3,
  homePenalty: 2,
  blotPenalty: 1,
  pointsReward: 2,
  primeReward: 5,
}
const claudeFactors: Factors = {
  barPenalty: 15,
  barReward: 9,
  homeReward: 10,
  homePenalty: 7,
  blotPenalty: 4,
  pointsReward: 4,
  primeReward: 8
}

const safety = useEval(evaluate(safetyFactors));
const aggressive = useEval(evaluate(aggressiveFactors));
const balanced = useEval(evaluate(balancedFactors));
const claude = useEval(evaluate(claudeFactors));

function useExpectimax(evalFunc, startDepth) {
  function expectimax(game: Game, depth: number, isMaxPlayer: boolean): number {
    if (depth === 0 || h.checkWinner(game)) {
      let result = evalFunc(game, game.turn);
      return result; 
    }

    // there's a chance node in between players
    let total = 0;
    for (let roll of c.ALL_ROLLS) {
      const moves = h.validMoves(game, roll);
      const scores = []
      for (let r of moves) {
        let nextGame = r[1]
        scores.push(expectimax(nextGame, depth - 1, !isMaxPlayer))
      }
      let score = isMaxPlayer ? Math.max(...scores) : Math.min(...scores);
      total += score
    }
    const result = total / c.ALL_ROLLS.length;
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
        maxOption = option
      }
    }
    return maxOption
  }

  return _expecti;
}

const aggressiveExpecti = useExpectimax(evaluate(aggressiveFactors), 2);
const balancedExpecti = useExpectimax(evaluate(balancedFactors), 2);
const claudeExpecti = useExpectimax(evaluate(claudeFactors), 2);

const Strategies = { random, safety, aggressive, balanced, claude, balancedExpecti, claudeExpecti }
export { Strategies, useExpectimax }
