import { constants as c, helpers as h } from "../backgammon";
import { Strategies as S, AppliedStrategy } from "../strategy/strategies";
import { UIState, renderCurrentTurn, state, playTurn } from './render'
import { setButtons } from './controls'
import { playerUI, highlightValidSources, clearHighlights } from './player'
import { saveStrategyToUrl } from './url'

const human: AppliedStrategy = {
  sname: 'human',
  description: `Human player. 

When it's your turn:
1. Click a valid piece to select it
2. Click a destination to move`
} as AppliedStrategy; // we special-case this type... a lot

const Strategies = { human, ...S }

function strategyPicker(player: "white" | "black") {
  const div = document.createElement("div");
  div.classList.add('picker')
  div.classList.add(`${player}-picker`)

  const select = document.createElement("select");
  select.id = `${player}-strategy`;

  Object.keys(Strategies).forEach((strategy) => {
    const option = document.createElement("option");
    option.value = strategy;
    option.textContent = strategy;
    select.appendChild(option);
  });

  let label = document.createElement('label')
  label.innerText = player

  let descriptionBox = document.createElement('div');
  descriptionBox.classList.add('strategy-description'); 

  div.appendChild(label);
  div.appendChild(select);
  div.appendChild(descriptionBox);

  return div;
}

export function setStrategy(player, stratName, s: UIState) {
  if (player == c.WHITE) {
    s.whiteStrategy = Strategies[stratName];
    s.whiteStrategy.sname = stratName;
    const select = (document.getElementById("white-strategy") as HTMLSelectElement)
    select.value = stratName;
    showStrategyInfo(stratName, select.parentElement);
  } else {
    s.blackStrategy = Strategies[stratName];
    s.blackStrategy.sname = stratName;
    const select = (document.getElementById("black-strategy") as HTMLSelectElement)
    select.value = stratName;
    showStrategyInfo(stratName, select.parentElement);
  }

  if (s.whiteStrategy && s.blackStrategy) {
    clearHighlights();
    playerUI.selectedMoves = [];
    renderCurrentTurn();
    // If switching to human and it's their turn, show valid moves
    if (stratName === 'human' && state.game.turn === player) {
      playTurn();
    }
  
    setButtons();
    saveStrategyToUrl(state);
  }
}

export function renderStrategyConfig(state: UIState) {
  let strategySection = document.getElementById("strategy-selectors");
  let whitePicker = strategyPicker("white");
  whitePicker.addEventListener("change", (e) => setStrategy(c.WHITE, (e.target as HTMLSelectElement).value, state));
  let blackPicker = strategyPicker("black");
  blackPicker.addEventListener("change", (e) => setStrategy(c.BLACK, (e.target as HTMLSelectElement).value, state));

  strategySection.insertAdjacentElement("afterbegin", whitePicker);
  strategySection.insertAdjacentElement("afterbegin", blackPicker);
}

function showStrategyInfo(stratName, parent) {
  const description = Strategies[stratName].description || `The ${stratName} strategy. [TODO: add description]`;
  const descriptionBox = parent.querySelector('.strategy-description');
  descriptionBox.innerText = description;
}
