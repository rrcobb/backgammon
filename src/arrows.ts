import { getBoxToBoxArrow } from "perfect-arrows"

function perfectArrow(b1, b2, container) {
  const cr = container.getBoundingClientRect();
  const r1 = { x: b1.x - cr.x, y: b1.y - cr.y - 20 , width: b1.width, height: b1.height };
  const r2 = { x: b2.x - cr.x, y: b2.y - cr.y - 20, width: b2.width, height: b2.height };

  const dx = r2.x - r1.x;
  const dy = r2.y - r1.y;
  const startBottomHalf = r1.y > 200;
  const startLeftHalf = r1.x < 300;
  const isMovingRight = r2.x > r1.x;
  const isMovingDown = r2.y > r1.y;
  const isMovingUp = r1.y > r2.y;
  const isHorizontalMove = Math.abs(dx) > Math.abs(dy);
  const isFromBar = r1.x == 328; // sensitive!

  const flip = isHorizontalMove ? 
    // For primarily horizontal moves:
    (startBottomHalf ? 
      (isMovingRight && isMovingUp) || (!isMovingRight && !isMovingDown) : 
      (isMovingRight && !isMovingUp) || (isMovingDown && !isFromBar)
    ):
    // For primarily vertical moves:
    (startLeftHalf ? (!isMovingRight && isMovingDown) : (!isMovingDown && !isMovingRight) || (isMovingDown && !isMovingRight));

  let bow = 0.3; 
  if (Math.abs(dy) > Math.abs(dx)) {
    bow = 0.1;
  }

  const arrow = getBoxToBoxArrow( 
    r1.x, r1.y, r1.width, r1.height, 
    r2.x, r2.y, r2.width, r2.height,
    {
      bow,
      stretch: 0.5,      
      stretchMin: 15,
      stretchMax: 400,
      padStart: 0,
      padEnd: 10,
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
          <path d="M${sx},${sy} Q${cx},${cy} ${ex},${ey}" fill="none" stroke-dasharray="5,5,5"/>
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
