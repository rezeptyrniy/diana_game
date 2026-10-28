"use strict";

(() => {
  const SIZE = 10;
  const STORAGE_KEY = "luma-blocks-save-v1";
  const SCORE_CONFIG = Object.freeze({
    pointsPerBlock: 10,
    lineBase: 100,
    extraLineMultiplier: 0.5,
    comboBonus: 150
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
  const undoButton = document.querySelector("#undo");
  const overlayElement = document.querySelector("#board-overlay");
  const boardFrameElement = document.querySelector(".board-frame");
  const toastElement = document.querySelector("#toast");
  const turnHintElement = document.querySelector("#turn-hint");
  const cells = [];
  const particlesLayer = document.querySelector("#particles-layer");
  const paletteButton = document.querySelector("#palette-toggle");
  const achievementsModal = document.querySelector("#achievements-modal");
  const achievementsList = document.querySelector("#achievements-list");
  const achievementToasts = document.querySelector("#achievement-toasts");

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
  let shakeTimer = 0;
  let savedData = null;
  let lastSnapshot = null;

  function createEmptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function loadSavedSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      savedData = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : null;
      const settings = savedData || {};
      best = Number.isFinite(settings.best) && settings.best >= 0 ? settings.best : 0;
      soundEnabled = settings.sound === true;
      gamesPlayed = Number.isInteger(settings.gamesPlayed) && settings.gamesPlayed >= 0 ? settings.gamesPlayed : 0;
      if (typeof settings.palette === "string" && PALETTES[settings.palette]) {
        paletteName = settings.palette;
        COLORS = PALETTES[paletteName].slice();
      }
      if (Array.isArray(settings.achievements)) {
        unlockedAchievements = settings.achievements.filter((id) => ACHIEVEMENTS.some((a) => a.id === id));
      }
    } catch (error) {
      savedData = null;
      console.warn("Не удалось прочитать сохранённые данные игры.", error);
    }
    bestElement.textContent = String(best);
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    soundButton.setAttribute("aria-label", soundEnabled ? "Выключить звук" : "Включить звук");
  }

  function loadSavedGame() {
    if (!savedData || !Array.isArray(savedData.board) || savedData.board.length !== SIZE
      || !savedData.board.every((row) => Array.isArray(row) && row.length === SIZE
        && row.every((cell) => cell === null || COLORS.includes(cell)))
      || !Array.isArray(savedData.pieces) || savedData.pieces.length !== 3
      || !savedData.pieces.every((piece) => piece && typeof piece === "object"
        && Array.isArray(piece.shape)
        && SHAPES.some((shape) => JSON.stringify(shape) === JSON.stringify(piece.shape))
        && COLORS.includes(piece.color)
        && typeof piece.used === "boolean")
      || !Number.isSafeInteger(savedData.score) || savedData.score < 0) {
      return false;
    }

    board = savedData.board.map((row) => row.slice());
    pieces = savedData.pieces.map((piece) => ({
      shape: piece.shape.map(([row, col]) => [row, col]),
      color: piece.color,
      used: piece.used
    }));
    score = savedData.score;
    selectedIndex = -1;
    lastSnapshot = null;
    renderBoard();
    renderPieces();
    updateUndoButton();
    if (pieces.every((piece) => piece.used)) {
      generatePieces();
    } else if (!hasAvailableMove()) {
      endGame();
    }
    return true;
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        best,
        sound: soundEnabled,
        gamesPlayed,
        palette: paletteName,
        achievements: unlockedAchievements,
        board,
        pieces,
        score
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
    lastSnapshot = null;
    renderPieces();
    updateUndoButton();
    saveSettings();
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

  function updateUndoButton() {
    undoButton.disabled = !lastSnapshot || locked;
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

  // Validate every block before mutating the board, keeping failed drops atomic.
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
    // Convert viewport coordinates to a board cell without relying on pointer targets.
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
    // Find complete lines from the same post-placement board, then clear their union.
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

  function addPoints(points, lineCount) {
    score += points;
    if (score > best) best = score;
    if (lineCount >= 2) {
      const combo = lineCount >= 4 ? "Мега!" : lineCount === 3 ? "Тройное!" : "Двойное!";
      showToast(`${combo}\n+${points}`);
    } else if (lineCount === 1) {
      showToast(`+${points}`);
    }
    updateScoreDisplay();
    saveSettings();
  }

  // ===== Палитра =====
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

  // ===== Достижения =====
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

  function spawnParticles(cellIndices) {
    if (!particlesLayer) return;

    cellIndices.forEach((cellIndex) => {
      const row = Math.floor(cellIndex / SIZE);
      const col = cellIndex % SIZE;
      const color = board[row][col];
      const cellRect = cells[cellIndex].getBoundingClientRect();
      const layerRect = particlesLayer.getBoundingClientRect();
      const left = cellRect.left + cellRect.width / 2 - layerRect.left;
      const top = cellRect.top + cellRect.height / 2 - layerRect.top;

      for (let index = 0; index < 4; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 40;
        const particle = document.createElement("span");
        particle.className = "particle";
        particle.style.background = color;
        particle.style.left = `${left}px`;
        particle.style.top = `${top}px`;
        particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        particle.style.animationDelay = `${Math.random() * 60}ms`;
        particlesLayer.append(particle);
        window.setTimeout(() => particle.remove(), 700);
      }
    });
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
    // A successful drop is committed once; invalid drops leave score and board untouched.
    if (locked || !pieces[index] || pieces[index].used) return false;
    const piece = pieces[index];
    if (!canPlace(piece.shape, originRow, originCol)) {
      showPreview(originRow, originCol, piece);
      window.setTimeout(clearPreview, 260);
      window.clearTimeout(shakeTimer);
      boardFrameElement.classList.remove("shake");
      void boardFrameElement.offsetWidth;
      boardFrameElement.classList.add("shake");
      shakeTimer = window.setTimeout(() => boardFrameElement.classList.remove("shake"), 400);
      playTone(180, 0.12);
      return false;
    }

    lastSnapshot = JSON.parse(JSON.stringify({ board, pieces, score }));
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
        * (1 + SCORE_CONFIG.extraLineMultiplier * (clears.lineCount - 1)))
        + (clears.lineCount >= 2 ? SCORE_CONFIG.comboBonus * (clears.lineCount - 1) : 0);
    addPoints(placedPoints + bonus, clears.lineCount);
    playTone(clears.lineCount > 0 ? 740 : 480, clears.lineCount > 0 ? 0.16 : 0.08);

    if (clears.clearSet.size > 0) {
      locked = true;
      spawnParticles([...clears.clearSet]);
      updateUndoButton();
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
    saveSettings();
    return true;
  }

  function finishPlacement() {
    locked = false;
    if (pieces.every((piece) => piece.used)) {
      generatePieces();
    } else {
      renderPieces();
    }
    updateUndoButton();
    turnHintElement.textContent = "Перетащите на поле или выберите и коснитесь клетки";
    saveSettings();
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
    sessionLineCount = 0;
    sessionComboCount = 0;
    pointerDrag = null;
    selectedIndex = -1;
    lastSnapshot = null;
    gamesPlayed += 1;
    overlayElement.classList.remove("visible");
    overlayElement.setAttribute("aria-hidden", "true");
    clearPreview();
    renderBoard();
    generatePieces();
    turnHintElement.textContent = "Перетащите на поле или выберите и коснитесь клетки";
    saveSettings();
    checkAchievements({ isNewGame: true, isNight: new Date().getHours() < 5 || new Date().getHours() >= 23 });
    renderAchievementsList();
  }

  function createDragGhost(button, piece, anchorRow, anchorCol, clientX, clientY) {
    const sourceShape = button.querySelector(".piece-shape");
    const anchorCell = sourceShape.querySelector(
      `.piece-cell[data-row="${anchorRow}"][data-col="${anchorCol}"]`
    );
    const shapeRect = sourceShape.getBoundingClientRect();
    const cellRect = anchorCell.getBoundingClientRect();
    const offsetX = cellRect.left + cellRect.width / 2 - (shapeRect.left + shapeRect.width / 2);
    const offsetY = cellRect.top + cellRect.height / 2 - (shapeRect.top + shapeRect.height / 2);
    const ghost = sourceShape.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.setProperty("--piece-color", piece.color);
    ghost.style.position = "fixed";
    ghost.style.left = `${clientX - offsetX}px`;
    ghost.style.top = `${clientY - offsetY}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.opacity = "0.9";
    ghost.style.transform = "translate(-50%, -50%)";
    ghost.style.willChange = "left, top";
    ghost.style.transition = "none";
    document.body.append(ghost);
    return { element: ghost, offsetX, offsetY };
  }

  function removeDragGhost(drag) {
    if (drag.ghost && drag.ghost.element.isConnected) drag.ghost.element.remove();
    if (drag.sourceSlot) drag.sourceSlot.classList.remove("dragging-src");
  }

  function onPiecePointerDown(event) {
    const button = event.target.closest(".piece-button");
    if (!button || event.button !== 0 || locked) return;
    const index = Number(button.dataset.index);
    const piece = pieces[index];
    if (!piece || piece.used) return;
    event.preventDefault();
    const block = event.target.closest(".piece-cell:not(.empty)");
    const sourceShape = button.querySelector(".piece-shape");
    const anchorBlock = block || sourceShape.querySelector(".piece-cell:not(.empty)");
    const anchorRow = Number(anchorBlock.dataset.row);
    const anchorCol = Number(anchorBlock.dataset.col);
    const sourceSlot = button.closest(".piece-slot");
    const ghost = createDragGhost(button, piece, anchorRow, anchorCol, event.clientX, event.clientY);
    pointerDrag = {
      pointerId: event.pointerId,
      index,
      startX: event.clientX,
      startY: event.clientY,
      anchorRow,
      anchorCol,
      dragging: false,
      overBoard: false,
      originRow: 0,
      originCol: 0,
      ghost,
      sourceSlot
    };
    sourceSlot.classList.add("dragging-src");
    selectPiece(index);
  }

  function onPointerMove(event) {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
    pointerDrag.ghost.element.style.left = `${event.clientX - pointerDrag.ghost.offsetX}px`;
    pointerDrag.ghost.element.style.top = `${event.clientY - pointerDrag.ghost.offsetY}px`;
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
    removeDragGhost(drag);
    clearPreview();
    if (drag.dragging) {
      suppressBoardClick = true;
      window.setTimeout(() => { suppressBoardClick = false; }, 300);
      if (drag.overBoard) placePiece(drag.index, drag.originRow, drag.originCol);
    }
  }

  function onPointerCancel(event) {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
    const drag = pointerDrag;
    pointerDrag = null;
    document.body.classList.remove("dragging");
    removeDragGhost(drag);
    clearPreview();
  }

  function undoPlacement() {
    if (!lastSnapshot || locked) return;
    board = lastSnapshot.board;
    pieces = lastSnapshot.pieces;
    score = lastSnapshot.score;
    lastSnapshot = null;
    selectedIndex = -1;
    overlayElement.classList.remove("visible");
    overlayElement.setAttribute("aria-hidden", "true");
    clearPreview();
    renderBoard();
    renderPieces();
    updateUndoButton();
    turnHintElement.textContent = "Перетащите на поле или выберите и коснитесь клетки";
    saveSettings();
  }

  function onBoardClick(event) {
    if (suppressBoardClick) return;
    if (locked || selectedIndex < 0) return;
    const cell = event.target.closest(".board-cell");
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
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
  if (!loadSavedGame()) startNewGame();
  rackElement.addEventListener("pointerdown", onPiecePointerDown);
  boardElement.addEventListener("click", onBoardClick);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  document.querySelector("#new-game").addEventListener("click", startNewGame);
  undoButton.addEventListener("click", undoPlacement);
  document.querySelector("#overlay-restart").addEventListener("click", startNewGame);
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
  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    soundButton.setAttribute("aria-label", soundEnabled ? "Выключить звук" : "Включить звук");
    saveSettings();
    if (soundEnabled) playTone(620);
  });
  registerServiceWorker();
})();
