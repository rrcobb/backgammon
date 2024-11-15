import { containerHeader } from './_components';


function renderStrategicInfo(game, turnhistory, bstrat, wstrat) {
  const container = document.getElementById('strategic-info');

  const header = container.querySelector('.section-header');
  if (!header) {
    container.appendChild(containerHeader('Analysis', container));
  }

  const infoBox = document.createElement('div');
  infoBox.classList.add('section-content');
  container.appendChild(infoBox);
}

export { renderStrategicInfo }
