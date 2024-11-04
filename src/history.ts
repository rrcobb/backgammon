import type { Player, Game, Move } from "./backgammon";
import { constants as c, helpers as h } from "./backgammon";

function showDie(n: number): string {
  return ['⚀','⚁','⚂','⚃','⚄','⚅'][n-1];
}

function showRoll(roll: [number, number]): string {
  if (roll[0] === roll[1]) {
    // For doubles, show all four dice
    return new Array(4).fill(showDie(roll[0])).join('')
  }
  return showDie(roll[0]) + showDie(roll[1]);
}

function showPos(move, isHit) {
  const start = move[0] == c.BAR ? 'bar' : (1 + move[0]);
  const end = move[1] == c.HOME ? 'home' : (1 + move[1]);
  return start + "→" + end + (isHit ? '⊗' : '');
}

function showMoves(moves, turn, prev): string {
  let passes = 0
  let result = "";

  let hitLocs = [];
  if (checkHit(turn, prev)) {
    hitLocs = hitLocations(turn, prev);
  }

  for (let m in moves) {
    let move = moves[m];
    if (move) {
      const isHit = hitLocs.includes(move[1]);
      result += showPos(move, isHit);
    } else {
      passes +=1
      if (passes == moves.length) {
        return "no moves possible"
      }
      result += "pass";
    }
    if (+m < moves.length - 1) result += ",";
  }
  return result;
}

function identical(a, b) {
  return a[0] == b[0] && a[1] == b[1];
}

function chained(a, b) {
  return a[1] == b[0] || a[0] == b[1];
}

function groupMoves(_moves: Move[]): [Move[], number][] {
  const moves = _moves.filter(m => m !== null);
  if (moves.length === 0) return [];
  if (moves.length === 1) return [[moves, 1]];
  if (moves.length === 2) {
    let [a,b] = moves;
    if (identical(a, b)) return [[[a], 2]];
    if (chained(a,b)) return [[[a,b], 1]];
    return moves.map(m => [[m], 1])
  }

  // rolled doubles, have 3 or 4 moves
  let result: [Move[], number][] = [];
  let remaining = [...moves];
  
  while (remaining.length > 0) {
    const move = remaining[0];
    const chains = remaining.filter(m => chained(m, move));
    const count = remaining.filter(m => identical(m, move)).length;
    result.push([[move], count]);
    remaining = remaining.filter(m => !identical(m, move));
  }
  
  return result;
}

function describeLocation(point: number, player: string, to: boolean): string {
  if (point == c.BAR) return "the bar";
  if (point == c.HOME) return "home";
  return "" + (point + 1)
}

function describeRoll([d1, d2]: [number, number]): string {
  if (d1 === d2) {
    return `double ${d1}s`;
  }
  return `${d1}, ${d2}`;
}

function describeSequence(sequence, player) {
  if (sequence.length == 1) {
    let move = sequence[0];
    const fromDesc = describeLocation(move[0], player, false);
    const toDesc = describeLocation(move[1], player, true);
    return `from ${fromDesc} to ${toDesc}`;
  } else {
    let [first, ...rest] = sequence;
    const fromDesc = describeLocation(first[0], player, false);
    const toDesc = describeLocation(first[1], player, false);
    let description = `a piece from ${fromDesc} to ${toDesc}`
    for (let move of rest) {
      description += ` and then to ${describeLocation(move[1], player, false)}`
    }
    return description;
  }
}

function checkHit(turn, prev): boolean {
  if (!prev) return false;
  
  // Check if opponent's bar count increased
  let prevBarCount, newBarCount;
  if(turn.player === 'w') {
    prevBarCount = prev.game.bBar;
    newBarCount = turn.game.bBar;
  } else {
    prevBarCount = prev.game.wBar;
    newBarCount = turn.game.wBar;
  }
  
  return newBarCount > prevBarCount;
}

function hitLocations(turn, prev): number[] {
  const opponent = turn.player === 'w' ? c.BLACK : c.WHITE;
  const hits: number[] = [];
  
  // Check each position for disappeared opponent blots
  for (let pos = 0; pos < 24; pos++) {
    const prevBlot = (prev.game.positions[pos] ^ opponent) == 1;
    if (prevBlot) {
      const noOpponent = (turn.game.positions[pos] & opponent) != opponent;
      if (noOpponent) {
        hits.push(pos);
      }
    }
  }
  
  return hits;
}

function describeTurn(turn, prev): string {
  const player = turn.player === 'w' ? 'White' : 'Black';
  let description = `${player} rolled ${describeRoll(turn.roll)}. `;

  if (showMoves(turn.move, turn, prev) === "no moves possible") {
    return description + "No legal moves available.";
  }

  const groups = groupMoves(turn.move)
  let seenMulti = false;
  const sequenceDescriptions = groups.map((group, i) => {
    let [sequence, count] = group;
    if (count == 1) {
      if (seenMulti) {
        return `once piece ${describeSequence(sequence, turn.player)}`
      }
      return describeSequence(sequence, turn.player)
    } else {
      seenMulti = true;
      return `${count} pieces ${describeSequence(sequence, turn.player)}`
    }
  });

  if (sequenceDescriptions.length === 1) {
    description += "Moved " + sequenceDescriptions[0] + ".";
  } else if (sequenceDescriptions.length === 2) {
    description += "Moved " + sequenceDescriptions[0] + ' and ' + sequenceDescriptions[1] + ".";
  } else {
    const lastMove = sequenceDescriptions.pop();
    description += "Moved " + sequenceDescriptions.join(', ') + ', and ' + lastMove + ".";
  }

  if (checkHit(turn, prev)) {
    const hitLocs = hitLocations(turn, prev);
    let hitDesc = `Hit ${turn.player === 'w' ? 'Black' : 'White'}'s blot`
    hitDesc += hitLocs.map(pos => ` on ${pos + 1}`).join(' and');
    description += ` ${hitDesc}.`;
  }

  return description;
}

function expandTurn(turnDiv, turn, indicator, prev) {
  const isExpanded = turnDiv.classList.toggle('expanded');
  indicator.innerText = isExpanded ? '−' : '+';
      
  // Show/hide description
  const desc = turnDiv.querySelector('.turn-description');
  if (isExpanded) {
    if (!desc) {
      const descDiv = document.createElement('div');
      descDiv.classList.add('turn-description');
      descDiv.innerText = describeTurn(turn, prev);
      turnDiv.appendChild(descDiv);
    }
  } else if (desc) {
    desc.remove();
  }
}

function renderHistory(gameHistory) {
  const historyEl = document.getElementById("historyEl");
  historyEl.innerHTML = ""; // clear first
  const reverseChronology = gameHistory.slice().reverse();
  reverseChronology.forEach((turn, index) => {
    const prev = reverseChronology[index + 1] // index + 1 because we are reversed
    const hitOpponent = checkHit(turn, prev);
    const turnDiv = document.createElement('div');
    turnDiv.classList.add('history-turn');
    turnDiv.classList.add(turn.player === 'w' ? 'white-turn' : 'black-turn');

    if (index === 0) {
      if (h.checkWinner(turn.game)) {
        turnDiv.classList.add('winning-turn');
        const winnerBanner = document.createElement('div');
        winnerBanner.classList.add('winner-banner');
        winnerBanner.innerText = `${turn.player === 'w' ? 'White' : 'Black'} wins!`;
        historyEl.appendChild(winnerBanner);
      } else {
        // detailed description for this turn
        const descriptionDiv = document.createElement('div');
        const description = describeTurn(turn, prev);
        descriptionDiv.classList.add('turn-description');
        descriptionDiv.classList.add(turn.player === 'w' ? 'white-turn' : 'black-turn');
        descriptionDiv.innerText = description;
        historyEl.appendChild(descriptionDiv);
      }
    }

    if (turn.roll == null) {
      return
    }

    const num = document.createElement('span')
    num.innerText = turn.turnNo
    num.classList.add('turn-number')
    turnDiv.appendChild(num);

    const rollSpan = document.createElement('span');
    rollSpan.innerText = showRoll(turn.roll);
    rollSpan.classList.add('turn-roll')
    turnDiv.appendChild(rollSpan);

    const moves = document.createElement('span');
    const movesText = showMoves(turn.move, turn, prev);
    moves.innerText = movesText;
    moves.classList.add('turn-moves');
    if (movesText === "no moves possible") {
      moves.classList.add('no-moves');
    } else if (movesText.includes(' pass')) {
      moves.classList.add('has-passes');
    }
    turnDiv.appendChild(moves)

    if (index !== 0) { // skip for most recent turn
      const indicator = document.createElement('span');
      indicator.classList.add('expand-indicator');
      indicator.innerText = '+';
      turnDiv.appendChild(indicator);
      turnDiv.addEventListener('click', () => expandTurn(turnDiv, turn, indicator, prev));
    }

    historyEl.appendChild(turnDiv);
  });
  addHistoryControls(historyEl);
}

function addHistoryControls(historyEl) {
  const controls = document.createElement('div');
  controls.classList.add('history-controls');
  
  const expandAll = document.createElement('button');
  expandAll.innerText = 'Expand All';
  expandAll.classList.add('history-control');
  expandAll.addEventListener('click', () => {
    const turns = historyEl.querySelectorAll('.history-turn:not(.expanded)');
    turns.forEach(turn => turn.click());
  });
  
  const collapseAll = document.createElement('button');
  collapseAll.innerText = 'Collapse All';
  collapseAll.classList.add('history-control');
  collapseAll.addEventListener('click', () => {
    const turns = historyEl.querySelectorAll('.history-turn.expanded');
    turns.forEach(turn => turn.click());
  });
  
  controls.appendChild(expandAll);
  controls.appendChild(collapseAll);
  historyEl.appendChild(controls);
}

export { renderHistory }
