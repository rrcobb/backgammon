import { Game, Player, Roll, constants as c, helpers as h } from './backgammon'
import { Factors, factors as f, evaluate } from './evaluationFns';
import { AppliedStrategy, useEval } from './strategies'
import { default as learnedFactors } from './learnedFactors.json';

type Position = { game: Game, score: number, roll: Roll }
type GameOutcome = 1 | -1 // 1 for win, -1 for loss

const factorScales = {
  barPenalty: 1,
  barReward: 1, 
  homeReward: 1,
  homePenalty: 1,
  blotPenalty: 1,
  primeReward: 0.25,  // Primes are rare (0-2), so small divisor = larger effective LR
  racingPipReward: 60, // Pip differences are large (20-50), so large divisor = smaller effective LR
  contactPipReward: 60, // Same as racing
  positionDecay: 0.4,  // Used in exponential, needs smaller effective LR
  homeBonus: 1,
  anchorBonus: 1
};

const getLR = (initialLR: number, gameCount: number, decay = 0.9995) => {
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
    
    // Scale learning rate by factor's typical magnitude
    const effectiveLR = adaptiveLR / factorScales[key]
    
    // Update with momentum and gradient clipping
    const momentum = 0.5
    const gradientClip = 0.3
    const clampedImprovement = Math.max(Math.min(improvement, gradientClip), -gradientClip)
    const update = effectiveLR * clampedImprovement + momentum * prevUpdate
    
    newFactors[key] = Math.max(0.0001, newFactors[key] + update) // Keep factors positive
    updates.set(key, update)
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
  let gamesSinceImprovement = 0;
  const validationInterval = 500;
  const escapeThreshold = 2000; // Try escaping after this many games without improvement
  
  for (let count = 0; count < numGames; count++) {
    const gameHistory: Position[] = []
    const currentEval = evaluate(currentFactors)
    const currentStrategy = useEval(currentEval);

    const opponents = [ 
      useEval(evaluate(f.balancedFactors)),
      useEval(evaluate(f.learned)),
      useEval(evaluate(f.prevLearned)),
      useEval(evaluate(f.prevPrevLearned)),
      useEval(evaluate(bestFactors)),
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
    
    currentFactors = updateFactors(
      currentFactors, 
      gameHistory, 
      outcome, 
      getLR(initialLearningRate, gamesSinceImprovement)
    );

    if (count % validationInterval === 0) {
      const validationGames = 80;
      let winsVsBalanced = 0;
      let winsVsPrevLearned = 0;
      const balanced = useEval(evaluate(f.balancedFactors));
      const prevLearned = useEval(evaluate(f.prevLearned));

      // Validate against both strategies
      for (let i = 0; i < validationGames; i++) {
        // Play against balanced strategy
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

        if (h.checkWinner(vGame) === c.WHITE) winsVsBalanced++;

        // Play against prevLearned strategy
        vGame = h.newGame();
        vGame.turn = c.WHITE as Player;

        while (!h.checkWinner(vGame)) {
          let roll = h.generateRoll();
          let result = strategy(vGame, roll);
          if (result) vGame = result[1];
          vGame.turn = (vGame.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;

          if (h.checkWinner(vGame)) break;

          roll = h.generateRoll();
          result = prevLearned(vGame, roll);
          if (result) vGame = result[1];
          vGame.turn = (vGame.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
        }

        if (h.checkWinner(vGame) === c.WHITE) winsVsPrevLearned++;
      }

      const validationWinRateBalanced = winsVsBalanced / validationGames;
      const validationWinRatePrevLearned = winsVsPrevLearned / validationGames;
      console.log(`Validation win rates - vs balanced: ${(validationWinRateBalanced * 100).toFixed(1)}%, vs PrevLearned: ${(validationWinRatePrevLearned * 100).toFixed(1)}%`);

      // Take the average of both win rates for determining improvement
      const combinedWinRate = (validationWinRateBalanced + validationWinRatePrevLearned) / 2;
      if (combinedWinRate > bestWinRate) {
        bestWinRate = combinedWinRate;
        bestFactors = {...currentFactors};
        gamesSinceImprovement = 0;
        console.log("New best factors: ", Object.fromEntries(
          Object.entries(currentFactors)
          .map(([k, v]) => [k, v.toFixed(3)])
        ));
      } else {
        gamesSinceImprovement += validationInterval; // increment by validation interval
      }
      
      // If we're stuck, try escaping the local optimum
      if (gamesSinceImprovement >= escapeThreshold) {
        console.log(`No improvement for ${gamesSinceImprovement} games. Attempting to escape local optimum...`);
        
        // Create a new point in factor space by:
        // 1. Taking best factors so far
        // 2. Randomly perturbing some factors significantly
        // 3. Keeping some factors from current position
        const escapedFactors = {...bestFactors};
        const numFactorsToPerturb = Math.floor(Object.keys(currentFactors).length * 0.7); // Perturb 70% of factors
        
        // Randomly select factors to perturb
        const factorKeys = Object.keys(currentFactors);
        const shuffled = factorKeys.sort(() => Math.random() - 0.5);
        const toPerturb = shuffled.slice(0, numFactorsToPerturb);
        
        for (const key of toPerturb) {
          // Random perturbation between 0.1x and 5x the current value
          const multiplier = 0.2 + 5 * Math.random();
          escapedFactors[key] = bestFactors[key] * multiplier + multiplier;
          
          // Sometimes (10% chance) try taking value from the initial factors
          if (Math.random() < 0.1) {
            escapedFactors[key] = initialFactors[key];
          }
          if (Math.random() < 0.02) {
            escapedFactors[key] = 1;
          }
        }
        
        currentFactors = escapedFactors;
        gamesSinceImprovement = 0;
        
        console.log("Escaped to new factors:", 
          Object.fromEntries(
            Object.entries(currentFactors)
            .map(([k, v]) => [k, v.toFixed(3)])
          )
        );
      }
    }
  }

  return bestFactors;
}

const initialFactors: Factors = f.balancedFactors;

// Train against opponents
const finalFactors = trainFactors(initialFactors, 8000, 0.008)
learnedFactors.push(finalFactors)
await Bun.write('src/learnedFactors.json', JSON.stringify(learnedFactors, null, 2)) 

console.log("Training complete. Best factors found:", finalFactors, "wrote to learnedFactors.json")
