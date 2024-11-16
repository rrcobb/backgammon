import { containerHeader } from './_components';
import { constants as c } from '../backgammon';
import { getPipCounts, getBlots, analyzePrimes, getBoardStrength } from '../strategy/evaluate'

function renderStrategicInfo(game, turnhistory, bstrat, wstrat) {
  const container = document.getElementById('strategic-info');
  const player = game.turn == c.WHITE ? c.BLACK : c.WHITE; // look at previous turn
  const strat = player == c.WHITE ? bstrat : wstrat;

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

  infoBox.appendChild(stats(game));
  infoBox.appendChild(factors(game, strat));
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

function pips(game) {
  const { white, black, diff, isRacing } = getPipCounts(game, game.turn);  
  const player = game.turn == c.WHITE ? "White" : "Black";
  const sign = diff > 0 ? "+" : ""; // - is in the string already
  const div = document.createElement('div');
  div.innerText = `Pips: ${player} ${sign}${diff} (${stage(isRacing)})`
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

function factors() {
  const div = document.createElement('div');
  div.classList.add('factor-analysis');
  div.innerHTML = `
    <div>Primes      ●●●●●  +4.2</div>
    <div>Bar Safety  ●●●    +2.1</div>
    <div>Blot Risk   ○○○    -1.4</div>
    <div>Home Board  ●      +0.8</div>
  `;
  return div;
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
