// This seems more or less broken
// we need to implement the evaluation function using the tensor math, or else we can't to the optimization correctly
import { torch } from 'js-pytorch';
import { constants as c, helpers as h } from "./backgammon";
import { factors, evaluate } from './evaluationFns';

class EvaluatorNetwork {
  constructor() {
    // Initialize parameters with your balanced factors as starting point
    this.params = torch.tensor(
      Object.values(factors.balancedFactors),
      { requires_grad: true });
    
    this.optimizer = new torch.optim.Adam(
      [this.params],
      // default params
      0.001, // lr
      0, // reg
      [0.9, 0.999], // betas
    );

    // Separate move history for each player
    this.resetMoveHistory();
  }

  serialize() {
    return {
      params: this.params.tolist(),
      timestamp: new Date().toISOString(),
    };
  }

  // Load parameters from JSON
  loadParams(serialized) {
    const newParams = torch.tensor(serialized.params, { requires_grad: true });
    this.params.data.copy_(newParams);
  }

  resetMoveHistory() {
    this.whiteMoveScores = [];
    this.blackMoveScores = [];
  }

  getFactors() {
    const p = this.params.tolist();
    return {
      barPenalty: p[0],
      barReward: p[1],
      homeReward: p[2],
      homePenalty: p[3],
      blotPenalty: p[4],
      primeReward: p[5],
      racingPipReward: p[6],
      contactPipReward: p[7],
      positionDecay: p[8],
      homeBonus: p[9],
      anchorBonus: p[10]
    };
  }

  recordMove(evalScore, player) {
    const scoreArray = player === c.WHITE ? 
      this.whiteMoveScores : 
      this.blackMoveScores;
    
    // retain score graph for policy gradient
    scoreArray.push(evalScore);
  }

  // Update parameters based on game outcome
  learn(gameWon) {
    // Convert move scores to tensors
    const whiteScores = torch.tensor(this.whiteMoveScores, { requires_grad: true });
    const blackScores = torch.tensor(this.blackMoveScores, { requires_grad: true });
    
    // Compute advantages (here just using game outcome)
    const whiteAdvantage = gameWon ? 1.0 : -1.0;
    const blackAdvantage = -whiteAdvantage; // Opposite for black
    
    // Policy gradient loss for both players
    const whiteAdvTensor = torch.tensor([-whiteAdvantage], {requires_grad: true}); // negative because we want to maximize score
    const blackAdvTensor = torch.tensor([-blackAdvantage], {requires_grad: true});

    const whiteMean = torch.mean(whiteScores);
    const blackMean = torch.mean(blackScores);

    const whiteLoss = whiteMean.mul(whiteAdvTensor);
    const blackLoss = blackMean.mul(blackAdvTensor);
    // Combined loss
    const loss = whiteLoss.add(blackLoss);

    // Backprop and update
    this.optimizer.zero_grad();
    loss.backward();
    console.log(this.params.grad)
    
    this.optimizer.step();

    // Clear move history
    this.resetMoveHistory();
    
    return {
      totalLoss: loss.data[0],
      whiteLoss: whiteLoss.data[0],
      blackLoss: blackLoss.data[0],
    };
  }
}

class Trainer {
  constructor(numEpisodes = 1000) {
    this.numEpisodes = numEpisodes;
    this.network = new EvaluatorNetwork();
    this.evaluator = evaluate(this.network.getFactors());
    this.explorationRate = 0.1; // For epsilon-greedy exploration
    this.explorationDecay = 0.998;
    this.minExplorationRate = 0.01;
  }

  // Add exploration noise to move selection
  selectMove(moves, evaluations) {
    if (Math.random() < this.explorationRate) {
      // Random move
      return Math.floor(Math.random() * moves.length);
    } else {
      // Best move
      return evaluations.indexOf(Math.max(...evaluations));
    }
  }

  async playSelfPlayGame() {
    let game = h.newGame();
    game.turn = c.WHITE;
    
    while (!h.checkWinner(game)) {
      const roll = h.generateRoll();
      const results = h.validMoves(game, roll);
      
      // Evaluate all possible moves
      const evaluations = results.map(([_move, nextState]) => {
        return this.evaluator(nextState, game.turn);
      });
      
      if (!evaluations.length) { 
        game.turn = game.turn === c.WHITE ? c.BLACK : c.WHITE;
        continue 
      }
      const chosenIdx = this.selectMove(results, evaluations);
      
      this.network.recordMove(evaluations[chosenIdx], game.turn);
      
      // Update the game
      game = results[chosenIdx][1];
      game.turn = game.turn === c.WHITE ? c.BLACK : c.WHITE;
    }
    
    return game;
  }

  // Enhanced training loop with checkpointing
  async train(checkpointFrequency = 100) {
    this.currentEpisode = this.currentEpisode || 0;
    const results = [];
    
    for (let episode = this.currentEpisode; episode < this.numEpisodes; episode++) {
      this.currentEpisode = episode;
      
      // Play a self-play game
      const game = await this.playSelfPlayGame();
      
      // Learn from the outcome
      const losses = this.network.learn(h.checkWinner(game) === c.WHITE);
      
      // Update exploration rate
      this.explorationRate = Math.max(
        this.minExplorationRate,
        this.explorationRate * this.explorationDecay
      );
      
      // Update evaluator
      this.evaluator = evaluate(this.network.getFactors());
      
      // Save checkpoint periodically
      if (episode % checkpointFrequency === 0) {
        await this.saveCheckpoint(`backgammon_checkpoint_${episode}.json`);
        await this.saveCheckpoint(`backgammon_checkpoint_latest.json`);
        
        // Log progress
        console.log(`Episode ${episode}`);
        console.log(`Losses - Total: ${losses.totalLoss.toFixed(4)}, ` +
                   `White: ${losses.whiteLoss.toFixed(4)}, ` +
                   `Black: ${losses.blackLoss.toFixed(4)}`);
        console.log(`Exploration rate: ${this.explorationRate.toFixed(3)}`);
        console.log('Current factors:', this.network.getFactors());
      }
      
      results.push({
        episode,
        ...losses,
        factors: this.network.getFactors(),
        explorationRate: this.explorationRate
      });
    }

    // Save final model
    await this.saveCheckpoint('backgammon_final.json');
    
    return results;
  }

  // Save the current state of training
  async saveCheckpoint(filename) {
    const checkpoint = {
      network: this.network.serialize(),
      episode: this.currentEpisode,
      explorationRate: this.explorationRate,
    };

    await Bun.write(filename, JSON.stringify(checkpoint));
  }

  // Load a saved checkpoint
  async loadCheckpoint(filename) {
    let checkpoint;
    
    const data = await Bun.file(filename).text();
    checkpoint = JSON.parse(data);

    if (checkpoint) {
      this.network.loadParams(checkpoint.network);
      this.currentEpisode = checkpoint.episode;
      this.explorationRate = checkpoint.explorationRate;
      this.evaluator = evaluate(this.network.getFactors());
    }
  }
}

// Helper to create evaluator function from network
function createEvaluator(network) {
  return (game, player) => {
    const factors = network.getFactors();
    return evaluate(factors)(game, player);
  };
}

async function trainAndSave() {
  const trainer = new Trainer(1000);
  
  try {
    // Load existing checkpoint if available
    await trainer.loadCheckpoint('backgammon_checkpoint_latest.json');
    console.log('Resumed from checkpoint');
  } catch (e) {
    console.log('Starting fresh training');
  }
  
  const results = await trainer.train();
  
  // Get the final trained evaluator
  const trainedFactors = trainer.network.getFactors();
  console.log('Final trained factors:', trainedFactors);
  
  return trainedFactors;
}

await trainAndSave();
