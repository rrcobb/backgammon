import { containerHeader } from './_components';

interface GameResult {
  timestamp: number;
  winningStrategy: string;
  losingStrategy: string;
  numTurns: number;
}

const STORAGE_KEY = 'backgammon_games';
const K_FACTOR = 32;
const DEFAULT_ELO = 1500;

interface ELORating {
  rating: number;
  wins: number;
  losses: number;
}

type ELORatings = Record<string, ELORating>;

function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function updateELO(ratings: ELORatings, game: GameResult): ELORatings {
  const newRatings = {...ratings};

  if (!newRatings[game.winningStrategy]) {
    newRatings[game.winningStrategy] = { rating: DEFAULT_ELO, wins: 0, losses: 0 };
  }
  if (!newRatings[game.losingStrategy]) {
    newRatings[game.losingStrategy] = { rating: DEFAULT_ELO, wins: 0, losses: 0 };
  }

  const winner = newRatings[game.winningStrategy];
  const loser = newRatings[game.losingStrategy];

  const winnerExpected = calculateExpectedScore(winner.rating, loser.rating);
  const loserExpected = calculateExpectedScore(loser.rating, winner.rating);

  winner.rating += K_FACTOR * (1 - winnerExpected);
  loser.rating += K_FACTOR * (0 - loserExpected);
  
  winner.wins++;
  loser.losses++;

  return newRatings;
}

function calculateELOs(games: GameResult[]): ELORatings {
  let ratings: ELORatings = {};
  for (const game of games) {
    ratings = updateELO(ratings, game);
  }
  return ratings;
}

function loadGames(): GameResult[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse stored games:', e);
    return [];
  }
}

function saveGames(games: GameResult[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

export function recordGame(result: Omit<GameResult, 'timestamp'>): void {
  const games = loadGames();
  games.push({
    ...result,
    timestamp: Date.now()
  });
  saveGames(games);
}

function resetGames(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function renderScoreboard() {
  const scoreboard = document.getElementById("scoreboard");
  if (!scoreboard) return;
  
  scoreboard.innerHTML = "";
  scoreboard.appendChild(containerHeader("Scoreboard", scoreboard));

  const games = loadGames();
  
  if (games.length === 0) {
    renderEmptyState(scoreboard);
    return;
  }
  
  const ratings = calculateELOs(games);
  
  const table = document.createElement("table");
  table.classList.add("stats-table");
  
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Strategy", "ELO", "W-L", "Win %"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  const tbody = document.createElement("tbody");
  Object.entries(ratings)
    .sort(([,a], [,b]) => b.rating - a.rating)
    .forEach(([strategy, stats]) => {
      const row = document.createElement("tr");
      
      // Strategy name
      const nameCell = document.createElement("td");
      nameCell.textContent = strategy;
      
      // ELO
      const eloCell = document.createElement("td");
      eloCell.textContent = Math.round(stats.rating).toString();
      
      // W-L
      const recordCell = document.createElement("td");
      recordCell.textContent = `${stats.wins}-${stats.losses}`;
      
      // Win %
      const winRateCell = document.createElement("td");
      const winRate = (stats.wins / (stats.wins + stats.losses)) * 100;
      winRateCell.textContent = winRate.toFixed(1) + "%";
      
      row.appendChild(nameCell);
      row.appendChild(eloCell);
      row.appendChild(recordCell);
      row.appendChild(winRateCell);
      
      tbody.appendChild(row);
    });
  
  table.appendChild(tbody);
  
  const resetButton = document.createElement("button");
  resetButton.textContent = "Reset Records";
  resetButton.classList.add("reset-scores");
  resetButton.addEventListener("click", () => {
    resetGames();
    renderScoreboard();
  });

  const content = document.createElement('div');
  content.classList.add('section-content');
  content.classList.add('scores');

  // default closed
  content.classList.add('collapsed');
  scoreboard.classList.add('collapsed');

  content.appendChild(table);
  content.appendChild(resetButton);
  scoreboard.appendChild(content);
}

function renderEmptyState(scoreboard: HTMLElement) {
  const table = document.createElement("table");
  table.classList.add('section-content');
  table.classList.add("stats-table");
  
  // default closed
  table.classList.add('collapsed');
  scoreboard.classList.add('collapsed'); 

  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.textContent = "No games finished yet";
  cell.classList.add("empty-state");
  
  row.appendChild(cell);
  table.appendChild(row);
  scoreboard.appendChild(table);
}
