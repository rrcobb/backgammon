import { useEval } from './strategies';
import { evaluate } from './evaluationFns';
import { roundRobinTournament } from '../evals/tournament';
import type { Factors } from './evaluationFns';

// Configuration
const GENERATION_COUNT = 10;
const TARGET_POPULATION = 10;
const TOURNAMENT_SIZE = 4;
const MUTATION_RATE = 0.25;
const CROSSOVER_RATE = 0.9;
const MUTATION_RANGE = 0.3;

// Load initial population
const initialFactors: Factors[] = JSON.parse(
  await Bun.file('src/learnedFactors.json').text()
);

// Generate synthetic factors to reach target population size
function generateSynthetics(
  basePopulation: Factors[],
  targetSize: number
): Factors[] {
  const syntheticCount = targetSize - basePopulation.length;
  if (syntheticCount <= 0) return basePopulation;
  
  console.log(`Generating ${syntheticCount} synthetic factors...`);
  const synthetics: Factors[] = [];
  
  while (synthetics.length < syntheticCount) {
    // Select random parents from base population
    const parent1 = basePopulation[Math.floor(Math.random() * basePopulation.length)];
    const parent2 = basePopulation[Math.floor(Math.random() * basePopulation.length)];
    
    // Create children with higher mutation rate for diversity
    const [child1, child2] = crossover(parent1, parent2);
    const mutatedChild1 = mutate(child1, MUTATION_RATE * 2);
    const mutatedChild2 = mutate(child2, MUTATION_RATE * 2);
    
    synthetics.push(mutatedChild1);
    if (synthetics.length < syntheticCount) {
      synthetics.push(mutatedChild2);
    }
  }
  
  return [...basePopulation, ...synthetics];
}

function mutate(factors: Factors, mutationRate = MUTATION_RATE): Factors {
  const result = {...factors};
  
  for (const [key, value] of Object.entries(factors)) {
    if (Math.random() < mutationRate) {
      const multiplier = 1 + MUTATION_RANGE * (2 * Math.random() - 1);
      result[key] = Math.max(0.0001, value * multiplier);
      
      if (Math.random() < 0.05) {
        result[key] = 1.0;
      }
    }
  }
  
  return result;
}

function crossover(parent1: Factors, parent2: Factors): [Factors, Factors] {
  if (Math.random() >= CROSSOVER_RATE) {
    return [{ ...parent1 }, { ...parent2 }];
  }
  
  const strategy = Math.random();
  
  if (strategy < 0.4) {
    // Weighted average crossover
    const weight = Math.random();
    const child1: Factors = {};
    const child2: Factors = {};
    
    for (const key in parent1) {
      child1[key] = weight * parent1[key] + (1 - weight) * parent2[key];
      child2[key] = (1 - weight) * parent1[key] + weight * parent2[key];
    }
    
    return [child1, child2];
  } else if (strategy < 0.8) {
    // Single point crossover
    const keys = Object.keys(parent1);
    const crossPoint = Math.floor(Math.random() * keys.length);
    const child1: Factors = {};
    const child2: Factors = {};
    
    keys.forEach((key, i) => {
      if (i < crossPoint) {
        child1[key] = parent1[key];
        child2[key] = parent2[key];
      } else {
        child1[key] = parent2[key];
        child2[key] = parent1[key];
      }
    });
    
    return [child1, child2];
  } else {
    // Per-factor random choice
    const child1: Factors = {};
    const child2: Factors = {};
    
    for (const key in parent1) {
      if (Math.random() < 0.5) {
        child1[key] = parent1[key];
        child2[key] = parent2[key];
      } else {
        child1[key] = parent2[key];
        child2[key] = parent1[key];
      }
    }
    
    return [child1, child2];
  }
}

function tournamentSelect(
  population: Factors[],
  fitnesses: number[],
  tournamentSize: number
): Factors {
  const indices = Array.from({length: population.length}, (_, i) => i);
  const shuffled = indices.sort(() => Math.random() - 0.5);
  const candidates = shuffled
    .slice(0, tournamentSize)
    .map(i => ({ index: i, fitness: fitnesses[i] }));
  
  const winner = candidates.reduce((best, current) => 
    current.fitness > best.fitness ? current : best
  );
  
  return population[winner.index];
}

function evaluatePopulation(population: Factors[]): number[] {
  const strategies = Object.fromEntries(
    population.map((f, i) => [`gen${i}`, useEval(evaluate(f))])
  );
  
  const results = roundRobinTournament(strategies, 50);
  return results.averageLossRates.map(rate => 1 - rate);
}

async function evolvePopulation() {
  // If needed, generate synthetic factors to reach target population
  let population = initialFactors;
  if (population.length < TARGET_POPULATION) {
    population = generateSynthetics(population, TARGET_POPULATION);
  }
  
  console.log(`Starting evolution with population size ${population.length}`);
  let bestOverallFitness = -Infinity;
  let bestOverallFactors: Factors | null = null;
  
  for (let gen = 0; gen < GENERATION_COUNT; gen++) {
    console.log(`\nGeneration ${gen + 1}/${GENERATION_COUNT}`);
    
    // Evaluate current population
    const fitnesses = evaluatePopulation(population);
    
    // Track best overall
    const bestIndex = fitnesses.indexOf(Math.max(...fitnesses));
    const bestFitness = fitnesses[bestIndex];
    
    if (bestFitness > bestOverallFitness) {
      bestOverallFitness = bestFitness;
      bestOverallFactors = {...population[bestIndex]};
      console.log(`New best fitness: ${bestFitness.toFixed(3)}`);
    } else {
      console.log(`Generation best: ${bestFitness.toFixed(3)} (overall best: ${bestOverallFitness.toFixed(3)})`);
    }
    
    // Create next generation
    const nextGen: Factors[] = [];
    
    // Elitism: Keep all-time best
    if (bestOverallFactors) {
      nextGen.push({...bestOverallFactors});
    }
    
    // Generate rest of population
    while (nextGen.length < population.length) {
      const parent1 = tournamentSelect(population, fitnesses, TOURNAMENT_SIZE);
      const parent2 = tournamentSelect(population, fitnesses, TOURNAMENT_SIZE);
      
      let [child1, child2] = crossover(parent1, parent2);
      child1 = mutate(child1);
      child2 = mutate(child2);
      
      nextGen.push(child1);
      if (nextGen.length < population.length) {
        nextGen.push(child2);
      }
    }
    
    population = nextGen;
  }
  
  // Final evaluation to sort population
  const finalFitnesses = evaluatePopulation(population);
  
  // Sort population by fitness
  const finalOrder = population.map((f, i) => ({ 
    factors: f, 
    fitness: finalFitnesses[i] 
  }))
  .sort((a, b) => b.fitness - a.fitness);
  
  population = finalOrder.map(({factors}) => factors);
  
  // Save evolved population
  await Bun.write(
    'src/learnedFactors.json',
    JSON.stringify(population, null, 2)
  );
  
  console.log('\nEvolution complete. Population sorted and saved to file.');
  console.log(`Final population size: ${population.length}`);
  console.log(`Best overall fitness achieved: ${bestOverallFitness.toFixed(3)}`);
}

// Run evolution
await evolvePopulation();
