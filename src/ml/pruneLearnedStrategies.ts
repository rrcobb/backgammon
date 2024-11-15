import { useEval } from "../strategy/strategies";
import { evaluate } from "../strategy/evaluate";
import { roundRobinTournament } from "../evals/tournament";

const path = "src/ml/learnedFactors.json";
// Read and process factors
const learnedFactors = JSON.parse(await Bun.file(path).text());

// Create strategies from factors
const createStrategies = (factors) => {
  return Object.fromEntries(factors.map((f, i) => [`learned${i}`, useEval(evaluate(f))]));
};

// Calculate cosine similarity between two factor vectors
function cosineSimilarity(f1, f2) {
  const keys = Object.keys(f1);
  const v1 = keys.map((k) => f1[k]);
  const v2 = keys.map((k) => f2[k]);

  const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));

  const dot = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  return dot / (mag1 * mag2);
}

function findAllSimilarGroups(factors, similarityThreshold = 0.95) {
  const n = factors.length;
  const groups = [];
  const used = new Set();

  for (let i = 0; i < n; i++) {
    if (used.has(i)) continue;

    const group = [i];

    for (let j = i + 1; j < n; j++) {
      if (used.has(j)) continue;

      const similarity = cosineSimilarity(factors[i], factors[j]);
      if (similarity > similarityThreshold) {
        group.push(j);
      }
    }

    if (group.length > 1) {
      groups.push(group);
      // Mark all strategies in this group as used
      group.forEach((idx) => used.add(idx));
    }
  }

  // Sort groups by size (largest first)
  return groups.sort((a, b) => b.length - a.length);
}

const TARGET_SIZE = 15;
const GAME_COUNT = 200;

async function tournamentAndPrune(factors, targetSize = TARGET_SIZE, gamesPerMatchup = GAME_COUNT) {
  console.log(`Starting tournament with ${factors.length} strategies...`);

  // Run tournament
  const strategies = createStrategies(factors);
  const results = roundRobinTournament(strategies, gamesPerMatchup);

  // Get win rates and create initial ranking
  const strategyInfos = results.names.map((name, i) => ({
    name,
    index: parseInt(name.replace("learned", "")),
    winRate: 1 - results.averageLossRates[i],
    keep: true,
  }));

  // Sort by win rate for reference
  strategyInfos.sort((a, b) => a.winRate - b.winRate);

  // Find similar groups (now non-overlapping)
  const similarGroups = findAllSimilarGroups(factors);
  console.log("\nFound similar strategy groups:", similarGroups.map((group) => `[${group.map((i) => `learned${i}`).join(", ")}]`).join("\n"));

  // Process groups one at a time until we hit target size
  for (const group of similarGroups) {
    // Get current size BEFORE processing this group
    const currentSize = strategyInfos.filter((info) => info.keep).length;

    if (currentSize <= targetSize) {
      console.log(`\nReached target size ${currentSize} <= ${targetSize}, stopping similarity pruning.`);
      break;
    }

    // Get win rates for this group (only for strategies we're still keeping)
    const groupInfos = group
      .map((idx) => strategyInfos.find((info) => info.index === idx)!)
      .filter((info) => info.keep)
      .sort((a, b) => a.winRate - b.winRate);

    // If we have multiple strategies still in play from this group
    if (groupInfos.length > 1) {
      // Calculate how many we can safely remove while staying above target
      const maxToRemove = Math.min(
        groupInfos.length - 1, // Keep at least one
        currentSize - targetSize, // Don't go below target
      );

      // Remove up to maxToRemove worst performers
      for (let i = 1; i <= maxToRemove; i++) {
        const info = strategyInfos.find((s) => s.index === groupInfos[i].index)!;
        info.keep = false;
      }

      console.log(
        `Pruned similar group, kept learned${groupInfos[0].index}, removed:`,
        groupInfos
          .slice(1, maxToRemove + 1)
          .map((info) => `learned${info.index}`)
          .join(", "),
      );
    }
  }

  // Check if we need to remove more based on performance
  const remainingCount = strategyInfos.filter((info) => info.keep).length;
  if (remainingCount > targetSize) {
    console.log(`\nStill need to remove ${remainingCount - targetSize} strategies to reach target size...`);

    // Remove the worst performing strategies that weren't already marked for removal
    const sortedRemaining = strategyInfos.filter((info) => info.keep).sort((a, b) => a.winRate - b.winRate); // Sort ascending for worst first

    for (let i = 0; i < remainingCount - targetSize; i++) {
      const info = sortedRemaining[i];
      const originalInfo = strategyInfos.find((s) => s.index === info.index)!;
      originalInfo.keep = false;
    }

    console.log(
      "Removed worst performers:",
      sortedRemaining
        .slice(0, remainingCount - targetSize)
        .map((info) => `learned${info.index}`)
        .join(", "),
    );
  }

  // Create final sorted list of survivors
  const survivors = strategyInfos.filter((info) => info.keep).sort((a, b) => a.winRate - b.winRate);

  // Create final sorted factors array
  const sortedFactors = survivors.map(({ index }) => factors[index]);

  // Write results
  await Bun.write(path, JSON.stringify(sortedFactors, null, 2));

  console.log("\nPruning complete. Final factors sorted by performance and written to file.");
  console.log(`Reduced from ${factors.length} to ${sortedFactors.length} strategies.`);
  console.log("\nFinal rankings:");
  survivors.forEach(({ name, winRate }, i) => {
    console.log(`${i + 1}. ${name}: ${(winRate * 100).toFixed(1)}% win rate`);
  });
}

// Main execution
await tournamentAndPrune(learnedFactors);
