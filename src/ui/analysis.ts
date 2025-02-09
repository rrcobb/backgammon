import { containerHeader } from './_components';
import { constants as c, helpers as h } from '../backgammon';
import { getPipCounts, getBlots, analyzePrimes, getBoardStrength } from '../strategy/evaluate'

function renderStrategicInfo(game, turnhistory, bstrat, wstrat) {
  const container = document.getElementById('strategic-info');

  const header = container.querySelector('.section-header');
  if (!header) {
    container.appendChild(containerHeader('Position Analysis', container));
  }

  let infoBox = container.querySelector('.section-content');
  if(!infoBox) {
    infoBox = document.createElement('div');
    infoBox.classList.add('section-content');
    container.appendChild(infoBox)

    // default closed
    infoBox.classList.add('collapsed');
    container.classList.add('collapsed'); 
  }
  infoBox.innerHTML = '';

  const player = game?.turn == c.WHITE ? c.BLACK : c.WHITE; // look at previous turn
  let strat = player == c.WHITE ? bstrat : wstrat;
  let f = strat?.factors;
  if (!game) {
    game = h.newGame(); // before the game has really started
    strat = null;
    f = null;
  };
  const blots = getBlots(game, player)
  const info = {
    game,
    pips: getPipCounts(game, player),
    primes: analyzePrimes(game, player),
    blots,
    strength: f && getBoardStrength(game, player, blots, f),
  }

  infoBox.appendChild(stats(game));
  if (!f) return;
  infoBox.appendChild(factors(info, strat, f));
  const prev = turnhistory[game.turnNo - 1];
  const rankings = moveRankings(prev, strat);
  if (rankings) {
    infoBox.appendChild(rankings);
  }
}

function stats(game) {
  const div = document.createElement('div');
  div.classList.add('raw-stats');
  
  const table = document.createElement('table');
  table.classList.add('stats-table');
  
  const header = table.createTHead();
  const headerRow = header.insertRow();
  headerRow.insertCell();
  headerRow.insertCell().innerHTML = 'Black';
  headerRow.insertCell().innerHTML = 'White';
  
  const tbody = table.createTBody();
  
  // Pip counts
  const { white, black, diff, isRacing } = getPipCounts(game, game.turn);
  const pipRow = tbody.insertRow();
  pipRow.insertCell().innerHTML = 'Pips';
  pipRow.insertCell().innerHTML = black;
  pipRow.insertCell().innerHTML = white;
  
  // Home counts
  const homeRow = tbody.insertRow();
  homeRow.insertCell().innerHTML = 'Home';
  homeRow.insertCell().innerHTML = game.bHome;
  homeRow.insertCell().innerHTML = game.wHome;
  
  // Bar counts
  const barRow = tbody.insertRow();
  barRow.insertCell().innerHTML = 'Bar';
  barRow.insertCell().innerHTML = game.bBar;
  barRow.insertCell().innerHTML = game.wBar;
  
  // Primes
  const bPrimes = analyzePrimes(game, c.BLACK);
  const wPrimes = analyzePrimes(game, c.WHITE);
  const primesRow = tbody.insertRow();
  primesRow.insertCell().innerHTML = 'Primes';
  primesRow.insertCell().innerHTML = formatPrimeDisplay(bPrimes.primes);
  primesRow.insertCell().innerHTML = formatPrimeDisplay(wPrimes.primes);
  
  // Blots
  const bBlots = getBlots(game, c.BLACK);
  const wBlots = getBlots(game, c.WHITE);
  const blotsRow = tbody.insertRow();
  blotsRow.insertCell().innerHTML = 'Blots';
  blotsRow.insertCell().innerHTML = formatBlotsDisplay(bBlots.blots);
  blotsRow.insertCell().innerHTML = formatBlotsDisplay(wBlots.blots);
  
  div.appendChild(table);
  return div;
}

function formatPrimeDisplay(primes) {
  if (!primes.length) return 'none';
  return primes
    .map(prime => `<span class="prime-span">${prime.start + 1}→${prime.start + prime.length}</span>`)
    .join(', ');
}

function formatBlotsDisplay(blots) {
  const blotlist = Object.entries(blots)
  if (blotlist.length == 0) return 'none';
  return blotlist
    .map(([point, chance]) => `${(Number(point) + 1).toString().padStart(2)} (${(chance * 100).toFixed(1)}%)`)
    .join('\n');
}

function factors(info, player, f: Factors) {
  const div = document.createElement('div');
  div.classList.add('factor-analysis');

  const { blots, primes, strength, pips, game } = info;

  // see evaluate.ts
  // these are the rewards and penalties from there
  const rows = [
    ["Home Reward", (player === c.WHITE ? game.wHome : game.bHome) * f.homeReward],
    ["Opp Home Penalty", -(player === c.WHITE ? game.bHome : game.wHome) * f.homePenalty],
    ["Bar Penalty", -(player === c.WHITE ? game.wBar : game.bBar) * f.barPenalty],
    ["Opp Bar Reward", (player === c.WHITE ? game.bBar : game.wBar) * f.barReward],
    ["Blot Risk", -blots.totalPenalty * f.blotPenalty],
    ["Board Control", strength.fivePointControl],
    ["Home Bonus", strength.homeCount * f.homeBonus],
    ["Anchor Bonus", strength.anchorCount * f.anchorBonus],
    ["Primes", primes.count * f.primeReward],
    ["Pip Diff", pips.isRacing ? (pips.diff / 24) * f.racingPipReward : (pips.diff / 24) * f.contactPipReward]
  ]
  .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]))
  .map(([name, score]) => factor(name, score));
  rows.forEach(row => div.appendChild(row));
  return div;
}

const signed = (n, digits=0) => n > 0 ? `+${n.toFixed(digits)}` : n.toFixed(digits); // - is in the string already
const normCount = (score, max=20) => Math.min(5, Math.max(0, Math.ceil(Math.abs(score) * 5 / max)));
const dots = (score, max=20) => '●'.repeat(normCount(score))
function factor(name, score) {
  const div = document.createElement('div');
  div.innerText = `${name}\t ${dots(score)} ${signed(score, 2)}`
  return div 
}

function moveRankings(prevTurn, strat) {
  if (!prevTurn) return null;
  
  const div = document.createElement('div');
  div.classList.add('move-rankings');

  const moves = h.validMoves(prevTurn.game, prevTurn.roll);
  if (!moves?.length) return null;
  
  // Top 3 moves
  moves.slice(0, 3).forEach(([move, _]) => {
    const moveDiv = document.createElement('div');
    const moveText = move
      .filter(m => m !== null)
      .map(([from, to]) => `${from === c.BAR ? 'bar' : from + 1}→${to === c.HOME ? 'home' : to + 1}`)
      .join(', ');
    moveDiv.innerText = moveText;
    div.appendChild(moveDiv);
  });
  
  return div;
}

export { renderStrategicInfo }
