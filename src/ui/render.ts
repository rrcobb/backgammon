import type { Player, Game, Move, Roll, Die, Result, Movement } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import { AppliedStrategy } from "../strategy/strategies";
import { renderHistory, describeTurn } from "./history";
import { showArrow } from './arrows'
import { saveGameHistoryToUrl, restoreGameHistoryFromUrl } from './url';
import { renderScoreboard, recordGameResult } from './scores';
import { setStrategy, renderStrategyPickers } from './strategy';

export type State = {
  whiteStrategy: AppliedStrategy | null;
  blackStrategy: AppliedStrategy | null;
}

// global state
var game;
var turnNo;
var state: State = {
  whiteStrategy: null,
  blackStrategy: null,
}
var gameHistory;
var backCount;
var humanMoveCallback;
var selectedPiece;
var currentValidMoves: Result[] | null = null;
var selectedMoves: Movement[] = [];
var activeListeners: Array<[Element, string, EventListener]> = [];

// settings
var delay = 0.3; // seconds?

// for listeners we need to be able to clear later
function addListener(element: Element, event: string, handler: EventListener) {
  element.addEventListener(event, handler);
  activeListeners.push([element, event, handler]);
}


function renderInfo(turn, turnHistory) {
  let info = "";
  if (!turn) {
    info = "New game. Players roll to determine who goes first."
  } else {
    // viewing past turn / current turn
    const turnCount = turnHistory.length;
    const prev = turnHistory[turn.turnNo - 2];
    if (turnCount == turn.turnNo) {
      info += `Turn ${turn.turnNo}. `;
    } else {
      info += `(${turn.turnNo}/${turnCount}) `;
    }

    // last roll and move (turn description)
    info += describeTurn(turn, prev); 
    let winner = h.checkWinner(turn.game);
    if (winner) {
      info += (winner == c.WHITE ? " White" : " Black") + " wins!";
    } else {
      // note the inversion; turn.player is the previous turn
      info += (turn.player == 'w' ? ' Black' : ' White') + ' to play.';
      if (turn.game.wBar && turn.player == 'b') info += ` White has ${turn.game.wBar} on the bar.`;
      if (turn.game.bBar && turn.player == 'w') info += ` Black has ${turn.game.bBar} on the bar.`;
    }
  }
  const infoDiv = document.getElementById('turn-info');
  infoDiv.textContent = info;
}

function renderBoard(game: Game, move?: Move): void {
  let board = document.getElementById("board");
  board.innerHTML = "";

  let home = document.createElement("div");
  home?.classList.add("home");

  // show count for pieces in home
  let blackHome = document.createElement("div");
  blackHome.classList.add("home-count");
  blackHome.classList.add("black-home");
  blackHome.textContent = `Black ${game.bHome}`;

  let whiteHome = document.createElement("div");
  whiteHome.classList.add("home-count");
  whiteHome.classList.add("white-home");
  whiteHome.textContent = `White ${game.wHome}`;

  home.appendChild(blackHome);
  home.appendChild(whiteHome);

  let frame = document.createElement("div")
  frame.classList.add("frame")

  let top = document.createElement("div");
  top.classList.add("top");
  let bottom = document.createElement("div");
  bottom.classList.add("bottom");
  let right = document.createElement("div")
  right.classList.add("right")

  board?.appendChild(home);
  board?.appendChild(frame)
  board?.appendChild(top);
  board?.appendChild(bottom);
  board?.appendChild(right);

  game.positions.forEach((v: number, i: number) => {
    let triangle = document.createElement("div");
    triangle.classList.add("angle");
    triangle.classList.add(`position-${i}`);
    if (i % 2 == 0) {
      triangle.classList.add("red");
    } else {
      triangle.classList.add("gray");
    }
    if (i <= 11) {
      top.appendChild(triangle);
    } else {
      bottom.appendChild(triangle);
    }

    // The Bar
    if (i == 6 || i === 18) {
      let bar = document.createElement("div");
      bar.classList.add("bar");
      if (i === 6) {
        for (let i = 0; i < game.bBar; i++) {
          let piece = document.createElement("span");
          piece.classList.add("piece");
          piece.classList.add("b");
          bar.appendChild(piece);
        }
      } else {
        for (let i = 0; i < game.wBar; i++) {
          let piece = document.createElement("span");
          piece.classList.add("piece");
          piece.classList.add("w");
          bar.appendChild(piece);
        }
      }

      triangle.parentElement.insertBefore(bar, triangle);
    }
    let label = document.createElement("div");
    label.innerText += `${i + 1}`;
    label.classList.add("label");
    triangle.appendChild(label);

    let piecesContainer = document.createElement("div");
    piecesContainer.classList.add("pieces");
    triangle.appendChild(piecesContainer);

    const count = v & 0b00001111;
    const color = v & c.WHITE ? "w" : "b";
    const pieces = [];

    for (let i = 0; i < count; i++) {
      let piece = document.createElement("span");
      piece.classList.add("piece");
      piece.classList.add(color);
      pieces.push(piece)
    }

    for (let piece of pieces) {
      piecesContainer.appendChild(piece);
    }
  });

  if (move) {
    let arrows = move.map(_ => [])
    let moveCountByPosition = {}
    // note: we're showing the previous move, the turn has updated, so this is reversed
    const getBarElement = () => document.querySelector(game.turn == c.BLACK ? '.bottom .bar' : '.top .bar');
    const getHomeElement = () => document.querySelector(game.turn == c.BLACK ? '.white-home' : '.black-home');

    for (let n in move) { 
        let m = move[n]
        if (!m) continue;
        let [from, to] = m;
        moveCountByPosition[to] = (moveCountByPosition[to] || 0) + 1
        let ghost = document.createElement("span");
        ghost.classList.add("piece", "ghost");
        let fromPieces = document.querySelector(`.position-${from} .pieces`);
        if (from == c.BAR) {
          fromPieces = getBarElement()
        }
        fromPieces.appendChild(ghost)
        arrows[n].push(ghost) 
    }
    
    for (let n in move) { 
        let m = move[n]
        if (!m) continue;
        let [from, to] = m;
        
        if (to == c.HOME) {
            let dest = getHomeElement();
            dest.classList.add('just-moved');
            arrows[n].push(dest)
        } else {
            let toPieces = document.querySelectorAll(`.position-${to} .pieces .piece`);
            let moveCount = moveCountByPosition[to]
            
            // Get the appropriate piece from the back, counting backward from total pieces
            let destIndex = toPieces.length - moveCount
            let dest = toPieces[destIndex]
            moveCountByPosition[to]--
            
            if (dest) {
                dest.classList.add('just-moved');
                arrows[n].push(dest)
            }
        }
    }
    
    const arrowContainer = document.createElement('div');
    arrowContainer.classList.add('arrow-container');
    board.insertAdjacentElement("beforeend", arrowContainer);
    arrows.forEach(([start, dest]) => start && dest && showArrow(start, dest, arrowContainer))
}

  let frameBottom = document.createElement("div");
  frameBottom.classList.add("frame-bottom");
  board.insertAdjacentElement("beforeend", frameBottom);
}

function clearArrows() {
  const container = document.querySelector('.arrow-container');
  if (container) {
    container.innerHTML = '';
  }
  document.querySelectorAll('.ghost').forEach(ghost => ghost.remove());
}

function renderRoll(roll) {
  const rollDiv = document.createElement("div");
  rollDiv.classList.add("roll");

  roll.forEach((die) => {
    const img = document.createElement("img");
    const ordinal = ["one", "two", "three", "four", "five", "six"][die - 1];
    img.src = `src/ui/dice/${ordinal}.svg`;
    img.alt = ordinal;
    rollDiv.appendChild(img);
  });

  const board = document.getElementById("board");
  board.appendChild(rollDiv);
}

function highlightValidSources() {
  const sources = getNextValidSources();

  sources.forEach(pos => {
    if (pos === c.BAR) {
      const bar = document.querySelector(
        game.turn === c.WHITE ? '.bottom .bar' : '.top .bar'
      );
      bar.classList.add('valid-source');
      addListener(bar, 'click', () => handleSourceClick(pos));
    } else {
      const point = document.querySelector(`.position-${pos} .pieces`);
      if (point) {
        point.classList.add('valid-source');
        addListener(point, 'click', () => handleSourceClick(pos));
      }
    }
  });
}

function handleSourceClick(pos: number) {
  clearArrows();
  clearHighlights();
  selectedPiece = pos;
  highlightValidDestinations(pos);
}

/**
 * Checks if a sequence of moves is valid within a candidate sequence,
 * regardless of order
 */
function isCompatibleSequence(selected: Movement[], candidate: Movement[]): boolean {
  // Count moves in candidate sequence
  const candidateCounts = new Map<string, number>();
  candidate.filter(m => m !== null).forEach(m => {
    const key = JSON.stringify(m);
    candidateCounts.set(key, (candidateCounts.get(key) || 0) + 1);
  });
  
  // Try to match each selected move
  for (const move of selected) {
    const key = JSON.stringify(move);
    const count = candidateCounts.get(key);
    if (!count) return false;
    
    if (count === 1) {
      candidateCounts.delete(key);
    } else {
      candidateCounts.set(key, count - 1);
    }
  }
  
  return true;
}

/**
 * Returns whether two sequences contain exactly the same moves
 * (ignoring order and nulls)
 */
function areSequencesEqual(seq1: Movement[], seq2: Movement[]): boolean {
  const moves1 = seq1.filter(m => m !== null);
  const moves2 = seq2.filter(m => m !== null);
  
  // Must have same number of non-null moves
  if (moves1.length !== moves2.length) return false;
  
  return isCompatibleSequence(moves1, moves2) && isCompatibleSequence(moves2, moves1);
}

/**
 * Get remaining moves available in a candidate sequence after 
 * accounting for selected moves
 */
function getRemainingMoves(selected: Movement[], candidate: Movement[]): Movement[] {
  // Count moves in candidate
  const candidateCounts = new Map<string, number>();
  candidate.filter(m => m !== null).forEach(m => {
    const key = JSON.stringify(m);
    candidateCounts.set(key, (candidateCounts.get(key) || 0) + 1);
  });
  
  // Subtract selected moves
  selected.forEach(move => {
    const key = JSON.stringify(move);
    const count = candidateCounts.get(key);
    if (count === 1) {
      candidateCounts.delete(key);
    } else if (count) {
      candidateCounts.set(key, count - 1);
    }
  });
  
  // Convert remaining counts back to moves
  const remaining: Movement[] = [];
  candidateCounts.forEach((count, moveStr) => {
    const move = JSON.parse(moveStr) as Movement;
    for (let i = 0; i < count; i++) {
      remaining.push(move);
    }
  });
  
  return remaining;
}

/**
 * Moves a piece in the DOM and shows an arrow for the movement
 * Returns the moved piece and ghost elements for potential reversal
 */
function showMove(from: number, to: number): { piece: HTMLElement, ghost: HTMLElement } | null {
  // Get source element
  const fromPoint = from === c.BAR 
    ? document.querySelector(game.turn === c.WHITE ? '.bottom .bar' : '.top .bar')
    : document.querySelector(`.position-${from} .pieces`);
  
  const piece = fromPoint?.querySelector(`.piece.${game.turn === c.WHITE ? 'w' : 'b'}:last-child`);
  if (!piece || !(piece instanceof HTMLElement)) return null;

  // Create and position ghost for arrow
  const ghost = document.createElement('span');
  ghost.classList.add('piece', 'ghost');
  fromPoint?.appendChild(ghost);

  // Handle the destination
  if (to === c.HOME) {
    const home = document.querySelector(game.turn === c.WHITE ? '.white-home' : '.black-home');
    home?.appendChild(piece);
  } else {
    const destPoint = document.querySelector(`.position-${to} .pieces`);
    if (!destPoint) return null;

    // Handle hitting a blot
    const blot = destPoint.querySelector(`.piece.${game.turn === c.WHITE ? 'b' : 'w'}`);
    if (blot && destPoint.querySelectorAll(`.piece.${game.turn === c.WHITE ? 'b' : 'w'}`).length === 1) {
      blot.remove();
      const bar = document.querySelector(game.turn === c.WHITE ? '.top .bar' : '.bottom .bar');
      bar?.appendChild(blot);
    }
    
    destPoint.appendChild(piece);
  }

  // Draw the arrow
  const arrowContainer = document.querySelector('.arrow-container') || (() => {
    const container = document.createElement('div');
    container.classList.add('arrow-container');
    document.getElementById('board')?.appendChild(container);
    return container;
  })();
  
  showArrow(ghost, piece, arrowContainer);

  return { piece, ghost };
}

function handleMoveSelection(from: number, to: number) {
  // Record the move
  selectedMoves.push([from, to] as Movement);

  const matchingResult = currentValidMoves.find(([move]) => 
    areSequencesEqual(move, selectedMoves)
  );

  if (matchingResult) {
    // Complete move - let the game state update handle final rendering
    clearHighlights();
    selectedMoves = [];
    humanMoveCallback(matchingResult);
  } else {
    clearHighlights();
    showMove(from, to);
    highlightValidSources();
  }
}

/**
 * Undoes the last move in selectedMoves
 * Returns true if a move was undone, false if there was nothing to undo
 */
function undoLastMove(): boolean {
  const lastMove = selectedMoves.pop();
  if (!lastMove) return false;

  const [from, to] = lastMove;
  
  // Find the piece to move back
  const fromPoint = from === c.BAR 
    ? document.querySelector(game.turn === c.WHITE ? '.bottom .bar' : '.top .bar')
    : document.querySelector(`.position-${from} .pieces`);
    
  const targetElement = to === c.HOME
    ? document.querySelector(game.turn === c.WHITE ? '.white-home' : '.black-home')
    : document.querySelector(`.position-${to} .pieces`);

  const piece = targetElement?.querySelector(`.piece.${game.turn === c.WHITE ? 'w' : 'b'}:last-child`);
  if (!piece || !fromPoint) return false;

  // Move the piece back
  fromPoint.appendChild(piece);

  // Clear the arrows for this move
  clearArrows();
  if (selectedMoves.length > 0) {
    // Redraw arrows for remaining moves
    selectedMoves.forEach(([f, t]) => showMove(f, t));
  }

  // Update the UI state
  clearHighlights();
  highlightValidSources();

  return true;
}

function getNextValidSources(): Set<number> {
  const sources = new Set<number>();
  
  currentValidMoves.forEach(([sequence]) => {
    if (isCompatibleSequence(selectedMoves, sequence)) {
      // Add sources from remaining moves
      const remaining = getRemainingMoves(selectedMoves, sequence);
      remaining.forEach(move => {
        const [start] = move;
        // Special case for bar - check actual piece count
        if (start === c.BAR) {
          const barCount = game.turn === c.WHITE ? game.wBar : game.bBar;
          if (barCount > 0) {
            sources.add(start);
          }
        } else {
          // Regular point - check if we have pieces there
          sources.add(start);
        }
      });
    }
  });
  
  return sources;
}

function highlightValidDestinations(from: number): void {
  const dests = new Set<number>();
  
  currentValidMoves.forEach(([sequence]) => {
    if (isCompatibleSequence(selectedMoves, sequence)) {
      const remaining = getRemainingMoves(selectedMoves, sequence);
      remaining.forEach(move => {
        if (move && move[0] === from) {
          dests.add(move[1]);
        }
      });
    }
  });
  
  dests.forEach(pos => {
    if (pos === c.HOME) {
      const home = document.querySelector(game.turn === c.WHITE ? '.white-home' : '.black-home');
      if (home) {
        home.classList.add('valid-destination');
        addListener(home, 'click', () => handleMoveSelection(from, pos));
      }
    } else {
      const point = document.querySelector(`.angle.position-${pos}`);
      if (point) {
        point.classList.add('valid-destination');
        addListener(point, 'click', () => handleMoveSelection(from, pos));
      }
    }
  });
}

function clearHighlights() {
  selectedPiece = null;
  document.querySelectorAll('.valid-source, .valid-destination').forEach(el => {
    el.classList.remove('valid-source', 'valid-destination');
  });

  activeListeners.forEach(([element, event, handler]) => {
    element.removeEventListener(event, handler);
  });
  activeListeners = [];
}

function renderTurn(turn, turnHistory, backCount) {
  renderScoreboard();
  renderBoard(turn?.game || game, turn?.move);
  if (turn?.roll) { renderRoll(turn.roll); }
  renderHistory(turnHistory, backCount);
  renderInfo(turn, turnHistory);
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
  const finished = h.checkWinner(game);
  const current = backCount == 0;
  const start = backCount >= gameHistory.length - 1; 

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

function initGame() {
  turnNo = 0;
  gameHistory = [];
  game = h.newGame();
  backCount = 0;
}

function newGame() {
  window.location.hash = "";
  initGame()
  renderCurrentTurn()
  setButtons();
}

function back() {
  if (backCount < gameHistory.length - 1) {
    viewTurn(backCount+1);
  }
}

function forward() {
  viewTurn(backCount-1);
}

export function viewTurn(count) {
  backCount = count;
  let nextTurn = gameHistory[gameHistory.length - 1 - backCount];
  if (!nextTurn) throw new Error("no turn available");
  
  renderTurn(nextTurn, gameHistory, backCount);
  setButtons();
}

export function playFromHere() {
  // actually go back to the game shown
  gameHistory = gameHistory.slice(0, gameHistory.length - backCount);
  let target = gameHistory[gameHistory.length - 1];
  game = target.game
  turnNo = turnNo - backCount;
  backCount = 0;

  setButtons();
  renderCurrentTurn();
}

export function jumpToLatest() {
  backCount = 0;
  let currentTurn = gameHistory[gameHistory.length - 1];

  setButtons();
  renderCurrentTurn();
}

function renderCurrentTurn() {
  if (!gameHistory) {console.log('no history'); return; }
  const turn = gameHistory[gameHistory.length - 1 - backCount];
  renderTurn(turn, gameHistory, backCount);
}

async function getNextMove(game: Game, roll: Roll): Promise<Result> {
  const strat = game.turn == c.WHITE ? state.whiteStrategy : state.blackStrategy;
  
  if (strat.sname === 'human') {
    currentValidMoves = h.validMoves(game, roll);
    return new Promise(resolve => {
      renderRoll(roll);
      highlightValidSources();
      humanMoveCallback = (result: Result) => {
        const [move, next] = result;
        next.turn = (game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
        resolve([move, next]);
      };
    });
  }
  
  return h.takeTurn(game, roll, strat);
}

async function handleTurn(roll: Roll) {
  turnNo++;
  const player = game.turn == c.WHITE ? "w" : "b";

  const [move, next] = await getNextMove(game, roll);

  game = next;

  const turn = {turnNo, move, player, roll, game}
  gameHistory.push(turn) 
  saveGameHistoryToUrl(gameHistory);

  const finished = h.checkWinner(game);
  if (finished) {
    const result = {
      winningStrategy: finished === c.WHITE ? state.whiteStrategy.sname : state.blackStrategy.sname,
      losingStrategy: finished === c.WHITE ? state.blackStrategy.sname : state.whiteStrategy.sname
    };
    recordGameResult(result);
  }

  renderCurrentTurn();
  setButtons();
}

async function playTurn() {
  const finished = h.checkWinner(game);
  if (finished) { return; }

  if (!game.turn) {
    // Handle roll-off to start the game
    const [winner, roll] = h.rollOff();
    game.turn = winner;
    await handleTurn(roll);
  } else {
    await handleTurn(h.generateRoll());
  }
}

async function play() {
  if (backCount == 0) {
    await playTurn();
  } else {
    forward();
  }
}

async function sleep(s) {
  await new Promise(resolve => setTimeout(resolve, s))
}

document.addEventListener("DOMContentLoaded", async () => {
  renderStrategyPickers(state);
  setStrategy(c.WHITE, "learned", state);
  setStrategy(c.BLACK, "human", state);

  if (window.location.hash) {
    let urlHistory = await restoreGameHistoryFromUrl(window.location.hash);
    gameHistory = urlHistory;
    let last = gameHistory[gameHistory.length - 1];
    game = last.game;
    turnNo = last.turnNo;
    backCount = 0;
    console.log("game restored at turn", last.turnNo)
  } else {
    initGame();
  }

  renderCurrentTurn();
  setButtons();

  document.getElementById("fast")?.addEventListener("click", async () => {
    for (let i = 0; i < 10; i++) {
      playTurn();
      if (delay) {
        await sleep(delay)
      }
    }
  });
  document.getElementById('end')?.addEventListener('click', async () => {
    while (!h.checkWinner(game)) {
      playTurn();
      if (delay) {
        await sleep(delay / 5);
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
      if (backCount == 0) {
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
      if (selectedPiece !== null) {
        // Just clear the current selection
        clearHighlights();
        selectedPiece = null;
      } else if (selectedMoves.length > 0) {
        // Clear all moves made this turn
        clearHighlights();
        clearArrows();
        selectedMoves = [];
        highlightValidSources();
      }
    }

    if (e.key == 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undoLastMove();
    }
  })
});
