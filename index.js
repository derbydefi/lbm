// D2Q9 Lattice Boltzmann Fluid Simulation


const C = [
  [0, 0], [1, 0], [0, 1], [-1, 0], [0, -1],
  [1, 1], [-1, 1], [-1, -1], [1, -1]
];

const OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6];

const W = [
  4/9, 1/9, 1/9, 1/9, 1/9,
  1/36, 1/36, 1/36, 1/36
];

// Canvas setup
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });

// Simulation parameters (will be updated from UI)
let cellSize = 4;
let cols, rows;
let tau = 1.0;
let omega = 1 / tau;
let forceStrength = 0.5;
let brushRadius = 3;
let obstacleBrushRadius = 1;
let vectorSpacing = 15;

// Grids: two alternating F grids + obstacle mask
let f0, f1; // Current and next distribution functions
let obstacle;
let isCurrentF0 = true;

// Mouse state
let mouse = { x: 0, y: 0, down: false, rightDown: false };
let prevMouseGrid = null;

// Visualization
let visualizations = new Set(["velocity"]);

// UI Elements
const ui = {
  viscosity: document.getElementById("viscosity"),
  forceStrength: document.getElementById("forceStrength"),
  brushSize: document.getElementById("brushSize"),
  obstacleBrushSize: document.getElementById("obstacleBrushSize"),
  cellSize: document.getElementById("cellSize"),
  vectorSpacing: document.getElementById("vectorSpacing"),
  pauseResume: document.getElementById("pauseResume")
};

let isPaused = false;

// Initialize or resize simulation
function initSimulation() {
  cellSize = parseInt(ui.cellSize.value);
  cols = Math.floor(canvas.clientWidth / cellSize);
  rows = Math.floor(canvas.clientHeight / cellSize);

  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;

  // Create flat typed arrays for maximum performance
  const size = cols * rows * 9;
  f0 = new Float32Array(size);
  f1 = new Float32Array(size);
  obstacle = new Uint8Array(cols * rows);

  // Initialize to equilibrium (rho=1, u=0)
  for (let i = 0; i < cols * rows; i++) {
    for (let k = 0; k < 9; k++) {
      f0[i * 9 + k] = W[k];
    }
  }

  prevMouseGrid = null;
  console.log(`Simulation initialized: ${cols}×${rows} cells`);
}

function idx(x, y, k = 0) {
  return ((x * rows) + y) * 9 + k;
}

// HSV to RGB
function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [r * 255, g * 255, b * 255];
}

// Main LBM step: Collision + Streaming (push scheme)
function simulate() {
  const fSrc = isCurrentF0 ? f0 : f1;
  const fDst = isCurrentF0 ? f1 : f0;

  let ux, uy, rho;
  let feq = new Float32Array(9);

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const cellIdx = idx(x, y);
      const isObs = obstacle[x * rows + y];

      if (isObs) {
        // Bounce-back: reverse populations
        for (let k = 0; k < 9; k++) {
          fDst[cellIdx + k] = fSrc[cellIdx + OPPOSITE[k]];
        }
        continue;
      }

      // 1. Compute macroscopic variables
      rho = 0; ux = 0; uy = 0;
      for (let k = 0; k < 9; k++) {
        const fk = fSrc[cellIdx + k];
        rho += fk;
        ux += fk * C[k][0];
        uy += fk * C[k][1];
      }
      ux /= rho;
      uy /= rho;

      // 2. Apply localized force (Gaussian brush)
      if (mouse.down) {
        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const dist2 = dx * dx + dy * dy;
        const r2 = brushRadius * brushRadius;
        if (dist2 < r2) {
          const force = forceStrength * Math.exp(-dist2 / (r2 * 0.5));
          ux += force * (mouse.vx || 0.02);  // default small rightward push
          uy += force * (mouse.vy || 0);
        }
      }

      // 3. Collision (BGK)
      const ux2 = ux * ux;
      const uy2 = uy * uy;
      const u2 = ux2 + uy2;
      const uxuy = ux * uy;

      for (let k = 0; k < 9; k++) {
        const ckx = C[k][0];
        const cky = C[k][1];
        const cu = ckx * ux + cky * uy;
        const feq_k = W[k] * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * u2);
        feq[k] = feq_k;
        fSrc[cellIdx + k] = fSrc[cellIdx + k] * (1 - omega) + omega * feq_k;
      }

      // 4. Streaming (push to neighbors)
      for (let k = 0; k < 9; k++) {
        const nx = (x + C[k][0] + cols) % cols;
        const ny = (y + C[k][1] + rows) % rows;
        const ni = idx(nx, ny);
        fDst[ni + k] = fSrc[cellIdx + k];
      }
    }
  }

  isCurrentF0 = !isCurrentF0;
}

// Render everything
function render() {
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  const f = isCurrentF0 ? f0 : f1;

  let rho, ux, uy, speed, vorticity;

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const obs = obstacle[x * rows + y];
      const i = idx(x, y);
      const px = x * cellSize;
      const py = y * cellSize;

      if (obs) {
        const col = [40, 40, 40, 255];
        for (let dx = 0; dx < cellSize; dx++) {
          for (let dy = 0; dy < cellSize; dy++) {
            const p = ((py + dy) * canvas.width + (px + dx)) * 4;
            data[p] = col[0]; data[p+1] = col[1]; data[p+2] = col[2]; data[p+3] = col[3];
          }
        }
        continue;
      }

      // Compute macros
      rho = ux = uy = 0;
      for (let k = 0; k < 9; k++) {
        const fk = f[i + k];
        rho += fk;
        ux += fk * C[k][0];
        uy += fk * C[k][1];
      }
      ux /= rho;
      uy /= rho;
      speed = Math.hypot(ux, uy);

      // Vorticity (central difference)
      if (x > 0 && x < cols-1 && y > 0 && y < rows-1) {
        const ux_left = f[idx(x-1,y)] + f[idx(x-1,y)+1] - f[idx(x-1,y)+3] || 0;
        const ux_right = f[idx(x+1,y)] + f[idx(x+1,y)+1] - f[idx(x+1,y)+3] || 0;
        const uy_bottom = f[idx(x,y-1)] + f[idx(x,y-1)+2] - f[idx(x,y-1)+4] || 0;
        const uy_top = f[idx(x,y+1)] + f[idx(x,y+1)+2] - f[idx(x,y+1)+4] || 0;
        vorticity = ((uy_top - uy_bottom) - (ux_right - ux_left)) * 0.1;
      } else {
        vorticity = 0;
      }

      let r = 0, g = 0, b = 0;
      let count = 0;

      for (const mode of visualizations) {
        let color;
        if (mode === "velocity") {
          const hue = (Math.atan2(uy, ux) + Math.PI) / (2 * Math.PI);
          color = hsvToRgb(hue, 0.9, Math.min(speed * 80, 1));
        } else if (mode === "density") {
          const d = (rho - 1) * 300;
          if (d > 0) color = [255, 100 + d, 100 + d];
          else color = [100 - d, 100 - d, 255];
        } else if (mode === "vorticity") {
          const v = Math.min(Math.abs(vorticity) * 15, 1);
          if (vorticity > 0) color = [255 * v, 0, 100];
          else color = [50, 100, 255 * v];
        } else if (mode === "pressure") {
          const p = rho * (1/3);
          const val = Math.min((p - 0.333) * 3000, 1);
          color = val > 0 ? [255, 200, 200 + val*55] : [200 + val*55, 200, 255];
        }
        if (color) {
          r += color[0]; g += color[1]; b += color[2];
          count++;
        }
      }

      if (count === 0) [r, g, b] = [0, 0, 30];
      else { r /= count; g /= count; b /= count; }

      for (let dx = 0; dx < cellSize; dx++) {
        for (let dy = 0; dy < cellSize; dy++) {
          const p = ((py + dy) * canvas.width + (px + dx)) * 4;
          data[p] = r; data[p+1] = g; data[p+2] = b; data[p+3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Vector field overlay
  if (visualizations.has("vectorField")) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    for (let x = 5; x < cols; x += vectorSpacing) {
      for (let y = 5; y < rows; y += vectorSpacing) {
        if (obstacle[x * rows + y]) continue;
        const i = idx(x, y);
        let ux = 0, uy = 0, rho = 0;
        for (let k = 0; k < 9; k++) {
          const fk = f[i + k];
          rho += fk;
          ux += fk * C[k][0];
          uy += fk * C[k][1];
        }
        ux /= rho; uy /= rho;
        const mag = Math.hypot(ux, uy);
        if (mag < 0.001) continue;

        const scale = cellSize * vectorSpacing * 0.8;
        const x0 = x * cellSize + cellSize / 2;
        const y0 = y * cellSize + cellSize / 2;
        const x1 = x0 + ux * scale;
        const y1 = y0 + uy * scale;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        const angle = Math.atan2(y1 - y0, x1 - x0);
        ctx.lineTo(x1 - 6 * Math.cos(angle - 0.5), y1 - 6 * Math.sin(angle - 0.5));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - 6 * Math.cos(angle + 0.5), y1 - 6 * Math.sin(angle + 0.5));
        ctx.stroke();
      }
    }
  }
}

// Mouse handlers
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const gx = Math.floor((e.clientX - rect.left) / cellSize);
  const gy = Math.floor((e.clientY - rect.top) / cellSize);

  if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
    mouse.x = gx;
    mouse.y = gy;

    if (mouse.rightDown && prevMouseGrid) {
      drawObstacleLine(prevMouseGrid.x, prevMouseGrid.y, gx, gy);
    }
    prevMouseGrid = { x: gx, y: gy };
  }
});

canvas.addEventListener("mousedown", e => {
  if (e.button === 0) {
    mouse.down = true;
    const dx = e.movementX, dy = e.movementY;
    mouse.vx = dx * 0.01;
    mouse.vy = dy * 0.01;
  } else if (e.button === 2) {
    mouse.rightDown = true;
    prevMouseGrid = mouse;
  }
  e.preventDefault();
});

canvas.addEventListener("mouseup", e => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) {
    mouse.rightDown = false;
    prevMouseGrid = null;
  }
});

canvas.addEventListener("contextmenu", e => e.preventDefault());

function drawObstacleLine(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    drawObstacleBrush(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function drawObstacleBrush(x, y) {
  const r = obstacleBrushRadius;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (dx*dx + dy*dy <= r*r) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
          obstacle[nx * rows + ny] = 1;
        }
      }
    }
  }
}

// UI Listeners
document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
  cb.addEventListener("change", () => {
    visualizations = new Set(
      Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(c => c.id.replace("visualization-", ""))
    );
  });
});

ui.viscosity.addEventListener("input", e => { tau = +e.target.value; omega = 1/tau; });
ui.forceStrength.addEventListener("input", e => forceStrength = +e.target.value);
ui.brushSize.addEventListener("input", e => brushRadius = +e.target.value);
ui.obstacleBrushSize.addEventListener("input", e => obstacleBrushRadius = +e.target.value);
ui.vectorSpacing.addEventListener("input", e => vectorSpacing = +e.target.value);
ui.cellSize.addEventListener("input", () => { initSimulation(); });
ui.pauseResume.addEventListener("click", () => {
  isPaused = !isPaused;
  ui.pauseResume.textContent = isPaused ? "Resume" : "Pause";
});

document.getElementById("reset").addEventListener("click", initSimulation);
document.getElementById("clearObstacles").addEventListener("click", () => {
  obstacle.fill(0);
});

// Resize handler
window.addEventListener("resize", () => {
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  initSimulation();
});

// Help modal (unchanged)
document.getElementById("helpButton").addEventListener("click", () => {
  document.getElementById("helpModal").style.display = "block";
  document.getElementById("helpOverlay").style.display = "block";
});
document.getElementById("closeHelp").addEventListener("click", () => {
  document.getElementById("helpModal").style.display = "none";
  document.getElementById("helpOverlay").style.display = "none";
});
document.getElementById("helpOverlay").addEventListener("click", () => {
  document.getElementById("helpModal").style.display = "none";
  document.getElementById("helpOverlay").style.display = "none";
});

// Animation loop
function loop() {
  if (!isPaused) {
    simulate();
    render();
  }
  requestAnimationFrame(loop);
}

// Start
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.width = "100vw";
canvas.style.height = "100vh";

initSimulation();
loop();
