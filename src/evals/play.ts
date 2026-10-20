import { constants as c, helpers as h } from "../backgammon";
import type { Die, Game, Player, Roll } from "../backgammon";
import type { AppliedStrategy } from "../strategy/strategies";

// mulberry32, a small seeded PRNG
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dice = { die: () => Die; roll: () => Roll };

function seededDice(seed: number): Dice {
  const rand = seededRandom(seed);
  const die = () => (Math.floor(rand() * 6) + 1) as Die;
  return { die, roll: (): Roll => [die(), die()] };
}

// who won, and how many points: 1, 2 for a gammon, 3 for a backgammon, times the cube
type Outcome = { winner: Player; points: number };

const other = (p: Player): Player => (p === c.WHITE ? c.BLACK : c.WHITE);

// play from `game` to the end; game.turn is the player to move. Before each roll except an
// opening `firstRoll`, the player on roll may double; a drop ends the game for the cube's value.
function playOut(game: Game, white: AppliedStrategy, black: AppliedStrategy, dice: Dice, firstRoll?: Roll): Outcome {
  let current = h.cloneGame(game);
  let opening = !!firstRoll;
  let result: ReturnType<typeof h.gameResult>;
  while (!(result = h.gameResult(current))) {
    const mover = h.toMove(current);
    const strategy = mover === c.WHITE ? white : black;
    const opponent = mover === c.WHITE ? black : white;

    if (!opening && h.canDouble(current, mover) && strategy.cube?.double(current)) {
      const takes = opponent.cube ? opponent.cube.take(current) : true;
      if (!takes) return { winner: mover, points: current.cube };
      current.cube *= 2;
      current.cubeOwner = other(mover);
    }

    const roll = opening && firstRoll ? firstRoll : dice.roll();
    opening = false;
    [, current] = h.takeTurn(current, roll, strategy);
  }
  return { winner: result.winner, points: result.points * current.cube };
}

// play one game from the start
function playGame(white: AppliedStrategy, black: AppliedStrategy, seed: number): Outcome {
  const dice = seededDice(seed);

  // roll off: the higher die moves first, and plays the two dice as its first roll
  let wDie: Die, bDie: Die;
  do {
    wDie = dice.die();
    bDie = dice.die();
  } while (wDie === bDie);

  const game = h.newGame();
  game.turn = wDie > bDie ? c.WHITE : c.BLACK;
  return playOut(game, white, black, dice, [wDie, bDie]);
}

const Z_SCORES: Record<number, number> = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576, 0.999: 3.291 };

// two-sided z for common levels; fall back to 95%
function zScore(confidence: number): number {
  return Z_SCORES[confidence] ?? 1.96;
}

type MeanInterval = { mean: number; low: number; high: number; n: number };

// mean and normal-approximation confidence interval
function meanInterval(samples: number[], confidence = 0.95): MeanInterval {
  const n = samples.length;
  const mean = samples.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? samples.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const half = zScore(confidence) * Math.sqrt(variance / n);
  return { mean, low: mean - half, high: mean + half, n };
}

export { seededRandom, seededDice, playOut, playGame, meanInterval, type Dice, type MeanInterval, type Outcome };
