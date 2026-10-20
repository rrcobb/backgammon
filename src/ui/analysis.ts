import { byId, containerHeader } from './_components';
import { constants as c, helpers as h } from '../backgammon';
import type { Game, Move, Player } from '../backgammon';
import type { Factors } from '../strategy/factors';
import type { AppliedStrategy } from '../strategy/strategies';
import { evaluate, getPipCounts, getBlots, analyzePrimes, getBoardStrength } from '../strategy/evaluate'
import type { BlotAnalysis } from '../strategy/evaluate'
import type { Turn } from './render';

type PositionInfo = {
  game: Game;
  pips: ReturnType<typeof getPipCounts>;
  primes: ReturnType<typeof analyzePrimes>;
  blots: BlotAnalysis;
  strength: ReturnType<typeof getBoardStrength>;
};

// analysis of `turn`, the turn just played (or the start position before the first turn)
function renderStrategicInfo(turn: Turn | undefined, turnHistory: Turn[], wstrat: AppliedStrategy, bstrat: AppliedStrategy) {
  const container = byId('strategic-info');

  const header = container.querySelector('.section-header');
  if (!header) {
    container.appendChild(containerHeader('Position Analysis', container));
  }

  let infoBox = container.querySelector<HTMLElement>('.section-content');
  if(!infoBox) {
    infoBox = document.createElement('div');
    infoBox.classList.add('section-content');
    container.appendChild(infoBox)

    // default closed
    infoBox.classList.add('collapsed');
    container.classList.add('collapsed'); 
  }
  infoBox.innerHTML = '';

  if (!turn) {
    // before the game has really started
    infoBox.appendChild(stats(h.newGame()));
    return;
  }

  const game = turn.game;
  const player = turn.player === 'w' ? c.WHITE : c.BLACK; // who just moved
  const strat = player == c.WHITE ? wstrat : bstrat;
  infoBox.appendChild(stats(game));

  const f = strat.factors;
  if (!f) return; // the breakdown only applies to strategies built on the factor evaluation
  const blots = getBlots(game, player)
  const info: PositionInfo = {
    game,
    pips: getPipCounts(game, player),
    primes: analyzePrimes(game, player),
    blots,
    strength: getBoardStrength(game, player, blots, f),
  }
  infoBox.appendChild(factors(info, player, f));

  const before = turnHistory[turnHistory.indexOf(turn) - 1];
  if (before) infoBox.appendChild(moveRankings(before.game, turn, player, f));
}

function stats(game: Game) {
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
  const { white, black } = getPipCounts(game, c.WHITE);
  const pipRow = tbody.insertRow();
  pipRow.insertCell().innerHTML = 'Pips';
  pipRow.insertCell().innerHTML = String(black);
  pipRow.insertCell().innerHTML = String(white);
  
  // Home counts
  const homeRow = tbody.insertRow();
  homeRow.insertCell().innerHTML = 'Home';
  homeRow.insertCell().innerHTML = String(game.bHome);
  homeRow.insertCell().innerHTML = String(game.wHome);
  
  // Bar counts
  const barRow = tbody.insertRow();
  barRow.insertCell().innerHTML = 'Bar';
  barRow.insertCell().innerHTML = String(game.bBar);
  barRow.insertCell().innerHTML = String(game.wBar);
  
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

function formatPrimeDisplay(primes: { start: number; length: number }[]) {
  if (!primes.length) return 'none';
  return primes
    .map(prime => `<span class="prime-span">${prime.start + 1}→${prime.start + prime.length}</span>`)
    .join(', ');
}

function formatBlotsDisplay(blots: Record<number, number>) {
  const blotlist = Object.entries(blots)
  if (blotlist.length == 0) return 'none';
  return blotlist
    .map(([point, chance]) => `${(Number(point) + 1).toString().padStart(2)} (${(chance * 100).toFixed(1)}%)`)
    .join('\n');
}

function factors(info: PositionInfo, player: Player, f: Factors) {
  const div = document.createElement('div');
  div.classList.add('factor-analysis');

  const { blots, primes, strength, pips, game } = info;

  // see evaluate.ts
  // these are the rewards and penalties from there
  const scores: [string, number][] = [
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
  ];
  scores
    .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]))
    .forEach(([name, score]) => div.appendChild(factor(name, score)));
  return div;
}

const signed = (n: number, digits=0) => n > 0 ? `+${n.toFixed(digits)}` : n.toFixed(digits); // - is in the string already
const normCount = (score: number, max=20) => Math.min(5, Math.max(0, Math.ceil(Math.abs(score) * 5 / max)));
const dots = (score: number) => '●'.repeat(normCount(score))
function factor(name: string, score: number) {
  const div = document.createElement('div');
  div.innerText = `${name}\t ${dots(score)} ${signed(score, 2)}`
  return div 
}

const moveText = (move: Move) =>
  move
    .filter((m) => m !== null)
    .map(([from, to]) => `${from === c.BAR ? 'bar' : from + 1}→${to === c.HOME ? 'home' : to + 1}`)
    .join(', ') || 'no move';

// the moves available on `turn`, ranked by the mover's evaluation; marks the move played
function moveRankings(before: Game, turn: Turn, player: Player, f: Factors) {
  const div = document.createElement('div');
  div.classList.add('move-rankings');

  const start = h.cloneGame(before);
  start.turn = player;
  const evalFn = evaluate(f);
  const ranked = h
    .validMoves(start, turn.roll)
    .map(([move, next]) => ({ move, score: evalFn(next, player) }))
    .sort((a, b) => b.score - a.score);

  const played = moveText(turn.move);
  ranked.slice(0, 3).forEach(({ move, score }, i) => {
    const moveDiv = document.createElement('div');
    const text = moveText(move);
    moveDiv.innerText = `${i + 1}. ${text} (${signed(score, 2)})${text === played ? ' ← played' : ''}`;
    div.appendChild(moveDiv);
  });

  return div;
}

export { renderStrategicInfo }
