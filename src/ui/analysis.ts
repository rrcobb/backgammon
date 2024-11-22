import { containerHeader } from './_components';
import { constants as c } from '../backgammon';
import { getPipCounts, getBlots, analyzePrimes, getBoardStrength } from '../strategy/evaluate'

function renderStrategicInfo(game, turnhistory, bstrat, wstrat) {
  const container = document.getElementById('strategic-info');
  const player = game.turn == c.WHITE ? c.BLACK : c.WHITE; // look at previous turn
  const strat = player == c.WHITE ? bstrat : wstrat;
  const f = strat.factors;

  const header = container.querySelector('.section-header');
  if (!header) {
    container.appendChild(containerHeader('Analysis', container));
  }

  let infoBox = container.querySelector('.section-content');
  if(!infoBox) {
    infoBox = document.createElement('div');
    infoBox.classList.add('section-content');
    container.appendChild(infoBox)
  }
  infoBox.innerHTML = '';

  const blots = getBlots(game, player)
  const info = {
    game,
    pips: getPipCounts(game, player),
    primes: analyzePrimes(game, player),
    blots,
    strength: getBoardStrength(game, player, blots, f),
  }

  infoBox.appendChild(stats(game));
  infoBox.appendChild(factors(info, strat, f));
  const prev = turnhistory[turnhistory.length -1];
  infoBox.appendChild(moveRankings(prev, strat));
}

function stats(game) {
  const div = document.createElement('div');
  div.classList.add('raw-stats');

  div.appendChild(pips(game))
  div.appendChild(home(game))
  div.appendChild(bar(game))
  div.appendChild(primes(game))
  div.appendChild(blots(game))

  return div;
}

const signed = (n, digits=0) => n > 0 ? `+${n.toFixed(digits)}` : n.toFixed(digits); // - is in the string already
function pips(game) {
  const { white, black, diff, isRacing } = getPipCounts(game, game.turn);  
  const player = game.turn == c.WHITE ? "White" : "Black";
  const sign = diff > 0 ? "+" : ""; // - is in the string already
  const div = document.createElement('div');
  div.innerText = `Pips: ${player} ${signed(diff)} (${stage(isRacing)})`
  return div
}

function stage(isRacing) {
  return isRacing ? "Racing" : "Contact";
}

const formatPrimes = (primes, reverse=false) => primes.map(({start, length}) => {
  if (reverse) {
    return `${start + length}..${start + 1}`
  } else {
    return `${start + 1}..${start + length}`
  }
}).join(', ');

function primes(game) {
  const bPrimes = analyzePrimes(game, c.BLACK);
  const wPrimes = analyzePrimes(game, c.WHITE);
  const div = document.createElement('div');
  const b = document.createElement('div');
  const w = document.createElement('div');

  b.innerText = `Black (${bPrimes.primes.length}): [${formatPrimes(bPrimes.primes, true)}]`;
  w.innerText = `White (${wPrimes.primes.length}): [${formatPrimes(wPrimes.primes)}]`;
  
  div.appendChild(b)
  div.appendChild(w)
  return div;
}

const formatBlot = (i, blots) => `${Number(i) + 1}: ${(blots[i]*100).toFixed(2)}%`
function blots(game) {
  const bBlots = getBlots(game, c.BLACK);
  const wBlots = getBlots(game, c.WHITE);

  const div = document.createElement('div');
  const b = document.createElement('div');
  const w = document.createElement('div');

  b.innerText = `${Object.keys(bBlots.blots).map((i) => formatBlot(i, bBlots.blots)).join(', ')}`
  w.innerText = `${Object.keys(wBlots.blots).map((i) => formatBlot(i, wBlots.blots)).join(', ')}`

  div.appendChild(b)
  div.appendChild(w)
  return div;
}

function bar(game) {
  const div = document.createElement('div');
  const b = document.createElement('div');
  const w = document.createElement('div');

  b.innerText = `Black: ${game.bBar}`;
  w.innerText = `White: ${game.wBar}`;

  div.appendChild(b)
  div.appendChild(w)
  return div;
}

function home(game) {
  const div = document.createElement('div');
  const b = document.createElement('div');
  const w = document.createElement('div');

  b.innerText = `Black: ${game.bHome}`;
  w.innerText = `White: ${game.wHome}`;

  div.appendChild(b)
  div.appendChild(w)
  return div;
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

const normCount = (score, max=20) => Math.min(5, Math.max(0, Math.ceil(Math.abs(score) * 5 / max)));
const dots = (score, max=20) => '●'.repeat(normCount(score))
function factor(name, score) {
  const div = document.createElement('div');
  div.innerText = `${name}\t ${dots(score)} ${signed(score, 2)}`
  return div 
}

function moveRankings() {
  const div = document.createElement('div');
  div.classList.add('move-rankings');
  div.innerHTML = `
    <div>23→20, 20→18   +4.2  100%</div>
    <div>23→20, 20→17   +3.9   93%</div>
    <div>23→19, 19→17   +3.1   74%</div>
  `;
  return div;
}


export { renderStrategicInfo }
