import { evaluate } from './evaluationFns';
import { useEval } from './strategies';
import { roundRobinTournament } from '../evals/tournament';

// Read and process factors
const learnedFactors = JSON.parse(await Bun.file('src/learnedFactors.json').text());

// Create strategies from factors
const createStrategies = (factors) => {
  return Object.fromEntries(
    factors.map((f, i) => [`learned${i}`, useEval(evaluate(f))])
  );
};

// Calculate cosine similarity between two factor vectors
function cosineSimilarity(f1, f2) {
  const keys = Object.keys(f1);
  // Convert to arrays maintaining same order
  const v1 = keys.map(k => f1[k]);
  const v2 = keys.map(k => f2[k]);
  
  // Normalize vectors
  const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
  
  const dot = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  return dot / (mag1 * mag2);
}

// Find groups of similar strategies
function findSimilarGroups(factors, similarityThreshold = 0.95) {
  const n = factors.length;
  const groups = [];
  const used = new Set();

  for (let i = 0; i < n; i++) {
    if (used.has(i)) continue;
    
    const group = [i];
    used.add(i);
    
    for (let j = i + 1; j < n; j++) {
      if (used.has(j)) continue;
      
      const similarity = cosineSimilarity(factors[i], factors[j]);
      if (similarity > similarityThreshold) {
        group.push(j);
        used.add(j);
      }
    }
    
    if (group.length > 1) {  // Only add groups with similar elements
      groups.push(group);
    }
  }
  
  return groups;
}

// Run tournament and prune strategies
async function tournamentAndPrune(
  factors,
  targetSize = 20,
  gamesPerMatchup = 20
) {
  console.log(`Starting tournament with ${factors.length} strategies...`);
  
  // Run tournament
  const strategies = createStrategies(factors);
  const results = roundRobinTournament(strategies, gamesPerMatchup);
  
  // Calculate average win rates for each strategy
  const winRates = results.names.map((name, i) => ({
    name,
    index: parseInt(name.replace('learned', '')),
    winRate: 1 - results.averageLossRates[i]
  }));
  
  // Sort by win rate
  winRates.sort((a, b) => b.winRate - a.winRate);
  
  // Find similar groups
  const similarGroups = findSimilarGroups(factors);
  console.log('\nFound similar strategy groups:', 
    similarGroups.map(group => 
      `[${group.map(i => `learned${i}`).join(', ')}]`
    ).join('\n')
  );
  
  // For each group of similar strategies, keep only the best performer
  const toRemove = new Set();
  for (const group of similarGroups) {
    // Sort group by win rate
    const groupWinRates = group.map(idx => ({
      idx,
      winRate: winRates.find(w => w.index === idx)!.winRate
    }));
    groupWinRates.sort((a, b) => b.winRate - a.winRate);
    
    // Remove all but the best performer
    for (let i = 1; i < groupWinRates.length; i++) {
      toRemove.add(groupWinRates[i].idx);
    }
  }
  
  console.log('\nRemoving similar strategies:', 
    Array.from(toRemove).map(i => `learned${i}`).join(', ')
  );
  
  // Create pruned list
  const prunedFactors = factors.filter((_, i) => !toRemove.has(i));
  
  // If still above target size, remove worst performers
  if (prunedFactors.length > targetSize) {
    const keepTopN = winRates
      .filter(w => !toRemove.has(w.index))
      .slice(0, targetSize)
      .map(w => w.index);
    
    console.log('\nFurther pruning to reach target size...');
    console.log('Keeping top performers:', keepTopN.map(i => `learned${i}`).join(', '));
    
    return factors.filter((_, i) => keepTopN.includes(i));
  }
  
  return prunedFactors;
}

// Main execution
const prunedFactors = await tournamentAndPrune(learnedFactors);

// Sort final factors by their tournament performance
const finalTournament = roundRobinTournament(
  createStrategies(prunedFactors),
  200  // More games for final ranking
);

// Get final ordering
const finalOrder = finalTournament.names
  .map((name, i) => ({
    name,
    index: parseInt(name.replace('learned', '')),
    winRate: 1 - finalTournament.averageLossRates[i]
  }))
  .sort((a, b) => b.winRate - a.winRate);

// Reorder factors
const sortedFactors = finalOrder.map(({index}) => prunedFactors[index]);

// Write results
await Bun.write(
  'src/learnedFactors.json',
  JSON.stringify(sortedFactors, null, 2)
);

console.log('\nPruning complete. Final factors sorted by performance and written to file.');
console.log(`Reduced from ${learnedFactors.length} to ${sortedFactors.length} strategies.`);
