import * as GameConstants from "./constants";
import { DetectedNote } from "../pitch-detector";

interface Block {
  id: number;
  noteName: string;
  yPos: number;
  xPos: number;
  columnIndex: number;
  element: HTMLDivElement;
}
interface MismatchInfo {
  noteName: string;
  startTime: number;
}

function getElement<T extends HTMLElement>(
  id: string,
  typeName: string
): T | null {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(
      `GameController Warning: Could not find ${typeName} element with ID: ${id}`
    );
    return null;
  }
  if (!(el instanceof HTMLElement)) {
    console.warn(`GameController Warning: Element ${id} not HTMLElement.`);
    return null;
  }
  return el as T;
}

export class GameController {
  private gameAreaElement: HTMLElement | null;
  private gameStatusElement: HTMLElement | null;
  private penaltyBarElement: HTMLElement | null;
  private levelDisplayElement: HTMLElement | null;
  private levelProgressBarElement: HTMLProgressElement | null;
  private noteDisplayElement: HTMLElement | null;
  private noteCountDisplayElement: HTMLElement | null;
  private newGameButton: HTMLButtonElement | null;
  private pauseGameButton: HTMLButtonElement | null;
  private levelFlashOverlay: HTMLElement | null;
  private levelFlashText: HTMLElement | null;
  private pauseOverlay: HTMLElement | null;
  private newGameOverlay: HTMLElement | null;

  private activeBlocks: Block[] = [];
  private gameLoopId: number | null = null;
  private addBlockTimerId: number | null = null;
  private nextBlockId = 0;
  private isGameOver = true; // Start in game over state
  private isPaused = false;
  private penaltyValue = 0;
  private lastActionTimestamp = 0;
  private lastCorrectNoteTimestamp = 0;
  private mismatchedNoteInfo: MismatchInfo | null = null;
  private currentLevel: number = 1;
  private notesClearedThisLevel: number = 0;
  private totalNotesCleared: number = 0; // Score
  private currentFallSpeedMultiplier: number = 1.0;
  private isSpawningCluster: boolean = false;
  private lowestBlockIds: Set<number> = new Set();

  constructor() {
    this.gameAreaElement = getElement<HTMLElement>("gameArea", "Game Area");
    this.gameStatusElement = getElement<HTMLElement>(
      "gameStatus",
      "Game Status Display"
    );
    this.penaltyBarElement = getElement<HTMLElement>(
      "penaltyBar",
      "Penalty Bar"
    );
    this.levelDisplayElement = getElement<HTMLElement>(
      "levelDisplay",
      "Level Display"
    );
    this.levelProgressBarElement = getElement<HTMLProgressElement>(
      "levelProgress",
      "Level Progress Bar"
    );
    this.noteDisplayElement = getElement<HTMLElement>(
      "noteDisplayNote",
      "Detected Note Display"
    );
    this.noteCountDisplayElement = getElement<HTMLElement>(
      "noteCountDisplay",
      "Note Count Display"
    );
    this.newGameButton = getElement<HTMLButtonElement>(
      "newGameButton",
      "New Game Button"
    );
    this.pauseGameButton = getElement<HTMLButtonElement>(
      "pauseGameButton",
      "Pause Button"
    );
    this.levelFlashOverlay = getElement<HTMLElement>(
      "levelFlashOverlay",
      "Level Flash Overlay"
    );
    this.levelFlashText = getElement<HTMLElement>(
      "levelFlashText",
      "Level Flash Text"
    );
    this.pauseOverlay = getElement<HTMLElement>(
      "pauseOverlay",
      "Pause Overlay"
    );
    this.newGameOverlay = getElement<HTMLElement>(
      "newGameOverlay",
      "New Game Overlay"
    );

    if (
      !this.gameAreaElement ||
      !this.pauseGameButton ||
      !this.noteCountDisplayElement ||
      !this.pauseOverlay ||
      !this.newGameOverlay ||
      !this.newGameButton
    ) {
      throw new Error(
        "GameController Error: Essential game elements not found in the DOM."
      );
    }
    this.setupEventListeners();
    this.resetGameUI(); // Set initial state (shows "New Game" overlay)
  }

  private setupEventListeners(): void {
    this.newGameButton?.addEventListener("click", () => this.triggerStart());
    this.pauseGameButton?.addEventListener("click", () => this.triggerPause());
  }

  private resetGameVariables(): void {
    this.clearTimersAndIntervals();
    this.activeBlocks = [];
    this.lowestBlockIds.clear();
    this.nextBlockId = 0;
    this.isGameOver = true;
    this.isPaused = false;
    this.penaltyValue = 0;
    this.lastActionTimestamp = 0;
    this.lastCorrectNoteTimestamp = 0;
    this.mismatchedNoteInfo = null;
    this.currentLevel = 1;
    this.notesClearedThisLevel = 0;
    this.totalNotesCleared = 0;
    this.currentFallSpeedMultiplier = 1.0;
    this.isSpawningCluster = false;
  }

  private resetGameUI(): void {
    if (this.gameAreaElement) this.gameAreaElement.innerHTML = "";
    this.drawHelperLines();
    this.updatePenaltyBar();
    this.updateLevelDisplay();
    this.updateLevelProgressDisplay();
    this.updateNoteCountDisplay();
    if (this.noteDisplayElement) this.noteDisplayElement.textContent = "--";
    this.updateGameStatus("Press New Game");
    this.pauseOverlay?.classList.remove("visible");
    this.newGameOverlay?.classList.add("visible");
    this.updateButtonStates();
  }

  public triggerStart(): void {
    if (
      !this.isGameOver ||
      this.gameLoopId !== null ||
      this.addBlockTimerId !== null
    )
      return;
    if (!this.gameAreaElement) return;
    console.log("Starting Chromatic Cascade...");
    this.resetGameVariables();
    this.isGameOver = false;
    this.currentFallSpeedMultiplier = GameConstants.INITIAL_SPEED_MULTIPLIER;
    this.gameAreaElement.innerHTML = "";
    this.drawHelperLines();
    this.updatePenaltyBar();
    this.updateLevelDisplay();
    this.updateLevelProgressDisplay();
    this.updateNoteCountDisplay();
    this.updateGameStatus(`Level ${this.currentLevel}`);
    this.newGameOverlay?.classList.remove("visible");
    this.pauseOverlay?.classList.remove("visible");
    const now = performance.now();
    this.lastActionTimestamp = now;
    this.lastCorrectNoteTimestamp = now;
    this.gameLoopId = window.setInterval(
      () => this.gameLoop(),
      GameConstants.GAME_LOOP_INTERVAL
    );
    this.spawnSingleNote();
    this.scheduleNextBlockAttempt();
    this.updateButtonStates();
  }

  public triggerPause(): void {
    if (this.isGameOver) return;
    this.isPaused = !this.isPaused;
    this.mismatchedNoteInfo = null;
    if (this.isPaused) {
      console.log("Game Paused");
      if (this.gameLoopId) clearInterval(this.gameLoopId);
      if (this.addBlockTimerId) clearTimeout(this.addBlockTimerId);
      this.gameLoopId = null;
      this.addBlockTimerId = null;
      this.isSpawningCluster = false;
      this.updateLowestBlockHighlight([]);
      this.pauseOverlay?.classList.add("visible");
      this.updateGameStatus("Paused");
    } else {
      console.log("Game Resumed");
      this.pauseOverlay?.classList.remove("visible");
      const now = performance.now();
      this.lastActionTimestamp = now;
      this.lastCorrectNoteTimestamp = now;

      this.gameLoopId = window.setInterval(
        () => this.gameLoop(),
        GameConstants.GAME_LOOP_INTERVAL
      );
      this.scheduleNextBlockAttempt();
      this.updateGameStatus(`Level ${this.currentLevel}`);
    }
    this.updateButtonStates();
  }

  public onNoteUpdate(note: DetectedNote | null, rms: number): void {
    if (this.noteDisplayElement) {
      const n =
        rms >= GameConstants.NOTE_DISPLAY_AMPLITUDE_THRESHOLD && note?.name
          ? note.name
          : "--";
      if (this.noteDisplayElement.textContent !== n)
        this.noteDisplayElement.textContent = n;
    }
    if (this.gameLoopId !== null && !this.isPaused && !this.isGameOver) {
      this.handleNoteDetectionInternal(note?.name ?? null, rms);
    }
  }

  private clearTimersAndIntervals(): void {
    if (this.gameLoopId) clearInterval(this.gameLoopId);
    if (this.addBlockTimerId) clearTimeout(this.addBlockTimerId);
    this.gameLoopId = null;
    this.addBlockTimerId = null;
  }
  private clearBlockTimeout(block: Block): void {
    if (block.element?.dataset.removeTimerId) {
      clearTimeout(parseInt(block.element.dataset.removeTimerId, 10));
      delete block.element.dataset.removeTimerId;
    }
  }

  private scheduleNextBlockAttempt(): void {
    if (this.isPaused || this.isGameOver || this.addBlockTimerId !== null)
      return;
    const baseInterval =
      GameConstants.BASE_ADD_BLOCK_INTERVAL / this.currentFallSpeedMultiplier;
    const randomness = baseInterval * GameConstants.INTERVAL_RANDOMNESS_FACTOR;
    let randomInterval = baseInterval + (Math.random() * 2 - 1) * randomness;
    randomInterval = Math.max(
      GameConstants.MIN_ADD_BLOCK_INTERVAL_MS,
      randomInterval
    );
    randomInterval = Math.min(
      GameConstants.MAX_ADD_BLOCK_INTERVAL_MS,
      randomInterval
    );
    this.addBlockTimerId = window.setTimeout(() => {
      this.addBlockTimerId = null;
      this.attemptBlockGeneration();
    }, randomInterval);
  }
  private async attemptBlockGeneration(): Promise<void> {
    if (this.isPaused || this.isGameOver) return;
    if (
      !this.isSpawningCluster &&
      Math.random() < GameConstants.SKIP_SPAWN_CHANCE
    ) {
      this.scheduleNextBlockAttempt();
      return;
    }
    if (
      !this.isSpawningCluster &&
      Math.random() < GameConstants.CLUSTER_CHANCE
    ) {
      await this.spawnCluster();
    } else if (!this.isSpawningCluster) {
      this.spawnSingleNote();
      this.scheduleNextBlockAttempt();
    }
  }

  private async spawnCluster(): Promise<void> {
    if (this.isSpawningCluster || this.isPaused || this.isGameOver) return;
    this.isSpawningCluster = true;
    const numNotes =
      Math.floor(Math.random() * (GameConstants.CLUSTER_MAX_NOTES - 1)) + 2;
    let interrupted = false;
    for (let i = 0; i < numNotes; i++) {
      if (this.isPaused || this.isGameOver) {
        interrupted = true;
        break;
      }
      this.spawnSingleNote();
      if (i < numNotes - 1) {
        try {
          await new Promise((res, rej) => {
            const t = setTimeout(
              () => res(void 0),
              GameConstants.CLUSTER_INTERVAL
            );
            const c = setInterval(() => {
              if (this.isPaused || this.isGameOver) {
                clearInterval(c);
                clearTimeout(t);
                rej(new Error("Interrupted"));
              }
            }, 30);
            setTimeout(
              () => clearInterval(c),
              GameConstants.CLUSTER_INTERVAL + 10
            );
          });
        } catch (e) {
          interrupted = true;
          break;
        }
      }
    }
    this.isSpawningCluster = false;
    if (!interrupted && !this.isPaused && !this.isGameOver) {
      this.scheduleNextBlockAttempt();
    }
  }

  private spawnSingleNote(): void {
    if (this.isPaused || this.isGameOver || !this.gameAreaElement) return;
    const lowestBlocks = this.findLowestBlocks();
    const lowestNotes = lowestBlocks
      .filter((b) => b !== null)
      .map((b) => b!.noteName);
    const occupiedColumns = this.activeBlocks
      .filter((b) => b.yPos < GameConstants.BLOCK_HEIGHT * 1.5)
      .map((b) => b.columnIndex);
    let randomNote: string;
    let attempts = 0;
    const maxAttempts = GameConstants.CHROMATIC_NOTES.length * 2;
    do {
      randomNote = this.getRandomNote();
      attempts++;
      if (attempts > maxAttempts) break;
    } while (lowestNotes.includes(randomNote));
    let randomColumn: number;
    let columnAttempts = 0;
    const maxColumnAttempts = GameConstants.NUM_COLUMNS * 2;
    do {
      randomColumn = Math.floor(Math.random() * GameConstants.NUM_COLUMNS);
      columnAttempts++;
      if (columnAttempts > maxColumnAttempts) break;
    } while (occupiedColumns.includes(randomColumn));
    if (columnAttempts > maxColumnAttempts) {
      console.warn("Could not find free column, skipping spawn.");
      return;
    }
    this.addBlock(randomNote, randomColumn);
  }
  private drawHelperLines(): void {
    if (!this.gameAreaElement) return;
    const overlaysToPreserve = {
      pause: this.pauseOverlay,
      levelFlash: this.levelFlashOverlay,
      newGame: this.newGameOverlay,
    };
    // Clear only game elements, not overlays if they exist
    this.gameAreaElement
      .querySelectorAll(".game-block, .column-line, .end-line")
      .forEach((el) => el.remove());
    // Draw lines
    for (let i = 0; i < GameConstants.NUM_COLUMNS; i++) {
      const l = document.createElement("div");
      l.className = "column-line";
      l.style.left = `${
        i * GameConstants.COLUMN_WIDTH + GameConstants.COLUMN_WIDTH / 2 - 0.5
      }px`;
      this.gameAreaElement.appendChild(l);
    }
    const endLine = document.createElement("div");
    endLine.className = "end-line";
    this.gameAreaElement.appendChild(endLine);
    // Ensure overlays are present
    if (
      overlaysToPreserve.pause &&
      !this.gameAreaElement.contains(overlaysToPreserve.pause)
    )
      this.gameAreaElement.appendChild(overlaysToPreserve.pause);
    if (
      overlaysToPreserve.levelFlash &&
      !this.gameAreaElement.contains(overlaysToPreserve.levelFlash)
    )
      this.gameAreaElement.appendChild(overlaysToPreserve.levelFlash);
    if (
      overlaysToPreserve.newGame &&
      !this.gameAreaElement.contains(overlaysToPreserve.newGame)
    )
      this.gameAreaElement.appendChild(overlaysToPreserve.newGame);
  }
  private getRandomNote(): string {
    const i = Math.floor(Math.random() * GameConstants.CHROMATIC_NOTES.length);
    return GameConstants.CHROMATIC_NOTES[i];
  }
  private addBlock(noteName: string, columnIndex: number): void {
    // Simplified signature
    if (this.isPaused || this.isGameOver || !this.gameAreaElement) return;
    columnIndex = Math.max(
      0,
      Math.min(columnIndex, GameConstants.NUM_COLUMNS - 1)
    );
    const blockElement = document.createElement("div");
    blockElement.className = "game-block";
    blockElement.textContent = noteName;
    blockElement.dataset.note = noteName.replace("#", "s");
    blockElement.style.width = `${GameConstants.BLOCK_WIDTH}px`;
    blockElement.style.height = `${GameConstants.BLOCK_HEIGHT}px`;
    const columnStart = columnIndex * GameConstants.COLUMN_WIDTH;
    const blockX =
      columnStart +
      (GameConstants.COLUMN_WIDTH - GameConstants.BLOCK_WIDTH) / 2;
    blockElement.style.left = `${blockX}px`;
    blockElement.style.top = "0px";
    this.gameAreaElement.appendChild(blockElement);
    const newBlock: Block = {
      id: this.nextBlockId++,
      noteName,
      yPos: 0,
      xPos: blockX,
      columnIndex,
      element: blockElement,
    };
    this.activeBlocks.push(newBlock);
  }

  private gameLoop(): void {
    if (this.isPaused || this.isGameOver || !this.gameAreaElement) return;
    const gameAreaHeight = this.gameAreaElement.clientHeight;
    const currentFallSpeed =
      GameConstants.BASE_BLOCK_FALL_SPEED * this.currentFallSpeedMultiplier;
    let lowestBlocksForHighlight: (Block | null)[] = Array(
      GameConstants.NUM_COLUMNS
    ).fill(null);
    const blocksToRemoveFromArray: number[] = [];
    for (const block of this.activeBlocks) {
      if (block.element?.classList.contains("cleared")) continue;
      if (!block.element || !block.element.parentNode) {
        blocksToRemoveFromArray.push(block.id);
        continue;
      }
      block.yPos += currentFallSpeed;
      block.element.style.top = `${block.yPos}px`;
      if (block.yPos + GameConstants.BLOCK_HEIGHT >= gameAreaHeight) {
        if (!this.isGameOver) this.handleGameOver();
        return;
      }
      const colIdx = block.columnIndex;
      if (
        !lowestBlocksForHighlight[colIdx] ||
        block.yPos > lowestBlocksForHighlight[colIdx]!.yPos
      )
        lowestBlocksForHighlight[colIdx] = block;
    }
    if (blocksToRemoveFromArray.length > 0)
      this.activeBlocks = this.activeBlocks.filter(
        (b) => !blocksToRemoveFromArray.includes(b.id)
      );
    this.updateLowestBlockHighlight(
      lowestBlocksForHighlight.filter((b) => b !== null) as Block[]
    );
  }
  private updateLowestBlockHighlight(currentLowestBlocks: Block[]): void {
    const newLowestIds = new Set(currentLowestBlocks.map((b) => b.id));
    const idsToRemoveHighlight = [...this.lowestBlockIds].filter(
      (id) => !newLowestIds.has(id)
    );
    for (const blockId of idsToRemoveHighlight)
      this.activeBlocks
        .find((b) => b.id === blockId)
        ?.element?.classList.remove("lowest-note");
    for (const block of currentLowestBlocks)
      if (block.element && !block.element.classList.contains("cleared"))
        block.element.classList.add("lowest-note");
    this.lowestBlockIds = newLowestIds;
  }
  private handleGameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isPaused = false;
    this.clearTimersAndIntervals();
    this.activeBlocks.forEach((block) => this.clearBlockTimeout(block));
    this.isSpawningCluster = false;
    this.updateLowestBlockHighlight([]);
    this.updateGameStatus(`Game Over! Score: ${this.totalNotesCleared}`);
    this.newGameOverlay?.classList.add("visible");
    this.updateButtonStates();
  }
  private findLowestBlocks(): (Block | null)[] {
    const lowest: (Block | null)[] = Array(GameConstants.NUM_COLUMNS).fill(
      null
    );
    const activeFallingBlocks = this.activeBlocks.filter(
      (b) => b.element && !b.element.classList.contains("cleared")
    );
    for (const block of activeFallingBlocks) {
      const colIdx = block.columnIndex;
      if (!lowest[colIdx] || block.yPos > lowest[colIdx]!.yPos)
        lowest[colIdx] = block;
    }
    return lowest;
  }
  private removeBlockElement(blockToRemove: Block): void {
    if (!blockToRemove) return;
    if (this.lowestBlockIds.has(blockToRemove.id)) {
      blockToRemove.element?.classList.remove("lowest-note");
      this.lowestBlockIds.delete(blockToRemove.id);
    }
    this.clearBlockTimeout(blockToRemove);
    if (
      this.gameAreaElement &&
      blockToRemove.element?.parentNode === this.gameAreaElement
    ) {
      try {
        this.gameAreaElement.removeChild(blockToRemove.element);
      } catch (e) {
        /* Ignore */
      }
    }
    this.activeBlocks = this.activeBlocks.filter(
      (b) => b.id !== blockToRemove.id
    );
  }

  private handleNoteDetectionInternal(
    detectedNoteName: string | null,
    rmsValue: number
  ): void {
    if (this.isPaused || this.isGameOver || this.activeBlocks.length === 0) {
      if (detectedNoteName === null) this.mismatchedNoteInfo = null;
      return;
    }
    const currentTime = performance.now();
    if (
      currentTime - this.lastActionTimestamp <
      GameConstants.ACTION_COOLDOWN_MS
    )
      return;
    if (detectedNoteName === null) {
      if (this.mismatchedNoteInfo) this.mismatchedNoteInfo = null;
      return;
    }
    const lowestBlocks = this.findLowestBlocks();
    let targetBlock: Block | null = null;
    for (const lowestBlock of lowestBlocks)
      if (lowestBlock && lowestBlock.noteName === detectedNoteName) {
        targetBlock = lowestBlock;
        break;
      }
    if (targetBlock) {
      if (rmsValue >= GameConstants.MIN_CLEAR_AMPLITUDE) {
        this.mismatchedNoteInfo = null;
        this.lastActionTimestamp = currentTime;
        this.lastCorrectNoteTimestamp = currentTime;
        this.clearBlock(targetBlock);
      }
    } else {
      if (
        currentTime - this.lastCorrectNoteTimestamp <=
        GameConstants.CORRECT_NOTE_GRACE_PERIOD_MS
      ) {
        this.mismatchedNoteInfo = null;
        return;
      }
      if (rmsValue >= GameConstants.MIN_PENALTY_AMPLITUDE) {
        if (this.mismatchedNoteInfo?.noteName === detectedNoteName) {
          const d = currentTime - this.mismatchedNoteInfo.startTime;
          if (d >= GameConstants.PENALTY_DELAY_MS) {
            this.applyPenalty();
            this.mismatchedNoteInfo = null;
          }
        } else {
          this.mismatchedNoteInfo = {
            noteName: detectedNoteName,
            startTime: currentTime,
          };
        }
      } else {
        if (this.mismatchedNoteInfo) this.mismatchedNoteInfo = null;
      }
    }
  }
  private clearBlock(blockToClear: Block): void {
    // Simplified
    if (!blockToClear.element) {
      this.activeBlocks = this.activeBlocks.filter(
        (b) => b.id !== blockToClear.id
      );
      return;
    }
    blockToClear.element.classList.remove("lowest-note");
    if (this.lowestBlockIds.has(blockToClear.id))
      this.lowestBlockIds.delete(blockToClear.id);
    blockToClear.element.classList.add("cleared"); // Add clear effect class
    this.totalNotesCleared++;
    this.updateNoteCountDisplay();
    this.notesClearedThisLevel++;
    this.updateLevelProgressDisplay();
    if (this.notesClearedThisLevel >= GameConstants.NOTES_PER_LEVEL)
      this.levelUp();
    const removalDelay = GameConstants.BLOCK_REMOVE_EFFECT_DURATION_MS;
    const timerId = setTimeout(
      () => this.removeBlockElement(blockToClear),
      removalDelay
    );
    blockToClear.element.dataset.removeTimerId = String(timerId);
  }
  private applyPenalty(): void {
    if (this.isPaused || this.isGameOver) return;
    this.penaltyValue += GameConstants.PENALTY_INCREMENT;
    this.lastActionTimestamp = performance.now();
    this.updatePenaltyBar();
    if (this.penaltyValue >= GameConstants.MAX_PENALTY) {
      this.penaltyValue = 0;
      this.updatePenaltyBar();
      for (let i = 0; i < GameConstants.PENALTY_BLOCK_COUNT; i++)
        ((d) => {
          setTimeout(() => {
            if (!this.isPaused && !this.isGameOver) this.spawnSingleNote();
          }, d * 150);
        })(i);
    }
  }
  private levelUp(): void {
    if (this.isPaused || this.isGameOver) return;
    this.currentLevel++;
    this.notesClearedThisLevel = 0;
    this.currentFallSpeedMultiplier *=
      1.0 + GameConstants.FALL_SPEED_INCREASE_FACTOR;
    console.log(
      `LEVEL UP! Level ${
        this.currentLevel
      }. Speed: ${this.currentFallSpeedMultiplier.toFixed(2)}x`
    );
    this.updateLevelDisplay();
    this.updateLevelProgressDisplay();
    this.updateGameStatus(`Level ${this.currentLevel}`);
    if (this.levelFlashOverlay && this.levelFlashText) {
      this.levelFlashText.textContent = `Level ${this.currentLevel}`;
      this.levelFlashOverlay.classList.add("visible");
      setTimeout(
        () => this.levelFlashOverlay?.classList.remove("visible"),
        GameConstants.LEVEL_FLASH_DURATION_MS
      );
    }
  }

  private updatePenaltyBar(): void {
    if (!this.penaltyBarElement) return;
    const p = Math.max(
      0,
      Math.min(this.penaltyValue, GameConstants.MAX_PENALTY)
    );
    this.penaltyBarElement.style.width = `${
      (p / GameConstants.MAX_PENALTY) * 100
    }%`;
  }
  private updateLevelDisplay(): void {
    if (!this.levelDisplayElement) return;
    this.levelDisplayElement.textContent = `${this.currentLevel}`;
  }
  private updateLevelProgressDisplay(): void {
    if (!this.levelProgressBarElement) return;
    const pr =
      GameConstants.NOTES_PER_LEVEL > 0
        ? this.notesClearedThisLevel / GameConstants.NOTES_PER_LEVEL
        : 0;
    this.levelProgressBarElement.value = Math.max(0, Math.min(pr, 1));
  }
  private updateNoteCountDisplay(): void {
    if (!this.noteCountDisplayElement) return;
    this.noteCountDisplayElement.textContent = `${this.totalNotesCleared}`;
  }
  private updateGameStatus(message: string): void {
    if (this.isGameOver || this.isPaused || !this.gameStatusElement) return;
    this.gameStatusElement.textContent = `Status: ${message}`;
  }
  private updateButtonStates(): void {
    const canInteract = !this.isGameOver;
    if (this.pauseGameButton) {
      this.pauseGameButton.disabled = !canInteract;
      this.pauseGameButton.textContent = this.isPaused ? "Resume" : "Pause";
    }
  }
}
