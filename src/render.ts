import { Game, newGame, takeTurn } from './game';

function render(game: Game): void {
  let board = document.getElementById("board");
  if (!board) { throw new Error("board element not found") }
  board.innerHTML = "";
  let home = document.createElement("div");
  home?.classList.add("home");
  let top = document.createElement("div");
  top.classList.add("top");
  let bottom = document.createElement("div");
  bottom.classList.add("bottom");
  board?.appendChild(home);
  board?.appendChild(top);
  board?.appendChild(bottom);

  // show current player
  // show home piece count
  // for more than 5 pieces, show a number instead of all the pieces
  // show current pip count for each player
  // show the roll

  game.positions.forEach((v: string[], i: number) => {
    let triangle = document.createElement("div");
    triangle.classList.add("angle");
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
      i == 6 && game.bar.forEach((p: string) => {
        let piece = document.createElement("span");
        piece.classList.add("piece");
        piece.classList.add(p);
        bar.appendChild(piece);
      });

      triangle.parentElement.insertBefore(bar, triangle);
    }

    triangle.innerText += `${i + 1}`;

    v.forEach((p: string) => {
      let piece = document.createElement("span");
      piece.classList.add("piece");
      piece.classList.add(p);
      triangle.appendChild(piece);
    });
  });
}

const transcript: HTMLTextAreaElement = document.getElementById("transcript") as HTMLTextAreaElement;
export function log(msg: string) {
  transcript.value = msg + transcript?.value;
}

document.addEventListener('DOMContentLoaded', () => {
  let game = newGame();
  render(game);

  document.getElementById("play")?.addEventListener("click", () => {
    takeTurn(game);

    // TODO: remove assertion
    // validate that all the pieces in a position are the same player
    game.positions.forEach(p => {
      console.assert(
        p.length == 0 || p.every(v => v == p[0]),
        { msg: "constraint violated: two pieces of different colors", game }
      )
    })
    render(game);
  });

  document.getElementById("ten")?.addEventListener("click", () => {
    for (let i = 0; i < 10; i++) { takeTurn(game); }
    render(game);
  });

  document.getElementById("new")?.addEventListener("click", () => {
    game = newGame();
    render(game);
  });
})
