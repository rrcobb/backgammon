import { constants as c, helpers as h } from "../backgammon";
import { showArrow, clearArrows } from './arrows'
import { state, play, playTurn, jumpToLatest, back, newGame, Settings, isHuman } from './render'
import { playerUI, highlightValidSources, clearHighlights, undoCurrentMoves } from './player'

export async function sleep(s) {
  await new Promise(resolve => setTimeout(resolve, s))
}

function enable(elid) {
  (document.getElementById(elid) as HTMLButtonElement).disabled = false;
}

function disable (elid) {
  (document.getElementById(elid) as HTMLButtonElement).disabled = true;
}

// buttons are:
// - current
// - back
// - play
// - fast
// - end
function setButtons() {
  const finished = h.checkWinner(state.game);
  const current = state.backCount == 0;
  const start = state.backCount >= state.gameHistory.length - 1; 
  const hasHumanPlayer = isHuman(state.whiteStrategy) || isHuman(state.blackStrategy);
  const isHumanTurn = current && isHuman(state.game.turn === c.WHITE ? state.whiteStrategy : state.blackStrategy);

  if (hasHumanPlayer) {
    disable("end");
    const fastButton = document.getElementById("fast");
    fastButton.textContent = "↺";
    if (!isHumanTurn || !playerUI.selectedMoves?.length) {
      disable("fast");
    } else {
      enable("fast");
    }
  } else {
    document.getElementById("fast").textContent = "▶▶";
    if (current && !finished) {
      enable("fast"); 
      enable("end");
    } else {
      disable("fast"); 
      disable("end");
    }
  }

  // play button is active unless we are at the end of the game
  if (finished && current) { 
    disable("play"); 
  } else { 
    enable("play"); 
  }

  // can step backwards unless we are at the start
  if (start) { 
    disable("back"); 
  } else { 
    enable("back"); 
  }
  
  // can go to current if we are not current
  if (current) { 
    disable("current"); 
  } else { 
    enable("current"); 
  }
}

function setupControls() {
  document.getElementById("fast")?.addEventListener("click", async () => {
    for (let i = 0; i < 10; i++) {
      playTurn();
      if (Settings.delay) {
        await sleep(Settings.delay)
      }
    }
  });

  document.getElementById('end')?.addEventListener('click', async () => {
    while (!h.checkWinner(state.game)) {
      playTurn();
      if (Settings.delay) {
        await sleep(Settings.delay / 5);
      } 
    }
  })

  document.getElementById("play")?.addEventListener("click", play);
  document.getElementById("back")?.addEventListener('click', back);
  document.getElementById("newgame")?.addEventListener("click", newGame);
  document.getElementById("current")?.addEventListener("click", jumpToLatest);

  // register keys for navigation
  document.body.addEventListener('keydown', (e) => {
    if (e.key == 'k' || e.key == 'ArrowUp' || e.key == 'ArrowRight') {
      play();
    }

    if (e.key == ' ' || e.key == 'Enter') {
      if (state.backCount == 0) {
        playTurn();
      }
    }

    if (e.key == 'j' || e.key == 'ArrowDown' || e.key == 'ArrowLeft') {
      back();
    }

    if (e.key == 'n') {
      newGame();
    }

    if (e.key === 'Escape' || e.key == 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undoCurrentMoves();
    }
  })
}

export { setButtons, setupControls, disable }
