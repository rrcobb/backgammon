import { constants as c, helpers as h } from "../backgammon";
import { showArrow, clearArrows } from './arrows'
import { state, play, playTurn, jumpToLatest, back, newGame, Settings } from './render'
import { playerUI, highlightValidSources, clearHighlights, undoLastMove } from './player'

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

  // play button is active unless we are at the end of the game
  if (finished && current) { disable("play") }
  else { enable("play") }

  // can walk backwards unless we are at the start
  if (start) { disable("back") }
  else { enable("back") }
  
  // can jump if we are current and not finished
  if (current && !finished) {
    enable("fast"); enable("end");
  } else {
    disable("fast"); disable("end");
  }

  // can go to current if we are not current
  if (current) { disable("current") } 
  else { enable("current") } 
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

    if (e.key === 'Escape') {
      if (playerUI.selectedPiece !== null) {
        // Just clear the current selection
        clearHighlights();
        playerUI.selectedPiece = null;
      } else if (playerUI.selectedMoves.length > 0) {
        // Clear all moves made this turn
        clearHighlights();
        clearArrows();
        playerUI.selectedMoves = [];
        highlightValidSources();
      }
    }

    if (e.key == 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undoLastMove();
    }
  })
}

export { setButtons, setupControls }
