import type { Result, Player, Game } from "./backgammon";
import { constants as c, helpers as h } from "./backgammon";
import { counts } from './strategies';
export type EvaluationFunction = (game: Game, player: Player) => number;

const evaluate: (f: Factors) => EvaluationFunction = (f: Factors) => (game, player) => {
  counts.evaluate += 1;
  let score = 0;
  score -= (player === c.WHITE ? game.wBar : game.bBar) * f.barPenalty;
  score += (player === c.WHITE ? game.bBar : game.wBar) * f.barReward;
  score += (player === c.WHITE ? game.wHome : game.bHome) * f.homeReward;
  score -= (player === c.WHITE ? game.bHome : game.wHome) * f.homePenalty;

  let lastWhite = -1;
  let firstBlack = 24;
  let whitePips = 0;
  let blackPips = 0;

  for (let i = 0; i < 24; i++) {
    const pos = game.positions[i];
    const count = pos & 0b1111;

    if ((pos & c.WHITE) === c.WHITE) { 
      lastWhite = i;
      whitePips += count * (i + 1);
    }

    if ((pos & c.BLACK) === c.BLACK && firstBlack == 24) { 
      firstBlack = i;
      blackPips += count * (24 - i);
    }

    if ((pos & player) === player) {
      const count = pos & 0b1111;
      if (count === 1) {
        const hitChance = blotHitChance(game, i, player);
        score += getPositionValue(i, player, f) * (1 - hitChance) 
        score -= hitChance * f.blotPenalty;
      } else if (count >= 2) {
        score += getPositionValue(pos, player, f);
      }
    }
  }

  score += detectPrimes(game, player) * f.primeReward;

  let pipDiff = whitePips - blackPips;
  pipDiff = player === c.WHITE ? pipDiff : -pipDiff;

  const isRacing = lastWhite < firstBlack;
  if (isRacing) {
    score += (pipDiff/24) * f.racingPipReward;  
  } else {
    score += (pipDiff/24) * f.contactPipReward;  
  }

  return score;
};

function getPositionValue(pos: number, player: Player, f: Factors): number {
  // Convert position to white's perspective for consistent calculations
  const whitePos = player === c.WHITE ? pos : 23 - pos;
  let value = 1.0;

  const HOME_FIVE_POINT = 4;
  const dist = Math.abs(whitePos - HOME_FIVE_POINT);
  value += 2.0 * Math.exp(-dist / f.positionDecay);
  
  if (whitePos <= 5) { 
    value += f.homeBonus;
  }
  
  if (whitePos >= 18 && whitePos <= 23) {
    value += f.anchorBonus;
  }
  
  return value;
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

function generateHitProbabilities() {
  const probs = {};
  for (let d = 1; d <= 24; d++) { probs[d] = 0; } // init
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      probs[d1] += 1/36;
      if (d1 !== d2) probs[d2] += 1/36;
      probs[d1 + d2] += 1/36; // using both dice
      if (d1 === d2) { // doubles
        probs[d1 * 3] += 1/36;  // Using 3
        probs[d1 * 4] += 1/36;  // Using all 4
      }
    }
  }
  return probs;
}

const probMap = generateHitProbabilities();

function blotHitChance(game, blotPosition, player) {
  const opponent = player === c.WHITE ? c.BLACK : c.WHITE;
  const direction = opponent === c.BLACK ? -1 : 1;
  let totalProb = 0;

  // Look at each position that could potentially hit
  for (let dist = 1; dist < 24; dist++) {
    if (!probMap[dist]) continue;
    const hitFromPos = blotPosition - (dist * direction);

    // check opponent bar
    if (hitFromPos == -1 && opponent == c.BLACK && game.bBar) totalProb += probMap[dist];
    if (hitFromPos == 24 && opponent == c.WHITE && game.wBar) totalProb += probMap[dist];
    if (hitFromPos <= -1 || hitFromPos >= 24) continue;

    // If there's an opponent piece at this distance
    if ((game.positions[hitFromPos] & opponent) === opponent) {
      const pieceCount = game.positions[hitFromPos] & 0b1111;
      if (pieceCount == 1 || pieceCount >= 3) {
        totalProb += probMap[dist];
      } else {
        totalProb += probMap[dist] / 2; // discount breaking a prime
      }
    }
  }

  return Math.min(1, totalProb); // Cap at 100% chance
}

export type Factors = {
  barPenalty: number,
  barReward: number,
  homeReward: number,
  homePenalty: number,
  blotPenalty: number,
  primeReward: number,
  racingPipReward: number,
  contactPipReward: number,
  positionDecay: number, 
  homeBonus: number,
  anchorBonus: number,
}

const balancedFactors: Factors = {
  barPenalty: 0.3,
  barReward: 0.2,
  homeReward: 0.4,
  homePenalty: 0.2,
  blotPenalty: 0.2,
  primeReward: 4,
  racingPipReward: 0.03,
  contactPipReward: 0.005,
  positionDecay: 2.5,
  homeBonus: 0.3,
  anchorBonus: 0.3,
};

const runnerFactors: Factors = {
  barPenalty: 0,
  barReward: 0,
  homeReward: 10,
  homePenalty: 0,
  blotPenalty: 0,
  primeReward: 0,
  racingPipReward: 0.15,
  contactPipReward: 0.05,
  positionDecay: 5,
  homeBonus: 0.5,
  anchorBonus: 0,
};

// see learnFactors.ts
const learnedFactors = {
  barPenalty: 2.8307972219428397,
  barReward: 0.3937126689098964,
  homeReward: 3.390090505710313e-7,
  homePenalty: 0.017824751927879794,
  blotPenalty: 4.447852644467363,
  primeReward: 0.033077280452456066,
  racingPipReward: 1.4521233734125367,
  contactPipReward: 6.203233892019551,
  positionDecay: 0.8948280636480441,
  homeBonus: 0.000009128115469825048,
  anchorBonus: 0.47597039411035436,
}

const prevLearned = {
  barPenalty: -1.2216017592192547,
  barReward: 0.2657044747485048,
  homeReward: -1.5836819434872464,
  homePenalty: -2.749881081745257,
  blotPenalty: -0.15073448364433956,
  primeReward: 4.50468534720785,
  racingPipReward: 3.2924719692569937,
  contactPipReward: -0.08656665309208121,
  positionDecay: 4.06123028723716,
  homeBonus: 0.8515813895776875,
  anchorBonus: 0.8912373355553285,
}

const factors = { balancedFactors, runnerFactors, learnedFactors, prevLearned };

export { evaluate, factors };
