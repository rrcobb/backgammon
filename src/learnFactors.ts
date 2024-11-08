import { Game, Player, Roll, constants as c, helpers as h } from './backgammon'
import { Factors, factors as f, evaluate } from './evaluationFns';
import { AppliedStrategy, useEval } from './strategies'

type Position = { game: Game, score: number, roll: Roll }
type GameOutcome = 1 | -1 // 1 for win, -1 for loss

const getLR = (initialLR: number, gameCount: number, decay = 0.9995) => {
    const minLR = 1e-5;
    return Math.max(
        initialLR * Math.pow(decay, gameCount),
        minLR
    );
}

function updateFactors(
  factors: Factors,
  gameHistory: Position[],
  outcome: GameOutcome,
  learningRate: number, 
): Factors {
  const newFactors = {...factors}
  
  for (const key in factors) {
    const tweakedFactors = {...factors}
    tweakedFactors[key] *= 1.01
    
    let improvement = 0
    for (const {game} of gameHistory) {
      const originalEval = evaluate(factors)(game, game.turn)
      const tweakedEval = evaluate(tweakedFactors)(game, game.turn)
      improvement += (tweakedEval - originalEval) * outcome
    }
    
    const clampedImprovement = Math.max(Math.min(improvement, 1), -1)
    newFactors[key] *= (1 + learningRate * clampedImprovement / Math.abs(factors[key]))
  }
  
  return newFactors
}

function normalizeFactors(factors: Factors): Factors {
    const sum = Object.values(factors).reduce((a, b) => a + Math.abs(b), 0)
    const newFactors = {...factors}
    for (const key in factors) {
        newFactors[key] = factors[key] / sum
    }
    return newFactors
}

function trainFactors(
  initialFactors: Factors,
  numGames: number,
  initialLearningRate: number, 
): Factors {
  let currentFactors = initialFactors;
  
  for (let count = 0; count < numGames; count++) {
    const gameHistory: Position[] = []
    let currentEval = evaluate(currentFactors)
    let currentStrategy = useEval(currentEval);

    const opponents = [
      useEval(evaluate(f.balancedFactors)),
      useEval(evaluate(f.balancedFactors)),
      useEval(evaluate(f.balancedFactors)),
      useEval(evaluate(f.runnerFactors)),
      useEval(evaluate(currentFactors))  // self-play
    ];
    let opponent = opponents[count % opponents.length]; // just cycle through

    let game = h.newGame()
    game.turn = c.WHITE as Player;
    while (!h.checkWinner(game)) {
      let roll = h.generateRoll();
      let result = currentStrategy(game, roll)
      if (result) { // else, no valid moves
        game = result[1]
        gameHistory.push({ game, roll, score: currentEval(game, game.turn) })
      }
      game.turn = (game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
      
      if (h.checkWinner(game)) break
      
      // Opponent's turn
      roll = h.generateRoll();
      result = opponent(game, roll)
      if (result) {
        game = result[1]
      }
      game.turn = (game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
    }
    
    const outcome = h.checkWinner(game) == c.WHITE ? 1 : -1
    currentFactors = updateFactors(currentFactors, gameHistory, outcome, getLR(initialLearningRate, count))
    
    // Log progress
    if (count % 100 === 0) {
      // currentFactors = normalizeFactors(currentFactors)
      console.log(`Game ${count}, Current factors:`, currentFactors)
    }
  }
  
  return currentFactors
}

const initialFactors: Factors = {
  barPenalty: 1,
  barReward: 1,
  homeReward: 1,
  homePenalty: 1,
  blotPenalty: 1,
  primeReward: 1,
  racingPipReward: 1,
  contactPipReward: 1,
  positionDecay: 1,
  homeBonus: 1,
  anchorBonus: 1
}

// Train against opponents for 1000 games
const finalFactors = trainFactors(initialFactors, 20000, 0.01)
console.log("Training complete:", finalFactors)
