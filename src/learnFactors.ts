import { Game, Player, Roll, constants as c, helpers as h } from './backgammon'
import { Factors, factors as f, evaluate } from './evaluationFns';
import { AppliedStrategy, useEval } from './strategies'

type Position = { game: Game, score: number, roll: Roll }
type GameOutcome = 1 | -1 // 1 for win, -1 for loss

const getLR = (initialLR: number, gameCount: number, decay = 0.9997) => {
    const minLR = 1e-5;
    return Math.max(
        initialLR * Math.pow(decay, gameCount),
        minLR
    );
}

function scaleFactors(factors: Factors): Factors {
    // Instead of normalizing to sum=1, scale to keep factors in reasonable range
    const maxAbsValue = Math.max(...Object.values(factors).map(Math.abs))
    if (maxAbsValue > 10) {
        const scale = 10 / maxAbsValue
        const newFactors = {...factors}
        for (const key in factors) {
            newFactors[key] = factors[key] * scale
        }
        return newFactors
    }
    return factors
}

function updateFactors(
  factors: Factors,
  gameHistory: Position[],
  outcome: GameOutcome,
  learningRate: number,
): Factors {
  const newFactors = {...factors}
  const baselineScores = new Map<string, number>() // Cache game scores
  
  // Compute and cache baseline scores
  for (const {game} of gameHistory) {
    const key = JSON.stringify(game)
    if (!baselineScores.has(key)) {
      baselineScores.set(key, evaluate(factors)(game, game.turn))
    }
  }
  
  // Track factor updates for adaptive learning rates
  const updates = new Map<string, number>()
  
  for (const key in factors) {
    const tweakedFactors = {...factors}
    const perturbation = 0.003 * Math.abs(factors[key]) // Relative perturbation
    tweakedFactors[key] += perturbation
    
    let improvement = 0
    let weightSum = 0
    
    for (let i = 0; i < gameHistory.length; i++) {
      const {game} = gameHistory[i]
      const gameKey = JSON.stringify(game)
      const originalEval = baselineScores.get(gameKey)!
      const tweakedEval = evaluate(tweakedFactors)(game, game.turn)
      
      // Progressive weighting - more weight to later positions
      const weight = Math.exp(i / gameHistory.length - 1)
      weightSum += weight
      
      // Normalize improvement by perturbation size
      improvement += (tweakedEval - originalEval) * weight * outcome / perturbation
    }
    
    // Normalize by total weight
    improvement /= weightSum
    
    // Adaptive learning rate based on recent updates
    const prevUpdate = updates.get(key) || 0
    const adaptiveLR = learningRate * (Math.abs(prevUpdate) < 0.1 ? 1.1 : 0.9)
    
    // Update with momentum and gradient clipping
    const momentum = 0.5
    const gradientClip = 0.3
    const clampedImprovement = Math.max(Math.min(improvement, gradientClip), -gradientClip)
    const update = adaptiveLR * clampedImprovement + momentum * prevUpdate
    
    newFactors[key] += update
    updates.set(key, update)
    
    // Ensure factor doesn't change sign unless very close to zero
    if (Math.abs(factors[key]) > 0.1 && 
        Math.sign(newFactors[key]) !== Math.sign(factors[key])) {
      newFactors[key] = factors[key] * 0.5 // Halve instead of changing sign
    }
  }
  
  return scaleFactors(newFactors)
}

function trainFactors(
  initialFactors: Factors,
  numGames: number,
  initialLearningRate: number, 
): Factors {
  let currentFactors = {...initialFactors};
  let bestFactors = {...currentFactors};
  let bestWinRate = -Infinity;
  
  const windowSize = 100;
  const recentOutcomes: GameOutcome[] = [];
  const rollingFactors: Factors[] = [];
  const rollingWindow = 10;
  
  for (let count = 0; count < numGames; count++) {
    const gameHistory: Position[] = []
    const currentEval = evaluate(currentFactors)
    const currentStrategy = useEval(currentEval);

    // Opponent selection with curriculum learning
    const winRate = recentOutcomes.length > 0 
      ? recentOutcomes.filter(o => o === 1).length / recentOutcomes.length
      : 0;
      
    const opponents = [ 
      useEval(evaluate(f.balancedFactors)),
      useEval(evaluate(f.balancedFactors)),
      useEval(evaluate(initialFactors)),
      useEval(evaluate(bestFactors)),
      useEval(evaluate(currentFactors))
    ];
    
    const opponent = opponents[Math.floor(Math.random() * opponents.length)];
    
    let game = h.newGame()
    game.turn = c.WHITE as Player;
    
    const maxMoves = 200;
    let moveCount = 0;
    
    while (!h.checkWinner(game) && moveCount < maxMoves) {
      moveCount++;
      let roll = h.generateRoll();
      let result = currentStrategy(game, roll)
      if (result) {
        game = result[1]
        gameHistory.push({ 
          game, 
          roll, 
          score: currentEval(game, game.turn)
        })
      }
      game.turn = (game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
      
      if (h.checkWinner(game)) break
      
      roll = h.generateRoll();
      result = opponent(game, roll)
      if (result) {
        game = result[1]
      }
      game.turn = (game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
    }
    
    const outcome = moveCount >= maxMoves ? -1 : (h.checkWinner(game) == c.WHITE ? 1 : -1);
    recentOutcomes.push(outcome);
    if (recentOutcomes.length > windowSize) recentOutcomes.shift();
    
    currentFactors = updateFactors(
      currentFactors, 
      gameHistory, 
      outcome, 
      getLR(initialLearningRate, count)
    );
    
    // Rolling average of factors
    rollingFactors.push({...currentFactors});
    if (rollingFactors.length > rollingWindow) {
      rollingFactors.shift();
      // Average the recent factors
      const avgFactors: Factors = {...currentFactors};
      for (const key in currentFactors) {
        avgFactors[key] = rollingFactors.reduce((sum, f) => sum + f[key], 0) / rollingFactors.length;
      }
      currentFactors = avgFactors;
    }
    
    // Track best performing factors
    if (recentOutcomes.length === windowSize) {
      const winRate = recentOutcomes.filter(o => o === 1).length / windowSize;
      if (winRate > bestWinRate) {
        bestWinRate = winRate;
        bestFactors = {...currentFactors};
        console.log(`New best win rate: ${(winRate * 100).toFixed(1)}% at game ${count}`);
      }
    }

    if (count % 500 === 0) {
      const validationGames = 100;
      let wins = 0;
      const balanced = useEval(evaluate(f.balancedFactors));

      for (let i = 0; i < validationGames; i++) {
        // Play a validation game against balanced strategy
        let vGame = h.newGame();
        vGame.turn = c.WHITE as Player;
        const strategy = useEval(evaluate(currentFactors));

        while (!h.checkWinner(vGame)) {
          let roll = h.generateRoll();
          let result = strategy(vGame, roll);
          if (result) vGame = result[1];
          vGame.turn = (vGame.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;

          if (h.checkWinner(vGame)) break;

          roll = h.generateRoll();
          result = balanced(vGame, roll);
          if (result) vGame = result[1];
          vGame.turn = (vGame.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
        }

        if (h.checkWinner(vGame) === c.WHITE) wins++;
      }

      const validationWinRate = wins / validationGames;
      console.log(`Validation win rate vs balanced: ${(validationWinRate * 100).toFixed(1)}%`);

      // Only update best factors if we actually beat balanced strategy
      if (validationWinRate > 0.5 && validationWinRate > bestWinRate) {
        bestWinRate = validationWinRate;
        bestFactors = {...currentFactors};
      }
    }

    // Log progress
    if (count % 100 === 0) {
      const winRate = recentOutcomes.length > 0 
        ? recentOutcomes.filter(o => o === 1).length / recentOutcomes.length
        : 0;
        console.log(`Game ${count}, Win rate: ${(winRate * 100).toFixed(1)}%, Factors:`, 
                    Object.fromEntries(
                      Object.entries(currentFactors)
                      .map(([k, v]) => [k, v.toFixed(3)])
                    )
                   );
    }
  }

  return bestFactors;
}

const initialFactors: Factors = f.prevLearned; 

// Train against opponents
const finalFactors = trainFactors(initialFactors, 10000, 0.02)
console.log("Training complete. Best factors found:", finalFactors)
