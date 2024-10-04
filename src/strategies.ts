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

const safetyEval: EvaluationFunction = (game, player) => {
  let score = 0;
  // Penalize being on the bar
  score -= player === WHITE ? game.wBar * 10 : game.bBar * 10;

  // Reward pieces in home
  score += player === WHITE ? game.wHome : game.bHome;

  // Check for blots and safety
  for (let i = 0; i < 24; i++) {
    const pos = game.positions[i];
    if ((pos & player) === player) {
      const count = pos & 0b1111;
      if (count === 1) {
        score -= 5; // Penalize blots
      } else if (count >= 2) {
        score += 1; // Slight reward for safe points
      }
    }
  }

  return score;
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

const safety = useEval(safetyEval);

const Strategies = { first, second, last, random, pseudorandom, cheapmod, safety }
export { Strategies }
