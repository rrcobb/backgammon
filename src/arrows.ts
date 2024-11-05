import { getArrow } from "perfect-arrows"

function perfectArrow(b1, b2, container) {
  const cr = container.getBoundingClientRect();
  // adjustments to stick the arrows on the outsides of the circles:
  // - adjust the frame of reference to the container by subtracting off cr.x and cr.y
  // - shift by +10 x and -10 y to account for the element size; this was found by testing
  const r1 = { x: b1.x - cr.x + 10, y: b1.y - cr.y - 6 };
  const r2 = { x: b2.x - cr.x + 10, y: b2.y - cr.y - 6 };
  const dx = r2.x - r1.x;
  const dy = r2.y - r1.y;
  const startBottomHalf = r1.y > 200;
  const startLeftHalf = r1.x < 335;
  const isMovingRight = r2.x > r1.x;
  const isMovingDown = r2.y > r1.y;
  const isMovingUp = r1.y > r2.y;
  const isHorizontalMove = Math.abs(dx) > Math.abs(dy);
  const isFromBar = r1.x > 335 && r1.x < 340;

  const isToHome = r2.x < 32;

  if (isToHome) {
    r2.x += 10;
    r2.y += 10;
  }

  const flip = isHorizontalMove ? 
    // For primarily horizontal moves:
    (startBottomHalf ? 
      (isMovingRight && isMovingUp) || (!isMovingRight && !isMovingDown && !isFromBar) : 
      (isMovingRight && !isMovingUp) || (isMovingDown && !isFromBar)
    ):
    // For primarily vertical moves:
    (startLeftHalf ? 
     (isMovingDown && !isMovingRight) || (!isMovingDown && isMovingRight || !startBottomHalf) : 
     (!isMovingDown && !isMovingRight) || (isMovingDown && !isMovingRight));

  // handy for debugging arrow curve issues...
  // console.log({flip, isHorizontalMove, startLeftHalf, isMovingRight, isMovingDown, isFromBar, isMovingUp, startBottomHalf })

  let bow = 0.3; 
  if (Math.abs(dy) > Math.abs(dx)) {
    bow = 0.1;
  }

  const arrow = getArrow( 
    r1.x, r1.y,
    r2.x, r2.y,
    {
      bow,
      stretch: 0.4,
      stretchMin: 15,
      stretchMax: 400,
      padStart: 10,
      padEnd: 20,
      flip,
      straights: false,
    }
  );

  const [sx, sy, cx, cy, ex, ey, ae, as, ec] = arrow
  const endAngleAsDegrees = ae * (180 / Math.PI)

  return (`<svg
          viewBox="0 0 ${cr.width} ${cr.height}"
          style="width: 100%; height: 100%"
          stroke="#000"
          fill="#000"
          strokeWidth="1.5"
          >
          <!-- path outline -->
          <path d="M${sx},${sy} Q${cx},${cy} ${ex},${ey}" 
                fill="none" 
                stroke="rgba(250,250,250,0.4)" 
                stroke-width="2" />
          <!-- dashed path -->
          <path d="M${sx},${sy} Q${cx},${cy} ${ex},${ey}" 
                fill="none" 
                stroke-dasharray="5,5,5"/>
          <!-- arrow head -->
          <polygon
            points="0,-4 8,0, 0,4"
            transform="translate(${ex},${ey}) rotate(${endAngleAsDegrees})"
          />
          </svg>`)
}

function showArrow(fromPiece, toPiece, container) {
  let from = fromPiece.getBoundingClientRect();
  let to = toPiece.getBoundingClientRect();
  let arrow = perfectArrow(from, to, container)
  container.innerHTML += arrow;
}

export { showArrow }
