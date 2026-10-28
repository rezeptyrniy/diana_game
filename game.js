"use strict";

(() => {
	const SIZE = 10;
	const STORAGE_KEY = "luma-blocks-save-v1";
	const SCORE_CONFIG = Object.freeze({
		pointsPerBlock: 10,
		lineBase: 100,
		extraLineMultiplier: 0.5
	});
	const PALETTES = {
		neon:   ["#9b7cff", "#ff9475", "#5fd1c5", "#f7c85f", "#68a7ff", "#ed78ad"],
		pastel: ["#c4a8ff", "#ffb8a0", "#a0e8dd", "#ffe08a", "#a8c8ff", "#ffb8d8"],
		forest: ["#7fb069", "#d4a373", "#588157", "#e9c46a", "#457b9d", "#a8dadc"],
		mono:   ["#6b7280", "#9ca3af", "#d1d5db", "#4b5563", "#f3f4f6", "#374151"]
	};
	let COLORS = PALETTES.neon.slice();
	const SHAPES = [
		[[0, 0]],
		[[0, 0], [0, 1]],
		[[0, 0], [0, 1], [0, 2]],
		[[0, 0], [1, 0], [2, 0]],
		[[0, 0], [0, 1], [0, 2], [0, 3]],
		[[0, 0], [1, 0], [2, 0], [3, 0]],
		[[0, 0], [0, 1], [1, 0], [1, 1]],
		[[0, 0], [0, 1], [0, 2], [1, 0]],
		[[0, 0], [0, 1], [0, 2], [1, 2]],
		[[0, 0], [1, 0], [1, 1], [1, 2]],
		[[0, 2], [1, 0], [1, 1], [1, 2]],
		[[0, 0], [1, 0], [2, 0], [2, 1]],
		[[0, 1], [1, 1], [2, 0], [2, 1]],
		[[0, 0], [0, 1], [0, 2], [1, 1]],
		[[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
		[[0, 0], [0, 1], [1, 1], [1, 2]],
		[[0, 1], [0, 2], [1, 0], [1, 1]],
		[[0, 0], [1, 0], [1, 1], [2, 1]],
		[[0, 1], [1, 0], [1, 1], [2, 0]],
		[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
		[[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]
	];
	const ACHIEVEMENTS = [
		{ id: "first_line",   icon: "🎯", title: "Первая линия",    desc: "Снесите одну линию" },
		{ id: "double_line",  icon: "✌️", title: "Двойное",         desc: "Снесите 2 линии за ход" },
		{ id: "triple_line",  icon: "🔥", title: "Тройное",         desc: "Снесите 3 линии за ход" },
		{ id: "score_500",    icon: "⭐", title: "500 очков",       desc: "Наберите 500 очков за партию" },
		{ id: "score_1500",   icon: "🌟", title: "1500 очков",      desc: "Наберите 1500 очков за партию" },
		{ id: "score_3000",   icon: "💎", title: "3000 очков",      desc: "Наберите 3000 очков за партию" },
		{ id: "games_10",     icon: "🎮", title: "10 партий",       desc: "Сыграйте 10 партий" },
		{ id: "games_50",     icon: "🏅", title: "50 партий",       desc: "Сыграйте 50 партий" },
		{ id: "lines_50",     icon: "📏", title: "50 линий",        desc: "Снесите 50 линий всего" },
		{ id: "lines_200",    icon: "🧱", title: "200 линий",       desc: "Снесите 200 линий всего" },
		{ id: "combo_master", icon: "🎪", title: "Комбо-мастер",    desc: "Снесите 2+ линии 5 раз за партию" },
		{ id: "night_owl",    icon: "🌙", title: "Полночный игрок", desc: "Сыграйте партию после полуночи" }
	];

	const boardElement = document.querySelector("#board");
	const rackElement = document.querySelector("#piece-rack");
	const scoreElement = document.querySelector("#score");
	const bestElement = document.querySelector("#best-score");
	const soundButton = document.querySelector("#sound-toggle");
	const overlayElement = document.querySelector("#board-overlay");
	const toastElement = document.querySelector("#toast");
	const turnHintElement = document.querySelector("#turn-hint");
	const particlesLayer = document.querySelector("#particles-layer");
	const paletteButton = document.querySelector("#palette-toggle");
	const achievementsModal = document.querySelector("#achievements-modal");
	const achievementsList = document.querySelector("#achievements-list");
	const achievementToasts = document.querySelector("#achievement-toasts");
	const cells = [];

	let board = createEmptyBoard();
	let pieces = [];
	let selectedIndex = -1;
	let score = 0;
	let best = 0;
	let soundEnabled = false;
	let gamesPlayed = 0;
	let locked = false;
	let pointerDrag = null;
	let suppressBoardClick = false;
	let audioContext = null;
	let toastTimer = 0;
	let paletteName = "neon";
	let paletteMenu = null;
	let unlockedAchievements = [];
	let sessionLineCount = 0;
	let sessionComboCount = 0;
	let liftedPiece = null;

	function createEmptyBoard() {
		return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
	}

	function loadSavedSettings() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			best = Number.isFinite(saved.best) && saved.best >= 0 ? saved.best : 0;
			soundEnabled = saved.sound === true;
			gamesPlayed = Number.isInteger(saved.gamesPlayed) && saved.gamesPlayed >= 0 ? saved.gamesPlayed : 0;
			if (typeof saved.palette === "string" && PALETTES[saved.palette]) {
				paletteName = saved.palette;
				COLORS = PALETTES[paletteName].slice();
			}
			if (Array.isArray(saved.achievements)) {
				unlockedAchievements = saved.achievements.filter((id) => ACHIEVEMENTS.some((a) => a.id === id));
			}
		} catch (error) {
			console.warn("Не удалось прочитать сохранённые данные игры.", error);
		}
		bestElement.textContent = String(best);
		soundButton.setAttribute("aria-pressed", String(soundEnabled));
		soundButton.setAttribute("aria-label", soundEnabled ? "Выключить звук" : "Включить звук");
	}

	function saveSettings() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				best, sound: soundEnabled, gamesPlayed,
				palette: paletteName, achievements: unlockedAchievements,
				board, pieces, score
			}));
		} catch (error) {
			console.warn("Не удалось сохранить данные игры.", error);
		}
	}

	function createBoardCells() {
		const fragment = document.createDocumentFragment();
		for (let row = 0; row < SIZE; row += 1) {
			for (let col = 0; col < SIZE; col += 1) {
				const cell = document.createElement("button");
				cell.type = "button";
				cell.className = "board-cell";
				cell.setAttribute("role", "gridcell");
				cell.setAttribute("aria-label", `Строка ${row + 1}, столбец ${col + 1}`);
				cell.dataset.row = String(row);
				cell.dataset.col = String(col);
				fragment.append(cell);
				cells.push(cell);
			}
		}
		boardElement.append(fragment);
	}

	function randomPiece() {
		const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
		return {
			shape: shape.map(([row, col]) => [row, col]),
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			used: false
		};
	}

	function generatePieces() {
		pieces = Array.from({ length: 3 }, randomPiece);
		selectedIndex = -1;
		renderPieces();
	}

	function renderPieces() {
		rackElement.replaceChildren();
		pieces.forEach((piece, index) => {
			const slot = document.createElement("div");
			slot.className = "piece-slot";
			if (piece.used) slot.classList.add("used");
			if (index === selectedIndex) slot.classList.add("selected");
			slot.dataset.index = String(index);

			const button = document.createElement("button");
			button.type = "button";
			button.className = "piece-button";
			button.setAttribute("aria-label", piece.used ? "Фигура использована" : `Выбрать фигуру ${index + 1}`);
			button.setAttribute("aria-pressed", String(index === selectedIndex));
			button.dataset.index = String(index);
			button.style.setProperty("--piece-color", piece.color);

			const height = Math.max(...piece.shape.map(([row]) => row)) + 1;
			const width = Math.max(...piece.shape.map(([, col]) => col)) + 1;
			const shape = document.createElement("span");
			shape.className = "piece-shape";
			shape.style.gridTemplateColumns = `repeat(${width}, auto)`;
			shape.style.gridTemplateRows = `repeat(${height}, auto)`;
			const occupied = new Set(piece.shape.map(([row, col]) => `${row}:${col}`));
			for (let row = 0; row < height; row += 1) {
				for (let col = 0; col < width; col += 1) {
					const block = document.createElement("i");
					block.className = `piece-cell${occupied.has(`${row}:${col}`) ? "" : " empty"}`;
					block.dataset.row = String(row);
					block.dataset.col = String(col);
					shape.append(block);
				}
			}
			button.append(shape);
			slot.append(button);
			rackElement.append(slot);
		});
	}

	function renderBoard() {
		cells.forEach((cell, index) => {
			const row = Math.floor(index / SIZE);
			const col = index % SIZE;
			cell.classList.remove("filled", "preview-valid", "preview-invalid", "clearing");
			cell.style.removeProperty("--cell-color");
			if (board[row][col]) {
				cell.classList.add("filled");
				cell.style.setProperty("--cell-color", board[row][col]);
			}
		});
		updateScoreDisplay();
	}

	function updateScoreDisplay() {
		scoreElement.textContent = String(score);
		bestElement.textContent = String(best);
	}

	function selectPiece(index) {
		if (locked || !pieces[index] || pieces[index].used) return;
		selectedIndex = index;
		Array.from(rackElement.children).forEach((slot, slotIndex) => {
			slot.classList.toggle("selected", slotIndex === selectedIndex);
			slot.querySelector(".piece-button")
				.setAttribute("aria-pressed", String(slotIndex === selectedIndex));
		});
		turnHintElement.textContent = "Теперь коснитесь клетки поля";
	}

	function canPlace(shape, originRow, originCol) {
		return shape.every(([row, col]) => {
			const targetRow = originRow + row;
			const targetCol = originCol + col;
			return targetRow >= 0 && targetRow < SIZE
				&& targetCol >= 0 && targetCol < SIZE
				&& board[targetRow][targetCol] === null;
		});
	}

	function hasAnyPlacement(shape) {
		for (let row = 0; row < SIZE; row += 1) {
			for (let col = 0; col < SIZE; col += 1) {
				if (canPlace(shape, row, col)) return true;
			}
		}
		return false;
	}

	function hasAvailableMove() {
		return pieces.some((piece) => !piece.used && hasAnyPlacement(piece.shape));
	}

	function getCellAtPoint(clientX, clientY) {
		const rect = boardElement.getBoundingClientRect();
		if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) return null;
		const style = getComputedStyle(boardElement);
		const gap = parseFloat(style.gap) || 0;
		const cellSize = (rect.width - gap * (SIZE - 1)) / SIZE;
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		const col = Math.floor(x / (cellSize + gap));
		const row = Math.floor(y / (cellSize + gap));
		if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
		const withinCol = x - col * (cellSize + gap);
		const withinRow = y - row * (cellSize + gap);
		if (withinCol > cellSize || withinRow > cellSize) return null;
		return { row, col };
	}

	function showPreview(originRow, originCol, piece) {
		clearPreview();
		const valid = canPlace(piece.shape, originRow, originCol);
		piece.shape.forEach(([row, col]) => {
			const targetRow = originRow + row;
			const targetCol = originCol + col;
			if (targetRow < 0 || targetRow >= SIZE || targetCol < 0 || targetCol >= SIZE) return;
			const cell = cells[targetRow * SIZE + targetCol];
			cell.classList.add(valid ? "preview-valid" : "preview-invalid");
			if (valid) cell.style.setProperty("--preview-color", piece.color);
		});
	}

	function clearPreview() {
		cells.forEach((cell) => {
			cell.classList.remove("preview-valid", "preview-invalid");
			cell.style.removeProperty("--preview-color");
		});
	}

	function liftPiece(index, clientX, clientY) {
		if (index < 0 || !pieces[index] || pieces[index].used) return;
		if (liftedPiece) return;

		const button = rackElement.querySelector(`.piece-button[data-index="${index}"]`);
		const shapeEl = button ? button.querySelector(".piece-shape") : null;
		if (!shapeEl) return;

		const ghost = document.createElement("div");
		ghost.className = "lifted-ghost";
		ghost.append(shapeEl);

		const rows = pieces[index].shape.map(([r]) => r);
		const cols = pieces[index].shape.map(([, c]) => c);
		const anchorRow = Math.floor((Math.min(...rows) + Math.max(...rows)) / 2);
		const anchorCol = Math.floor((Math.min(...cols) + Math.max(...cols)) / 2);

		document.body.append(ghost);
		if (button) button.style.visibility = "hidden";

		liftedPiece = {
			index,
			ghost,
			sourceButton: button,
			anchorRow,
			anchorCol,
			lastPoint: null
		};

		selectPiece(index);
		turnHintElement.textContent = "Ведите пальцем по полю, отпустите для установки";
		updateLiftedGhost(clientX, clientY);
	}

	function updateLiftedGhost(clientX, clientY) {
		if (!liftedPiece) return;
		liftedPiece.ghost.style.left = `${clientX}px`;
		liftedPiece.ghost.style.top = `${clientY}px`;
		const point = getCellAtPoint(clientX, clientY);
		if (!point) {
			liftedPiece.lastPoint = null;
			clearPreview();
			return;
		}
		const originRow = point.row - liftedPiece.anchorRow;
		const originCol = point.col - liftedPiece.anchorCol;
		liftedPiece.lastPoint = { originRow, originCol };
		showPreview(originRow, originCol, pieces[liftedPiece.index]);
	}

	function dropLiftedPiece() {
		if (!liftedPiece) return;
		const lifted = liftedPiece;
		liftedPiece = null;

		if (lifted.lastPoint) {
			const { originRow, originCol } = lifted.lastPoint;
			placePiece(lifted.index, originRow, originCol);
		}

		if (lifted.ghost && lifted.ghost.parentNode) {
			lifted.ghost.remove();
		}
		if (lifted.sourceButton) {
			lifted.sourceButton.style.visibility = "";
		}
		clearPreview();
		turnHintElement.textContent = "Перетащите на поле или выберите и коснитесь клетки";
		renderPieces();
	}

	function updateDragPreview(clientX, clientY) {
		const point = getCellAtPoint(clientX, clientY);
		const piece = pointerDrag && pieces[pointerDrag.index];
		if (!point || !piece) {
			clearPreview();
			pointerDrag.overBoard = false;
			return;
		}
		pointerDrag.overBoard = true;
		pointerDrag.originRow = point.row - pointerDrag.anchorRow;
		pointerDrag.originCol = point.col - pointerDrag.anchorCol;
		showPreview(pointerDrag.originRow, pointerDrag.originCol, piece);
	}

	function calculateClears() {
		const rows = [];
		const cols = [];
		for (let row = 0; row < SIZE; row += 1) {
			if (board[row].every(Boolean)) rows.push(row);
		}
		for (let col = 0; col < SIZE; col += 1) {
			if (board.every((row) => Boolean(row[col]))) cols.push(col);
		}
		const clearSet = new Set();
		rows.forEach((row) => {
			for (let col = 0; col < SIZE; col += 1) clearSet.add(row * SIZE + col);
		});
		cols.forEach((col) => {
			for (let row = 0; row < SIZE; row += 1) clearSet.add(row * SIZE + col);
		});
		return { rows, cols, clearSet, lineCount: rows.length + cols.length };
	}

	function addPoints(points, showBonus) {
		score += points;
		if (score > best) best = score;
		if (showBonus) showToast(`+${points}`);
		updateScoreDisplay();
		saveSettings();
	}

	function spawnParticles(cellIndices) {
		if (!particlesLayer) return;
		const frameRect = particlesLayer.getBoundingClientRect();
		cellIndices.forEach((cellIndex) => {
			const row = Math.floor(cellIndex / SIZE);
			const col = cellIndex % SIZE;
			const color = board[row][col];
			if (!color) return;
			const cellRect = cells[cellIndex].getBoundingClientRect();
			const cx = cellRect.left - frameRect.left + cellRect.width / 2;
			const cy = cellRect.top - frameRect.top + cellRect.height / 2;
			for (let i = 0; i < 4; i += 1) {
				const p = document.createElement("span");
				p.className = "particle";
				p.style.background = color;
				p.style.left = `${cx - 4}px`;
				p.style.top = `${cy - 4}px`;
				const angle = Math.random() * Math.PI * 2;
				const dist = 20 + Math.random() * 40;
				p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
				p.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
				p.style.animationDelay = `${Math.random() * 60}ms`;
				particlesLayer.append(p);
				window.setTimeout(() => p.remove(), 700);
			}
		});
	}

	function buildPaletteMenu() {
		paletteMenu = document.createElement("div");
		paletteMenu.className = "palette-menu";
		const labels = { neon: "Neon", pastel: "Pastel", forest: "Forest", mono: "Mono" };
		Object.entries(PALETTES).forEach(([name, colors]) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "palette-option" + (name === paletteName ? " active" : "");
			btn.dataset.palette = name;
			btn.innerHTML = `<span class="palette-swatches">${colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span><span>${labels[name]}</span>`;
			btn.addEventListener("click", () => applyPalette(name));
			paletteMenu.append(btn);
		});
		document.body.append(paletteMenu);
		document.addEventListener("click", (event) => {
			if (!paletteMenu.classList.contains("visible")) return;
			if (event.target.closest("#palette-toggle")) return;
			if (event.target.closest(".palette-menu")) return;
			paletteMenu.classList.remove("visible");
		});
	}

	function applyPalette(name) {
		if (!PALETTES[name]) return;
		paletteName = name;
		COLORS = PALETTES[name].slice();
		cells.forEach((cell, index) => {
			const row = Math.floor(index / SIZE);
			const col = index % SIZE;
			if (board[row][col]) {
				const idx = COLORS.indexOf(board[row][col]);
				if (idx >= 0) cell.style.setProperty("--cell-color", COLORS[idx]);
			}
		});
		pieces.forEach((piece, index) => {
			const btn = rackElement.querySelector(`.piece-button[data-index="${index}"]`);
			if (!btn) return;
			const idx = COLORS.indexOf(piece.color);
			if (idx >= 0) {
				piece.color = COLORS[idx];
				btn.style.setProperty("--piece-color", piece.color);
			}
		});
		paletteMenu?.querySelectorAll(".palette-option").forEach((el) => {
			el.classList.toggle("active", el.dataset.palette === name);
		});
		paletteMenu?.classList.remove("visible");
		saveSettings();
		showToast(`Палитра: ${({ neon: "Neon", pastel: "Pastel", forest: "Forest", mono: "Mono" })[name]}`);
	}

	function renderAchievementsList() {
		if (!achievementsList) return;
		achievementsList.replaceChildren();
		ACHIEVEMENTS.forEach((ach) => {
			const unlocked = unlockedAchievements.includes(ach.id);
			const item = document.createElement("div");
			item.className = "achievement-item" + (unlocked ? " unlocked" : "");
			item.innerHTML = `<span class="achievement-icon">${ach.icon}</span><div class="achievement-text"><strong>${ach.title}</strong><span>${ach.desc}</span></div><span>${unlocked ? "✓" : "🔒"}</span>`;
			achievementsList.append(item);
		});
	}

	function unlockAchievement(id) {
		if (unlockedAchievements.includes(id)) return;
		const ach = ACHIEVEMENTS.find((a) => a.id === id);
		if (!ach) return;
		unlockedAchievements.push(id);
		saveSettings();
		showAchievementToast(ach);
		renderAchievementsList();
	}

	function showAchievementToast(ach) {
		if (!achievementToasts) return;
		const toast = document.createElement("div");
		toast.className = "achievement-toast";
		toast.innerHTML = `<span class="icon">${ach.icon}</span><div class="body"><strong>Достижение!</strong><span>${ach.title}</span></div>`;
		achievementToasts.append(toast);
		window.setTimeout(() => toast.remove(), 3000);
	}

	function checkAchievements(context) {
		const { lineCount = 0, isNewGame = false, isNight = false } = context || {};
		if (lineCount >= 1) unlockAchievement("first_line");
		if (lineCount >= 2) unlockAchievement("double_line");
		if (lineCount >= 3) unlockAchievement("triple_line");
		if (score >= 500) unlockAchievement("score_500");
		if (score >= 1500) unlockAchievement("score_1500");
		if (score >= 3000) unlockAchievement("score_3000");
		if (gamesPlayed >= 10) unlockAchievement("games_10");
		if (gamesPlayed >= 50) unlockAchievement("games_50");
		if (sessionLineCount >= 50) unlockAchievement("lines_50");
		if (sessionLineCount >= 200) unlockAchievement("lines_200");
		if (isNewGame && isNight) unlockAchievement("night_owl");
		if (isNewGame) { sessionLineCount = 0; sessionComboCount = 0; }
	}

	function showToast(message) {
		window.clearTimeout(toastTimer);
		toastElement.textContent = message;
		toastElement.classList.remove("show");
		void toastElement.offsetWidth;
		toastElement.classList.add("show");
		toastTimer = window.setTimeout(() => toastElement.classList.remove("show"), 950);
	}

	function playTone(frequency, duration = 0.09) {
		if (!soundEnabled) return;
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) return;
		try {
			audioContext ||= new AudioContextClass();
			if (audioContext.state === "suspended") audioContext.resume();
			const oscillator = audioContext.createOscillator();
			const gain = audioContext.createGain();
			oscillator.type = "sine";
			oscillator.frequency.value = frequency;
			gain.gain.setValueAtTime(0.055, audioContext.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
			oscillator.connect(gain);
			gain.connect(audioContext.destination);
			oscillator.start();
			oscillator.stop(audioContext.currentTime + duration);
		} catch (error) {
			console.warn("Не удалось воспроизвести звук.", error);
		}
	}

	function placePiece(index, originRow, originCol) {
		if (locked || !pieces[index] || pieces[index].used) return false;
		const piece = pieces[index];
		if (!canPlace(piece.shape, originRow, originCol)) {
			showPreview(originRow, originCol, piece);
			window.setTimeout(clearPreview, 260);
			return false;
		}

		piece.shape.forEach(([row, col]) => {
			board[originRow + row][originCol + col] = piece.color;
		});
		piece.used = true;
		selectedIndex = -1;
		const placedPoints = piece.shape.length * SCORE_CONFIG.pointsPerBlock;
		const clears = calculateClears();
		const bonus = clears.lineCount === 0
			? 0
			: Math.round(SCORE_CONFIG.lineBase * clears.lineCount
				* (1 + SCORE_CONFIG.extraLineMultiplier * (clears.lineCount - 1)));
		addPoints(placedPoints + bonus, clears.lineCount > 0);
		playTone(clears.lineCount > 0 ? 740 : 480, clears.lineCount > 0 ? 0.16 : 0.08);

		if (clears.clearSet.size > 0) {
			locked = true;
			spawnParticles([...clears.clearSet]);
			clears.clearSet.forEach((cellIndex) => cells[cellIndex].classList.add("clearing"));
			sessionLineCount += clears.lineCount;
			if (clears.lineCount >= 2) sessionComboCount += 1;
			window.setTimeout(() => {
				clears.clearSet.forEach((cellIndex) => {
					const row = Math.floor(cellIndex / SIZE);
					const col = cellIndex % SIZE;
					board[row][col] = null;
				});
				renderBoard();
				finishPlacement();
			}, 240);
			if (sessionComboCount >= 5) unlockAchievement("combo_master");
			checkAchievements({ lineCount: clears.lineCount });
		} else {
			renderBoard();
			finishPlacement();
		}
		renderPieces();
		return true;
	}

	function finishPlacement() {
		locked = false;
		if (pieces.every((piece) => piece.used)) {
			generatePieces();
		} else {
			renderPieces();
		}
		turnHintElement.textContent = "Перетащите на поле или выберите и коснитесь клетки";
		if (!hasAvailableMove()) endGame();
	}

	function endGame() {
		document.querySelector("#overlay-title").textContent = "Партия окончена";
		document.querySelector("#overlay-message").textContent = `Ваш счёт — ${score}. Сыграно партий: ${gamesPlayed}.`;
		document.querySelector("#overlay-icon").textContent = "✦";
		overlayElement.classList.add("visible");
		overlayElement.setAttribute("aria-hidden", "false");
	}

	function startNewGame() {
		board = createEmptyBoard();
		score = 0;
		locked = false;
		pointerDrag = null;
		selectedIndex = -1;
		gamesPlayed += 1;
		sessionLineCount = 0;
		sessionComboCount = 0;
		overlayElement.classList.remove("visible");
		overlayElement.setAttribute("aria-hidden", "true");
		clearPreview();
		if (liftedPiece) { liftedPiece.ghost.remove(); liftedPiece = null; }
		renderBoard();
		generatePieces();
		turnHintElement.textContent = "Перетащите на поле или выберите и коснитесь клетки";
		saveSettings();
		checkAchievements({ isNewGame: true, isNight: new Date().getHours() < 5 || new Date().getHours() >= 23 });
		renderAchievementsList();
	}

	function onPiecePointerDown(event) {
		const button = event.target.closest(".piece-button");
		if (!button || event.button !== 0 || locked) return;
		const index = Number(button.dataset.index);
		const piece = pieces[index];
		if (!piece || piece.used) return;
		event.preventDefault();
		const block = event.target.closest(".piece-cell:not(.empty)");
		pointerDrag = {
			pointerId: event.pointerId,
			index,
			startX: event.clientX,
			startY: event.clientY,
			anchorRow: block ? Number(block.dataset.row) : 0,
			anchorCol: block ? Number(block.dataset.col) : 0,
			dragging: false,
			overBoard: false,
			originRow: 0,
			originCol: 0
		};
		selectPiece(index);
	}

	function onPointerMove(event) {
		if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
		const delta = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
		if (!pointerDrag.dragging && delta < 6) return;
		pointerDrag.dragging = true;
		event.preventDefault();
		document.body.classList.add("dragging");
		updateDragPreview(event.clientX, event.clientY);
	}

	function onPointerUp(event) {
		if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
		const drag = pointerDrag;
		pointerDrag = null;
		document.body.classList.remove("dragging");
		clearPreview();
		if (!drag.dragging) {
			liftPiece(drag.index, event.clientX, event.clientY);
			const moveHandler = (moveEvent) => updateLiftedGhost(moveEvent.clientX, moveEvent.clientY);
			const upHandler = (upEvent) => {
				updateLiftedGhost(upEvent.clientX, upEvent.clientY);
				suppressBoardClick = true;
				window.setTimeout(() => { suppressBoardClick = false; }, 300);
				dropLiftedPiece();
				window.removeEventListener("pointermove", moveHandler);
				window.removeEventListener("pointerup", upHandler);
			};
			window.addEventListener("pointermove", moveHandler);
			window.addEventListener("pointerup", upHandler);
			return;
		}
		suppressBoardClick = true;
		window.setTimeout(() => { suppressBoardClick = false; }, 300);
		if (drag.overBoard) placePiece(drag.index, drag.originRow, drag.originCol);
	}

	function onBoardClick(event) {
		if (suppressBoardClick) return;
		if (locked) return;
		const cell = event.target.closest(".board-cell");
		if (!cell) return;
		const row = Number(cell.dataset.row);
		const col = Number(cell.dataset.col);
		if (selectedIndex < 0) return;
		const piece = pieces[selectedIndex];
		if (piece && !piece.used) placePiece(selectedIndex, row, col);
	}

	function registerServiceWorker() {
		if (!("serviceWorker" in navigator)) return;
		window.addEventListener("load", () => {
			navigator.serviceWorker.register("./service-worker.js")
				.catch((error) => console.warn("Не удалось включить офлайн-режим.", error));
		});
	}

	createBoardCells();
	loadSavedSettings();
	startNewGame();
	rackElement.addEventListener("pointerdown", onPiecePointerDown);
	boardElement.addEventListener("click", onBoardClick);
	window.addEventListener("pointermove", onPointerMove, { passive: false });
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerUp);
	document.querySelector("#new-game").addEventListener("click", startNewGame);
	document.querySelector("#overlay-restart").addEventListener("click", startNewGame);
	soundButton.addEventListener("click", () => {
		soundEnabled = !soundEnabled;
		soundButton.setAttribute("aria-pressed", String(soundEnabled));
		soundButton.setAttribute("aria-label", soundEnabled ? "Выключить звук" : "Включить звук");
		saveSettings();
		if (soundEnabled) playTone(620);
	});

	buildPaletteMenu();
	paletteButton?.addEventListener("click", () => {
		if (paletteMenu) paletteMenu.classList.toggle("visible");
	});
	document.querySelector("#achievements-open")?.addEventListener("click", () => {
		renderAchievementsList();
		achievementsModal.classList.add("visible");
		achievementsModal.setAttribute("aria-hidden", "false");
	});
	document.querySelector("#achievements-close")?.addEventListener("click", () => {
		achievementsModal.classList.remove("visible");
		achievementsModal.setAttribute("aria-hidden", "true");
	});
	achievementsModal?.addEventListener("click", (event) => {
		if (event.target === achievementsModal) {
			achievementsModal.classList.remove("visible");
			achievementsModal.setAttribute("aria-hidden", "true");
		}
	});

	registerServiceWorker();
})();
