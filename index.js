// Constants for the D2Q9 model
const c = [
	{ x: 0, y: 0 }, // Rest particle
	{ x: 1, y: 0 }, // East
	{ x: 0, y: 1 }, // North
	{ x: -1, y: 0 }, // West
	{ x: 0, y: -1 }, // South
	{ x: 1, y: 1 }, // Northeast
	{ x: -1, y: 1 }, // Northwest
	{ x: -1, y: -1 }, // Southwest
	{ x: 1, y: -1 }, // Southeast
];

const w = [
	// Weights for the equilibrium distribution
	4 / 9, // Rest particle
	1 / 9, // East, North, West, South
	1 / 9,
	1 / 9,
	1 / 9,
	1 / 36, // Diagonal directions
	1 / 36,
	1 / 36,
	1 / 36,
];

let canvas = document.getElementById("canvas");
// Set willReadFrequently to true for performance optimization
let ctx = canvas.getContext("2d", { willReadFrequently: true });

// Initialize simulation parameters
let cellSize = parseInt(document.getElementById("cellSize").value);
let cols = Math.floor(window.innerWidth / cellSize);
let rows = Math.floor(window.innerHeight / cellSize);

canvas.width = cols * cellSize;
canvas.height = rows * cellSize;

let tau = parseFloat(document.getElementById("viscosity").value); // Relaxation time
let forceStrength = parseFloat(document.getElementById("forceStrength").value); // Force applied
let brushRadius = parseInt(document.getElementById("brushSize").value);
let obstacleBrushRadius = parseInt(
	document.getElementById("obstacleBrushSize").value
);
let vectorSpacing = parseInt(document.getElementById("vectorSpacing").value);

function getSelectedVisualizations() {
	let schemes = [];
	if (document.getElementById("visualization-velocity").checked)
		schemes.push("velocity");
	if (document.getElementById("visualization-density").checked)
		schemes.push("density");
	if (document.getElementById("visualization-pressure").checked)
		schemes.push("pressure");
	if (document.getElementById("visualization-vorticity").checked)
		schemes.push("vorticity");
	if (document.getElementById("visualization-vectorField").checked)
		schemes.push("vectorField");
	return schemes;
}

function updateColorScheme() {
	colorScheme = getSelectedVisualizations();
}

// Initialize colorScheme
let colorScheme = getSelectedVisualizations();

// Add event listeners to checkboxes
document
	.getElementById("visualization-velocity")
	.addEventListener("change", updateColorScheme);
document
	.getElementById("visualization-density")
	.addEventListener("change", updateColorScheme);
document
	.getElementById("visualization-pressure")
	.addEventListener("change", updateColorScheme);
document
	.getElementById("visualization-vorticity")
	.addEventListener("change", updateColorScheme);
document
	.getElementById("visualization-vectorField")
	.addEventListener("change", updateColorScheme);

let grid = createGrid(cols, rows);
let tempGrid = createGrid(cols, rows);

let isPaused = false;

let obstacles = createObstacleGrid(cols, rows);

let prevMouseX = null;
let prevMouseY = null;

let isLeftMouseDown = false;
let isRightMouseDown = false;
let applyForce = false; // Declare applyForce in the global scope
let mouseX = 0;
let mouseY = 0;

canvas.addEventListener("mousedown", (e) => {
	if (e.button === 0) {
		isLeftMouseDown = true;
		applyForce = true;
		handleMouse(e);
	} else if (e.button === 2) {
		isRightMouseDown = true;
		applyForce = false;
		handleMouse(e);
	}
});

canvas.addEventListener("mouseup", (e) => {
	if (e.button === 0) {
		isLeftMouseDown = false;
		applyForce = false;
	} else if (e.button === 2) {
		isRightMouseDown = false;
	}
	prevMouseX = null;
	prevMouseY = null;
});

canvas.addEventListener("mousemove", handleMouse);

// Prevent context menu on right-click
canvas.addEventListener("contextmenu", function (e) {
	e.preventDefault();
});

document.getElementById("viscosity").addEventListener("input", (e) => {
	tau = parseFloat(e.target.value);
});
document.getElementById("forceStrength").addEventListener("input", (e) => {
	forceStrength = parseFloat(e.target.value);
});
document.getElementById("brushSize").addEventListener("input", (e) => {
	brushRadius = parseInt(e.target.value);
});
document.getElementById("obstacleBrushSize").addEventListener("input", (e) => {
	obstacleBrushRadius = parseInt(e.target.value);
});
document.getElementById("vectorSpacing").addEventListener("input", (e) => {
	vectorSpacing = parseInt(e.target.value);
});
document.getElementById("cellSize").addEventListener("input", (e) => {
	cellSize = parseInt(e.target.value);
	resizeSimulation();
});
document.getElementById("reset").addEventListener("click", resetSimulation);
document
	.getElementById("clearObstacles")
	.addEventListener("click", clearObstacles);
document.getElementById("pauseResume").addEventListener("click", () => {
	isPaused = !isPaused;
	document.getElementById("pauseResume").textContent = isPaused
		? "Resume Simulation"
		: "Pause Simulation";
});

// Add event listener for the settings toggle button
document.getElementById("toggleSettings").addEventListener("click", () => {
	const settingsPanel = document.getElementById("settings");
	const toggleButton = document.getElementById("toggleSettings");

	if (
		settingsPanel.style.display === "none" ||
		settingsPanel.style.display === ""
	) {
		settingsPanel.style.display = "block";
		toggleButton.textContent = "Hide Settings";
		// Remove the 'Show Settings' button if it exists
		const showButton = document.getElementById("showSettings");
		if (showButton) {
			showButton.remove();
		}
	} else {
		settingsPanel.style.display = "none";
		// Create a small button to bring back the settings panel
		createShowSettingsButton();
	}
});

function createShowSettingsButton() {
	const existingButton = document.getElementById("showSettings");
	if (existingButton) return; // If button already exists, do nothing

	const showButton = document.createElement("button");
	showButton.id = "showSettings";
	showButton.textContent = "Show Settings";
	showButton.style.position = "absolute";
	showButton.style.top = "10px";
	showButton.style.left = "10px";
	showButton.style.background = "rgba(255,255,255,0.8)";
	showButton.style.border = "none";
	showButton.style.borderRadius = "5px";
	showButton.style.padding = "5px 10px";
	showButton.style.cursor = "pointer";
	showButton.style.zIndex = "11";
	showButton.style.fontFamily = "Arial, sans-serif";
	showButton.style.fontSize = "14px";
	showButton.style.color = "#333";

	showButton.addEventListener("click", () => {
		const settingsPanel = document.getElementById("settings");
		const toggleButton = document.getElementById("toggleSettings");
		settingsPanel.style.display = "block";
		toggleButton.textContent = "Hide Settings";
		showButton.remove();
	});

	document.body.appendChild(showButton);
}

// Remove any existing showSettings button on page load
document.addEventListener("DOMContentLoaded", () => {
	const showButton = document.getElementById("showSettings");
	if (showButton) {
		showButton.remove();
	}
});

// Add event listener for help button
document.getElementById("helpButton").addEventListener("click", () => {
	let helpModal = document.getElementById("helpModal");
	let helpOverlay = document.getElementById("helpOverlay");
	helpModal.style.display = "block";
	helpOverlay.style.display = "block";
});

// Add event listener for close help button
document.getElementById("closeHelp").addEventListener("click", () => {
	let helpModal = document.getElementById("helpModal");
	let helpOverlay = document.getElementById("helpOverlay");
	helpModal.style.display = "none";
	helpOverlay.style.display = "none";
});

// Close help modal when clicking outside of it
document.getElementById("helpOverlay").addEventListener("click", () => {
	let helpModal = document.getElementById("helpModal");
	let helpOverlay = document.getElementById("helpOverlay");
	helpModal.style.display = "none";
	helpOverlay.style.display = "none";
});

function createGrid(cols, rows) {
	let arr = new Array(cols);
	for (let x = 0; x < cols; x++) {
		arr[x] = new Array(rows);
		for (let y = 0; y < rows; y++) {
			// Each cell has 9 distribution functions
			arr[x][y] = {
				f: new Float32Array(9),
				rho: 1.0, // Density
				ux: 0.0, // x-velocity
				uy: 0.0, // y-velocity
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
		if (isLeftMouseDown) {
			// Left click: apply force
			mouseX = x;
			mouseY = y;
		} else if (isRightMouseDown) {
			// Right click: create obstacle line
			if (prevMouseX !== null && prevMouseY !== null) {
				drawLine(prevMouseX, prevMouseY, x, y);
			} else {
				setObstacleAt(x, y);
			}
			prevMouseX = x;
			prevMouseY = y;
		}
	}
}

function setObstacleAt(x, y) {
	for (let dx = -obstacleBrushRadius; dx <= obstacleBrushRadius; dx++) {
		for (let dy = -obstacleBrushRadius; dy <= obstacleBrushRadius; dy++) {
			let nx = x + dx;
			let ny = y + dy;
			if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
				if (dx * dx + dy * dy <= obstacleBrushRadius * obstacleBrushRadius) {
					obstacles[nx][ny] = 1;
				}
			}
		}
	}
}

function drawLine(x0, y0, x1, y1) {
	let dx = Math.abs(x1 - x0);
	let dy = -Math.abs(y1 - y0);
	let sx = x0 < x1 ? 1 : -1;
	let sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	while (true) {
		if (x0 >= 0 && x0 < cols && y0 >= 0 && y0 < rows) {
			setObstacleAt(x0, y0);
		}
		if (x0 === x1 && y0 === y1) break;
		let e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x0 += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y0 += sy;
		}
	}
}

function equilibrium(rho, ux, uy) {
	let feq = new Float32Array(9);
	let usqr = 1.5 * (ux * ux + uy * uy);
	for (let i = 0; i < 9; i++) {
		let cu = 3 * (c[i].x * ux + c[i].y * uy);
		feq[i] = w[i] * rho * (1 + cu + 0.5 * cu * cu - usqr);
	}
	return feq;
}

function oppositeDirection(i) {
	const opposite = [0, 3, 4, 1, 2, 7, 8, 5, 6];
	return opposite[i];
}

function collideAndStream() {
	// Prepare arrays to store vorticity and pressure
	let vorticityGrid = new Array(cols);
	let pressureGrid = new Array(cols);
	for (let x = 0; x < cols; x++) {
		vorticityGrid[x] = new Float32Array(rows);
		pressureGrid[x] = new Float32Array(rows);
	}

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
			if (applyForce) {
				let dx = x - mouseX;
				let dy = y - mouseY;
				if (dx * dx + dy * dy <= brushRadius * brushRadius) {
					let distance = Math.sqrt(dx * dx + dy * dy);
					let factor = 1 - distance / brushRadius;
					factor = Math.max(factor, 0); // Ensure factor is non-negative
					ux += (forceStrength * factor) / rho;
					uy += (forceStrength * factor) / rho;
				}
			}

			cell.rho = rho;
			cell.ux = ux / rho;
			cell.uy = uy / rho;

			// Cap velocities to prevent numerical instability
			let maxVelocity = 0.1;
			cell.ux = Math.max(Math.min(cell.ux, maxVelocity), -maxVelocity);
			cell.uy = Math.max(Math.min(cell.uy, maxVelocity), -maxVelocity);

			// Cap density to prevent numerical issues
			let minDensity = 0.9;
			let maxDensity = 1.1;
			cell.rho = Math.max(Math.min(cell.rho, maxDensity), minDensity);

			// Collision step
			let feq = equilibrium(cell.rho, cell.ux, cell.uy);
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

	// Compute vorticity (after velocities are updated)
	for (let x = 1; x < cols - 1; x++) {
		for (let y = 1; y < rows - 1; y++) {
			if (obstacles[x][y]) continue;
			let du_dy = (grid[x][y + 1].ux - grid[x][y - 1].ux) / 2;
			let dv_dx = (grid[x + 1][y].uy - grid[x - 1][y].uy) / 2;
			vorticityGrid[x][y] = dv_dx - du_dy;
		}
	}

	// Compute pressure as gradient of density
	for (let x = 1; x < cols - 1; x++) {
		for (let y = 1; y < rows - 1; y++) {
			if (obstacles[x][y]) continue;
			let drho_dx = (grid[x + 1][y].rho - grid[x - 1][y].rho) / 2;
			let drho_dy = (grid[x][y + 1].rho - grid[x][y - 1].rho) / 2;
			pressureGrid[x][y] = Math.sqrt(drho_dx * drho_dx + drho_dy * drho_dy);
		}
	}

	// Swap grids
	let temp = grid;
	grid = tempGrid;
	tempGrid = temp;

	draw(vorticityGrid, pressureGrid);
}

function draw(vorticityGrid, pressureGrid) {
	// Clear the canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);

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
				let colors = [];

				// Iterate over selected color schemes
				colorScheme.forEach((scheme) => {
					let value, color;
					if (scheme === "velocity") {
						let speed = Math.sqrt(cell.ux * cell.ux + cell.uy * cell.uy);
						value = Math.min(speed * 50, 1); // Adjusted scaling factor
						value = Math.sqrt(value); // Non-linear scaling for smoother transitions
						color = hsvToRgb(((1 - value) * 240) / 360, 1, value);
					} else if (scheme === "density") {
						value = cell.rho - 1;
						value =
							value > 0 ? Math.min(value * 500, 1) : Math.max(value * 500, -1);
						if (value >= 0) {
							// High density - shades of red
							color = hsvToRgb(0, 1, value);
						} else {
							// Low density - shades of blue
							color = hsvToRgb(240 / 360, 1, -value);
						}
					} else if (scheme === "pressure") {
						value = pressureGrid[x][y];
						value = Math.min(value * 5000, 1); // Adjusted scaling factor
						color = hsvToRgb(((1 - value) * 240) / 360, 1, value);
					} else if (scheme === "vorticity") {
						value = Math.min(Math.abs(vorticityGrid[x][y]) * 50, 1);
						if (vorticityGrid[x][y] > 0) {
							// Positive vorticity - red
							color = [Math.round(255 * value), 0, 0];
						} else {
							// Negative vorticity - blue
							color = [0, 0, Math.round(255 * value)];
						}
					}
					// Exclude vectorField from color calculations
					if (
						["velocity", "density", "pressure", "vorticity"].includes(scheme)
					) {
						colors.push(color);
					}
				});

				// Combine colors (average)
				if (colors.length > 0) {
					let finalColor = colors.reduce(
						(acc, color) => {
							return acc.map((val, idx) => val + color[idx] / colors.length);
						},
						[0, 0, 0]
					);

					fillCell(data, x, y, cellSize, [...finalColor, 255]);
				}
			}
		}
	}

	ctx.putImageData(imageData, 0, 0);

	// Draw vector field
	if (colorScheme.includes("vectorField")) {
		drawVectorField();
	}
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
	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = v;
			b = p;
			break;
		case 2:
			r = p;
			g = v;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = v;
			break;
		case 4:
			r = t;
			g = p;
			b = v;
			break;
		case 5:
			r = v;
			g = p;
			b = q;
			break;
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function drawVectorField() {
	ctx.strokeStyle = "white";
	ctx.lineWidth = 1;

	for (let x = 0; x < cols; x += vectorSpacing) {
		for (let y = 0; y < rows; y += vectorSpacing) {
			if (obstacles[x][y]) continue;

			let cell = grid[x][y];
			let startX = (x + 0.5) * cellSize;
			let startY = (y + 0.5) * cellSize;

			let vx = cell.ux;
			let vy = cell.uy;

			let length = Math.sqrt(vx * vx + vy * vy);
			if (length > 0) {
				let scale = (cellSize * vectorSpacing * 0.4) / length; // Adjust scale
				let endX = startX + vx * scale;
				let endY = startY + vy * scale;

				drawArrow(startX, startY, endX, endY);
			}
		}
	}
}

function drawArrow(fromX, fromY, toX, toY) {
	let headLength = 5; // Length of arrowhead
	let angle = Math.atan2(toY - fromY, toX - fromX);

	ctx.beginPath();
	ctx.moveTo(fromX, fromY);
	ctx.lineTo(toX, toY);
	ctx.lineTo(
		toX - headLength * Math.cos(angle - Math.PI / 6),
		toY - headLength * Math.sin(angle - Math.PI / 6)
	);
	ctx.moveTo(toX, toY);
	ctx.lineTo(
		toX - headLength * Math.cos(angle + Math.PI / 6),
		toY - headLength * Math.sin(angle + Math.PI / 6)
	);
	ctx.stroke();
}

function loop() {
	if (!isPaused) {
		collideAndStream();
	}
	requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
	resizeSimulation();
});

resetSimulation();
loop();
