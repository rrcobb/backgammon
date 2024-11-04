import { Player } from "./backgammon";
import { constants as c } from "./backgammon";

interface StrategyScore {
  wins: number;
  losses: number;
}

export interface GameResult {
  winner: Player;
  winningStrategy: string;
  losingStrategy: string;
}

const STORAGE_KEY = 'backgammon_scores';

function initStrategyScore(): StrategyScore {
  return {
    wins: 0,
    losses: 0
  };
}

function loadScores(): Record<string, StrategyScore> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {};
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse stored scores:', e);
    return {};
  }
}

function saveScores(scores: Record<string, StrategyScore>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
}

function getAllStrategyStats(): Array<{strategy: string, stats: StrategyScore, winRate: number}> {
  const scores = loadScores();
  return Object.entries(scores)
    .map(([strategy, stats]) => ({
      strategy,
      stats,
      winRate: 100 * stats.wins / (stats.wins + stats.losses)
    }))
    .sort((a, b) => b.winRate - a.winRate);
}

export function recordGameResult(result: GameResult): void {
  const scores = loadScores();

  if (!scores[result.winningStrategy]) {
    scores[result.winningStrategy] = initStrategyScore();
  }
  if (!scores[result.losingStrategy]) {
    scores[result.losingStrategy] = initStrategyScore();
  }

  scores[result.winningStrategy].wins++;
  scores[result.losingStrategy].losses++;

  saveScores(scores);
}

export function resetScores(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function renderScoreboard() {
  let scoreboard = document.getElementById("scoreboard");
  if (!scoreboard) { return; }
  
  scoreboard.innerHTML = "";
  
  
  // Create table
  let table = document.createElement("table");
  table.classList.add("stats-table");
  
  // Add headers
  let thead = document.createElement("thead");
  let headerRow = document.createElement("tr");
  ["Strategy", "Wins", "Losses", "Win Rate"].forEach(text => {
    let th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Add data rows
  let tbody = document.createElement("tbody");
  const stats = getAllStrategyStats();
  
  if (stats.length === 0) {
    let emptyRow = document.createElement("tr");
    let td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No games finished yet";
    td.classList.add("empty-state");
    emptyRow.appendChild(td);
    tbody.appendChild(emptyRow);
  } else {
    stats.forEach(({ strategy, stats, winRate }) => {
      let row = document.createElement("tr");
      
      let strategyCell = document.createElement("td");
      strategyCell.textContent = strategy;
      
      let winsCell = document.createElement("td");
      winsCell.textContent = stats.wins.toString();
      winsCell.classList.add("wins");
      
      let lossesCell = document.createElement("td");
      lossesCell.textContent = stats.losses.toString();
      lossesCell.classList.add("losses");
      
      let winRateCell = document.createElement("td");
      winRateCell.textContent = winRate.toFixed(1) + "%";
      
      row.appendChild(strategyCell);
      row.appendChild(winsCell);
      row.appendChild(lossesCell);
      row.appendChild(winRateCell);
      
      tbody.appendChild(row);
    });
  }
  
  table.appendChild(tbody);

  let resetButton = document.createElement("button");
  resetButton.textContent = "Reset Scores";
  resetButton.classList.add("reset-scores");
  resetButton.addEventListener("click", () => {
    resetScores();
    renderScoreboard();
  });
  scoreboard.appendChild(table);
  scoreboard.appendChild(resetButton);
}

