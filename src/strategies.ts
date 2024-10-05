import type { Result, Player, Game } from './backgammon'
import { WHITE } from './backgammon'

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
  score -= (player === WHITE ? game.wBar : game.bBar) * f.barPenalty;
  score += (player === WHITE ? game.bBar : game.wBar) * f.barReward;
  score += (player === WHITE ? game.wHome : game.bHome) * f.homeReward;
  score -= (player === WHITE ? game.bHome : game.wHome) * f.homePenalty;

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
  homeReward: 4,
  homePenalty: 2,
  blotPenalty: 1,
  pointsReward: 1,
  primeReward: 4,
}

const safety = useEval(evaluate(safetyFactors));
const aggressive = useEval(evaluate(aggressiveFactors));
const balanced = useEval(evaluate(balancedFactors));

const Strategies = { first, random, safety, aggressive, balanced }
export { Strategies }
