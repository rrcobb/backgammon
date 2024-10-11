import type { Result, Player, Game } from "./backgammon";
import { constants as c, helpers as h } from "./backgammon";
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
};

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

const safetyFactors = {
  barPenalty: 10,
  barReward: 0,
  homeReward: 1,
  homePenalty: 3,
  blotPenalty: 5,
  pointsReward: 1,
  primeReward: 0,
};
type Factors = typeof safetyFactors;
const aggressiveFactors: Factors = {
  barPenalty: 1,
  barReward: 5,
  homeReward: 5,
  homePenalty: 3,
  blotPenalty: 0,
  pointsReward: 0,
  primeReward: 5,
};
const balancedFactors: Factors = {
  barPenalty: 2,
  barReward: 4,
  homeReward: 3,
  homePenalty: 2,
  blotPenalty: 1,
  pointsReward: 2,
  primeReward: 5,
};
const claudeFactors: Factors = {
  barPenalty: 15,
  barReward: 9,
  homeReward: 10,
  homePenalty: 7,
  blotPenalty: 4,
  pointsReward: 4,
  primeReward: 8,
};

const factors = { safetyFactors, aggressiveFactors, balancedFactors, claudeFactors };

export { evaluate, factors };
