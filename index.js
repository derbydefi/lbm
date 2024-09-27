// Constants for the D2Q9 model
const c = [
    { x: 0, y: 0 },    // Rest particle
    { x: 1, y: 0 },    // East
    { x: 0, y: 1 },    // North
    { x: -1, y: 0 },   // West
    { x: 0, y: -1 },   // South
    { x: 1, y: 1 },    // Northeast
    { x: -1, y: 1 },   // Northwest
    { x: -1, y: -1 },  // Southwest
    { x: 1, y: -1 }    // Southeast
];

const w = [   // Weights for the equilibrium distribution
    4/9,      // Rest particle
    1/9,      // East, North, West, South
    1/9,
    1/9,
    1/9,
    1/36,     // Diagonal directions
    1/36,
    1/36,
    1/36
];

let canvas = document.getElementById('canvas');
// Set willReadFrequently to true for performance optimization
let ctx = canvas.getContext('2d', { willReadFrequently: true });

// Initialize simulation parameters
let cellSize = parseInt(document.getElementById('cellSize').value);
let cols = Math.floor(window.innerWidth / cellSize);
let rows = Math.floor(window.innerHeight / cellSize);

canvas.width = cols * cellSize;
canvas.height = rows * cellSize;

let tau = parseFloat(document.getElementById('viscosity').value); // Relaxation time
let forceStrength = parseFloat(document.getElementById('forceStrength').value); // Force applied
let colorScheme = document.getElementById('colorScheme').value;

let grid = createGrid(cols, rows);
let tempGrid = createGrid(cols, rows);

let isMouseDown = false;
let mouseX = 0;
let mouseY = 0;
let isPaused = false;

let obstacles = createObstacleGrid(cols, rows);

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    handleMouse(e);
});
canvas.addEventListener('mouseup', () => { isMouseDown = false; });
canvas.addEventListener('mousemove', handleMouse);

document.getElementById('viscosity').addEventListener('input', (e) => {
    tau = parseFloat(e.target.value);
});
document.getElementById('forceStrength').addEventListener('input', (e) => {
    forceStrength = parseFloat(e.target.value);
});
document.getElementById('cellSize').addEventListener('input', (e) => {
    cellSize = parseInt(e.target.value);
    resizeSimulation();
});
document.getElementById('colorScheme').addEventListener('change', (e) => {
    colorScheme = e.target.value;
});
document.getElementById('reset').addEventListener('click', resetSimulation);
document.getElementById('clearObstacles').addEventListener('click', clearObstacles);
document.getElementById('pauseResume').addEventListener('click', () => {
    isPaused = !isPaused;
    document.getElementById('pauseResume').textContent = isPaused ? 'Resume Simulation' : 'Pause Simulation';
});

function createGrid(cols, rows) {
    let arr = new Array(cols);
    for (let x = 0; x < cols; x++) {
        arr[x] = new Array(rows);
        for (let y = 0; y < rows; y++) {
            // Each cell has 9 distribution functions
            arr[x][y] = {
                f: new Float32Array(9),
                rho: 1.0,       // Density
                ux: 0.0,        // x-velocity
                uy: 0.0         // y-velocity
            };
            // Initialize distribution functions to equilibrium
            for (let i = 0; i < 9; i++) {
                arr[x][y].f[i] = w[i];
            }
        }
    }
    return arr;
}

function createObstacleGrid(cols, rows) {
    let arr = new Array(cols);
    for (let x = 0; x < cols; x++) {
        arr[x] = new Uint8Array(rows);
    }
    return arr;
}

function resetSimulation() {
    grid = createGrid(cols, rows);
    tempGrid = createGrid(cols, rows);
}

function clearObstacles() {
    obstacles = createObstacleGrid(cols, rows);
}

function resizeSimulation() {
    cols = Math.floor(window.innerWidth / cellSize);
    rows = Math.floor(window.innerHeight / cellSize);
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    resetSimulation();
    obstacles = createObstacleGrid(cols, rows);
}

function handleMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    if (x >= 0 && x < cols && y >= 0 && y < rows) {
        if (e.buttons === 1) {
            // Left click: apply force
            mouseX = x;
            mouseY = y;
        } else if (e.buttons === 2) {
            // Right click: create obstacle
            obstacles[x][y] = 1;
        }
    }
}

// Prevent context menu on right-click
canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

function equilibrium(rho, ux, uy) {
    let feq = new Float32Array(9);
    let usqr = 1.5 * (ux * ux + uy * uy);
    for (let i = 0; i < 9; i++) {
        let cu = 3 * (c[i].x * ux + c[i].y * uy);
        feq[i] = w[i] * rho * (1 + cu + 0.5 * cu * cu - usqr);
    }
    return feq;
}

function collideAndStream() {
    // Collision and streaming combined for optimization
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            let cell = grid[x][y];

            if (obstacles[x][y]) {
                // For obstacles, enforce no-slip condition
                for (let i = 0; i < 9; i++) {
                    cell.f[i] = grid[x][y].f[oppositeDirection(i)];
                }
                continue;
            }

            let rho = 0;
            let ux = 0;
            let uy = 0;

            // Compute macroscopic variables
            for (let i = 0; i < 9; i++) {
                let fi = cell.f[i];
                rho += fi;
                ux += fi * c[i].x;
                uy += fi * c[i].y;
            }

            // Apply external force if mouse is down
            if (isMouseDown && x === mouseX && y === mouseY) {
                ux += forceStrength / rho;
                uy += forceStrength / rho;
            }

            cell.rho = rho;
            cell.ux = ux / rho;
            cell.uy = uy / rho;

            // Collision step
            let feq = equilibrium(rho, cell.ux, cell.uy);
            for (let i = 0; i < 9; i++) {
                cell.f[i] += -(cell.f[i] - feq[i]) / tau;
            }

            // Streaming step
            for (let i = 0; i < 9; i++) {
                let nx = (x + c[i].x + cols) % cols;
                let ny = (y + c[i].y + rows) % rows;

                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                    if (obstacles[nx][ny]) {
                        // Bounce-back boundary condition
                        tempGrid[x][y].f[i] = cell.f[oppositeDirection(i)];
                    } else {
                        tempGrid[nx][ny].f[i] = cell.f[i];
                    }
                }
            }
        }
    }

    // Swap grids
    let temp = grid;
    grid = tempGrid;
    tempGrid = temp;
}

function oppositeDirection(i) {
    const opposite = [0, 3, 4, 1, 2, 7, 8, 5, 6];
    return opposite[i];
}

function draw() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;

    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            let cellIndex = (y * cellSize * canvas.width + x * cellSize) * 4;

            if (obstacles[x][y]) {
                // Obstacle color (e.g., dark gray)
                fillCell(data, x, y, cellSize, [50, 50, 50, 255]);
            } else {
                let cell = grid[x][y];

                let value;
                if (colorScheme === 'velocity') {
                    let speed = Math.sqrt(cell.ux * cell.ux + cell.uy * cell.uy);
                    value = Math.min(speed * 500, 1); // Adjust scaling factor for visual effect
                    let color = hsvToRgb((1 - value) * 240 / 360, 1, value);
                    fillCell(data, x, y, cellSize, [color[0], color[1], color[2], 255]);
                } else if (colorScheme === 'density') {
                    value = Math.min((cell.rho - 1) * 10, 1);
                    let color = hsvToRgb((1 - value) * 240 / 360, 1, value);
                    fillCell(data, x, y, cellSize, [color[0], color[1], color[2], 255]);
                } else {
                    // Default to black if no color scheme matches
                    fillCell(data, x, y, cellSize, [0, 0, 0, 255]);
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function fillCell(data, x, y, size, color) {
    for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) {
            let idx = ((y * size + dy) * canvas.width + (x * size + dx)) * 4;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }
}

function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function loop() {
    if (!isPaused) {
        collideAndStream();
        draw();
    }
    requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
    resizeSimulation();
});

resetSimulation();
loop();
