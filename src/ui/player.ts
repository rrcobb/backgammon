import { constants as c, helpers as h } from "../backgammon";
import type { Player, Game, Move, Roll, Die, Result, Movement } from "../backgammon";
import { state } from './render'
import { showArrow, clearArrows } from './arrows'

type Listener = [element: Element, event: string, fn: EventListener]
type PlayerUI = {
  humanMoveCallback: Function | null,
  currentValidMoves: Result[] | null;
  selectedMoves: Movement[] | null; 
  activeListeners: Listener[];
  selectedPiece: number | null;
}

export const playerUI: PlayerUI = {
  humanMoveCallback: null,
  selectedPiece: null,
  selectedMoves: null,
  currentValidMoves: null,
  activeListeners: []
}

// for listeners we need to be able to clear later
function addListener(element: Element, event: string, handler: EventListener) {
  element.addEventListener(event, handler);
  playerUI.activeListeners.push([element, event, handler]);
}

function handleSourceClick(pos: number) {
  clearArrows();
  clearHighlights();
  playerUI.selectedPiece = pos;
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
    ? document.querySelector(state.game.turn === c.WHITE ? '.bottom .bar' : '.top .bar')
    : document.querySelector(`.position-${from} .pieces`);
  
  const piece = fromPoint?.querySelector(`.piece.${state.game.turn === c.WHITE ? 'w' : 'b'}:last-child`);
  if (!piece || !(piece instanceof HTMLElement)) return null;

  // Create and position ghost for arrow
  const ghost = document.createElement('span');
  ghost.classList.add('piece', 'ghost');
  fromPoint?.appendChild(ghost);

  // Handle the destination
  if (to === c.HOME) {
    const home = document.querySelector(state.game.turn === c.WHITE ? '.white-home' : '.black-home');
    home?.appendChild(piece);
  } else {
    const destPoint = document.querySelector(`.position-${to} .pieces`);
    if (!destPoint) return null;

    // Handle hitting a blot
    const blot = destPoint.querySelector(`.piece.${state.game.turn === c.WHITE ? 'b' : 'w'}`);
    if (blot && destPoint.querySelectorAll(`.piece.${state.game.turn === c.WHITE ? 'b' : 'w'}`).length === 1) {
      blot.remove();
      const bar = document.querySelector(state.game.turn === c.WHITE ? '.top .bar' : '.bottom .bar');
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
  playerUI.selectedMoves.push([from, to] as Movement);

  const matchingResult = playerUI.currentValidMoves.find(([move]) => 
    areSequencesEqual(move, playerUI.selectedMoves)
  );

  if (matchingResult) {
    // Complete move - let the game state update handle final rendering
    clearHighlights();
    playerUI.selectedMoves = [];
    playerUI.humanMoveCallback(matchingResult);
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
export function undoLastMove(): boolean {
  const lastMove = playerUI.selectedMoves.pop();
  if (!lastMove) return false;

  const [from, to] = lastMove;
  
  // Find the piece to move back
  const fromPoint = from === c.BAR 
    ? document.querySelector(state.game.turn === c.WHITE ? '.bottom .bar' : '.top .bar')
    : document.querySelector(`.position-${from} .pieces`);
    
  const targetElement = to === c.HOME
    ? document.querySelector(state.game.turn === c.WHITE ? '.white-home' : '.black-home')
    : document.querySelector(`.position-${to} .pieces`);

  const piece = targetElement?.querySelector(`.piece.${state.game.turn === c.WHITE ? 'w' : 'b'}:last-child`);
  if (!piece || !fromPoint) return false;

  // Move the piece back
  fromPoint.appendChild(piece);

  // Clear the arrows for this move
  clearArrows();
  if (playerUI.selectedMoves.length > 0) {
    // Redraw arrows for remaining moves
    playerUI.selectedMoves.forEach(([f, t]) => showMove(f, t));
  }

  // Update the UI state
  clearHighlights();
  highlightValidSources();

  return true;
}

function getNextValidSources(): Set<number> {
  const sources = new Set<number>();
  
  playerUI.currentValidMoves.forEach(([sequence]) => {
    if (isCompatibleSequence(playerUI.selectedMoves, sequence)) {
      // Add sources from remaining moves
      const remaining = getRemainingMoves(playerUI.selectedMoves, sequence);
      remaining.forEach(move => {
        const [start] = move;
        // Special case for bar - check actual piece count
        if (start === c.BAR) {
          const barCount = state.game.turn === c.WHITE ? state.game.wBar : state.game.bBar;
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
  
  playerUI.currentValidMoves.forEach(([sequence]) => {
    if (isCompatibleSequence(playerUI.selectedMoves, sequence)) {
      const remaining = getRemainingMoves(playerUI.selectedMoves, sequence);
      remaining.forEach(move => {
        if (move && move[0] === from) {
          dests.add(move[1]);
        }
      });
    }
  });
  
  dests.forEach(pos => {
    if (pos === c.HOME) {
      const home = document.querySelector(state.game.turn === c.WHITE ? '.white-home' : '.black-home');
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

export function clearHighlights() {
  playerUI.selectedPiece = null;
  document.querySelectorAll('.valid-source, .valid-destination').forEach(el => {
    el.classList.remove('valid-source', 'valid-destination');
  });

  playerUI.activeListeners.forEach(([element, event, handler]) => {
    element.removeEventListener(event, handler);
  });
  playerUI.activeListeners = [];
}

export function highlightValidSources() {
  const sources = getNextValidSources();

  sources.forEach(pos => {
    if (pos === c.BAR) {
      const bar = document.querySelector(
        state.game.turn === c.WHITE ? '.bottom .bar' : '.top .bar'
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
