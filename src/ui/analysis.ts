import { containerHeader } from './_components';


function renderStrategicInfo(game, turnhistory, bstrat, wstrat) {
  const container = document.getElementById('strategic-info');

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

  infoBox.appendChild(stats());
  infoBox.appendChild(factors());
  infoBox.appendChild(moveRankings());
}

function stats() {
  const div = document.createElement('div');
  div.classList.add('raw-stats');
  div.innerHTML = `
    <div>Pip Count: +24 (Racing)</div>
    <div>Primes: 2 (points 4-6, 8-10)</div>
    <div>Blots: 2 (45%, 32% hit chance)</div>
    <div>Bar/Home: 0/4 vs 1/3</div>
  `;
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
