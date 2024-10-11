var Canvas = require("term-canvas");

process.on("SIGWINCH", function () {
  size = process.stdout.getWindowSize();
  canvas.width = size[0];
  canvas.height = size[1];
});

process.on("SIGINT", function () {
  ctx.reset();
  process.nextTick(function () {
    process.exit();
  });
});

const background = "white";
const pointOne = "blue";
const pointTwo = "red";

function drawBoard(canvas) {
  const ctx = canvas.getContext("2d");
  const width = 40;
  const height = 11;

  // Set background
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const borderW = 2;
  const borderH = 1;

  // Draw points
  const pointWidth = 3;
  const pointHeight = 4;

  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.strokeStyle = i % 2 == 0 ? pointOne : pointTwo;
    if (i < 12) {
      // 0 to 11
      ctx.moveTo(borderW + i * pointWidth, height);
      ctx.lineTo(borderW + i * pointWidth, height);
      ctx.lineTo(borderW + i * pointWidth, height - pointHeight);
    } else {
      ctx.moveTo(borderW + (i - 12) * pointWidth, borderH);
      ctx.lineTo(borderW + (i - 12) * pointWidth, borderH + pointHeight);
      ctx.lineTo(borderW + (i - 12) * pointWidth, borderH);
    }
    ctx.stroke();
  }

  // Draw middle bar
  // ctx.fillStyle = 'blue';
  // ctx.fillRect(width / 2 - 5, 10, 10, height - 20);
}

var size = process.stdout.getWindowSize();
var canvas = new Canvas(size[0], size[1]),
  ctx = canvas.getContext("2d");
// Call the render function
ctx.clear();
console.log("\n");
drawBoard(canvas);
console.log("\n");
console.log("\n");
console.log("\n");
console.log("\n");
