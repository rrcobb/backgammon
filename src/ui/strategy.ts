import { constants as c } from "../backgammon";
import type { Player } from "../backgammon";
import { Strategies as S } from "../strategy/strategies";
import type { AppliedStrategy } from "../strategy/strategies";
import { renderCurrentTurn, state, playTurn } from './render'
import type { UIState } from './render'
import { setButtons } from './controls'
import { playerUI, clearHighlights } from './player'
import { saveStrategyToUrl } from './url'
import { byId, find, containerHeader } from './_components'

// the UI waits for clicks on a human's turn instead of calling a strategy (see isHuman)
const human: AppliedStrategy = Object.assign(
  () => {
    throw new Error("the human player's moves come from the board, not a strategy");
  },
  {
    sname: 'human',
    description: `Human player. 

When it's your turn:
1. Click a valid piece to select it
2. Click a destination to move`,
  },
);

const Strategies = { human, ...S }
type UIStrategyName = keyof typeof Strategies;
const isUIStrategyName = (name: string): name is UIStrategyName => name in Strategies;

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

export function setStrategy(player: Player, stratName: string, s: UIState) {
  if (!isUIStrategyName(stratName)) {
    console.warn(`unknown strategy ${stratName}; keeping the current one`);
    return;
  }
  if (player == c.WHITE) {
    s.whiteStrategy = Strategies[stratName];
    s.whiteStrategy.sname = stratName;
    const select = byId<HTMLSelectElement>("white-strategy");
    select.value = stratName;
    showStrategyInfo(stratName, select.parentElement!);
  } else {
    s.blackStrategy = Strategies[stratName];
    s.blackStrategy.sname = stratName;
    const select = byId<HTMLSelectElement>("black-strategy");
    select.value = stratName;
    showStrategyInfo(stratName, select.parentElement!);
  }

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

export function renderStrategyConfig(state: UIState) {
  let container = byId("strategy");

  let strategySection = document.createElement('div');
  strategySection.id = "strategy-selectors";
  strategySection.classList.add('section-content');

  let whitePicker = strategyPicker("white");
  whitePicker.addEventListener("change", (e) => setStrategy(c.WHITE, (e.target as HTMLSelectElement).value, state));
  let blackPicker = strategyPicker("black");
  blackPicker.addEventListener("change", (e) => setStrategy(c.BLACK, (e.target as HTMLSelectElement).value, state));

  strategySection.appendChild(blackPicker);
  strategySection.appendChild(whitePicker);

  // default closed
  strategySection.classList.add('collapsed');
  container.classList.add('collapsed'); 

  container.appendChild(containerHeader("Select Strategy", container));
  container.appendChild(strategySection);
}

function showStrategyInfo(stratName: UIStrategyName, parent: HTMLElement) {
  const description = Strategies[stratName].description || `The ${stratName} strategy. [TODO: add description]`;
  find('.strategy-description', parent).innerText = description;
}
