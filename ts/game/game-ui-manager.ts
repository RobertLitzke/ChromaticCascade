// ts/game/game-ui-manager.ts

import { GameEngine, BlockData, GameEngineCallbacks } from "./game-engine";
import { GameConfig } from "./config";

// Type for the callback passed from main.ts
type ReturnToMenuCallback = () => void;

function getElement<T extends HTMLElement>(
  id: string,
  typeName: string
): T | null {
  /* ... no change ... */
  const el = document.getElementById(id);
  if (!el) {
    console.error(
      `UIManager Error: Could not find ${typeName} element with ID: ${id}`
    );
    return null;
  }
  if (!(el instanceof HTMLElement)) {
    console.error(`UIManager Error: Element ${id} is not an HTMLElement.`);
    return null;
  }
  return el as T;
}

export class GameUIManager {
  private engine: GameEngine;
  private config: GameConfig;
  private onReturnToMenu: ReturnToMenuCallback; // Callback to trigger menu view

  // DOM Element References
  private gameAreaElement: HTMLElement | null;
  private gameWrapperElement: HTMLElement | null;
  private gameStatusElement: HTMLElement | null;
  private penaltyBarElement: HTMLElement | null;
  private levelDisplayElement: HTMLElement | null;
  private levelProgressBarElement: HTMLProgressElement | null;
  private noteDisplayElement: HTMLElement | null;
  private noteCountDisplayElement: HTMLElement | null;
  private pauseGameButton: HTMLButtonElement | null;
  private levelFlashOverlay: HTMLElement | null;
  private levelFlashText: HTMLElement | null;
  private pauseOverlay: HTMLElement | null;
  private endGameOverlay: HTMLElement | null; // Added
  private endGameScoreSpan: HTMLElement | null; // Added
  private endGameLevelSpan: HTMLElement | null; // Added
  private restartGameButton: HTMLButtonElement | null; // Added
  private returnToMenuButton: HTMLButtonElement | null; // Added

  private blockElements: Map<number, HTMLDivElement> = new Map();

  // *** MODIFIED Constructor: Added onReturnToMenu callback ***
  constructor(
    engine: GameEngine,
    config: GameConfig,
    onReturnToMenu: ReturnToMenuCallback
  ) {
    this.engine = engine;
    this.config = config;
    this.onReturnToMenu = onReturnToMenu; // Store the callback

    // Get all elements
    this.gameAreaElement = getElement<HTMLElement>("gameArea", "Game Area");
    this.gameWrapperElement = getElement<HTMLElement>(
      "gameWrapper",
      "Game Wrapper"
    );
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
    this.endGameOverlay = getElement<HTMLElement>(
      "endGameOverlay",
      "End Game Overlay"
    ); // Get end overlay
    this.endGameScoreSpan = getElement<HTMLElement>(
      "endGameScore",
      "End Game Score Span"
    ); // Get score span
    this.endGameLevelSpan = getElement<HTMLElement>(
      "endGameLevel",
      "End Game Level Span"
    ); // Get level span
    this.restartGameButton = getElement<HTMLButtonElement>(
      "restartGameButton",
      "Restart Game Button"
    ); // Get restart button
    this.returnToMenuButton = getElement<HTMLButtonElement>(
      "returnToMenuButton",
      "Return To Menu Button"
    ); // Get menu button

    // Check essential elements
    if (
      !this.gameAreaElement ||
      !this.pauseGameButton ||
      !this.gameWrapperElement ||
      !this.endGameOverlay ||
      !this.endGameScoreSpan ||
      !this.endGameLevelSpan ||
      !this.restartGameButton ||
      !this.returnToMenuButton
    ) {
      throw new Error(
        "UIManager Error: Essential UI elements not found (check game elements and end game overlay)."
      );
    }

    this.setupUIEventListeners();
    // Initial UI state is set when game starts via onGameReset callback
  }

  public getEngineCallbacks(): GameEngineCallbacks {
    return {
      onScoreUpdate: (score) => this.updateScoreDisplay(score),
      onLevelUpdate: (level, progress) =>
        this.updateLevelDisplay(level, progress),
      onPenaltyUpdate: (percent) => this.updatePenaltyBar(percent),
      onBlockAdded: (blockData) => this.addBlockElement(blockData),
      onBlockRemoved: (blockId, effectDuration) =>
        this.removeBlockElement(blockId, effectDuration),
      onNoteDetectedUpdate: (noteName) => this.updateNoteDisplay(noteName),
      // *** MODIFIED: Use new callback name ***
      onGameOverStateUpdate: (finalScore, levelReached) =>
        this.handleGameOverUI(finalScore, levelReached),
      onGameReset: () => this.resetUIForNewGame(),
      onGamePause: () => this.handleGamePauseUI(),
      onGameResume: (level) => this.handleGameResumeUI(level),
      onStatusUpdate: (message) => this.updateGameStatus(message),
      onLevelFlash: (level) => this.showLevelFlash(level),
      onLowestBlocksUpdate: (ids) => this.updateLowestBlockHighlight(ids),
      onBlockPositionsUpdate: (blockPositions) =>
        this.updateBlockPositions(blockPositions),
    };
  }

  private setupUIEventListeners(): void {
    this.pauseGameButton?.addEventListener("click", () => {
      const isCurrentlyPaused = this.pauseGameButton?.textContent === "Resume";
      if (isCurrentlyPaused) {
        this.engine.resume();
      } else {
        this.engine.pause();
      }
    });

    // *** ADDED: Listeners for end game overlay buttons ***
    this.restartGameButton?.addEventListener("click", () => {
      console.log("Restart button clicked");
      this.hideEndGameOverlay(); // Hide overlay immediately
      this.engine.start(); // Tell engine to start again (uses stored config)
    });
    this.returnToMenuButton?.addEventListener("click", () => {
      console.log("Return to Menu button clicked");
      this.hideEndGameOverlay(); // Hide overlay
      this.onReturnToMenu(); // Call the callback provided by main.ts
    });
  }

  private resetUIForNewGame(): void {
    console.log("UIManager: resetUIForNewGame called");
    this.hideEndGameOverlay(); // Ensure end game overlay is hidden on new game
    this.resetGameArea();
    this.updatePenaltyBar(0);
    this.updateLevelDisplay(1, 0);
    this.updateScoreDisplay(0);
    this.updateNoteDisplay("--");
    this.showPauseOverlay(false);
    this.showLevelFlash(-1);
    // Button state will be set by onGameResume triggered by engine.start
  }

  private resetGameArea(): void {
    /* ... no change ... */
    if (!this.gameAreaElement) return;
    console.log("UIManager: resetGameArea called");
    this.blockElements.forEach((element) => element.remove());
    this.blockElements.clear();
    this.gameAreaElement
      .querySelectorAll(".game-block, .column-line, .end-line")
      .forEach((el) => el.remove());
    this.drawHelperLines();
    if (this.pauseOverlay && !this.gameAreaElement.contains(this.pauseOverlay))
      this.gameAreaElement.appendChild(this.pauseOverlay);
    if (
      this.levelFlashOverlay &&
      !this.gameAreaElement.contains(this.levelFlashOverlay)
    )
      this.gameAreaElement.appendChild(this.levelFlashOverlay);
    if (
      this.endGameOverlay &&
      !this.gameAreaElement.contains(this.endGameOverlay)
    )
      this.gameAreaElement.appendChild(this.endGameOverlay); // Ensure end overlay is present
    this.showPauseOverlay(false);
    this.showLevelFlash(-1);
    this.hideEndGameOverlay(); // Hide end overlay on reset
  }
  private drawHelperLines(): void {
    /* ... no change ... */
    if (!this.gameAreaElement) return;
    const numColumns = this.config.layout.numColumns;
    const columnWidth = this.config.layout.columnWidth;
    for (let i = 0; i < numColumns; i++) {
      const line = document.createElement("div");
      line.className = "column-line";
      line.style.left = `${i * columnWidth + columnWidth / 2 - 0.5}px`;
      this.gameAreaElement.appendChild(line);
    }
    const endLine = document.createElement("div");
    endLine.className = "end-line";
    this.gameAreaElement.appendChild(endLine);
  }
  private updateScoreDisplay(score: number): void {
    /* ... no change ... */
    if (this.noteCountDisplayElement) {
      this.noteCountDisplayElement.textContent = `${score}`;
    }
  }
  private updateLevelDisplay(level: number, progress: number): void {
    /* ... no change ... */
    if (this.levelDisplayElement) {
      this.levelDisplayElement.textContent = `${level}`;
    }
    if (this.levelProgressBarElement) {
      this.levelProgressBarElement.value = Math.max(0, Math.min(progress, 1));
    }
  }
  private updatePenaltyBar(percent: number): void {
    /* ... no change ... */
    if (this.penaltyBarElement) {
      this.penaltyBarElement.style.width = `${Math.max(
        0,
        Math.min(percent, 100)
      )}%`;
    }
  }
  private updateNoteDisplay(noteName: string | null): void {
    /* ... no change ... */
    if (this.noteDisplayElement) {
      this.noteDisplayElement.textContent = noteName ?? "--";
    }
  }
  private updateGameStatus(message: string): void {
    /* ... no change ... */
    if (this.gameStatusElement) {
      const prefix =
        message.toLowerCase().includes("level ") ||
        message.toLowerCase().includes("paused") ||
        message.toLowerCase().includes("game over")
          ? ""
          : "Status: ";
      this.gameStatusElement.textContent = prefix + message;
    }
  }
  private addBlockElement(blockData: BlockData): void {
    /* ... no change ... */
    if (!this.gameAreaElement) return;
    const blockElement = document.createElement("div");
    blockElement.className = "game-block";
    blockElement.textContent = blockData.noteName;
    blockElement.dataset.note = blockData.noteName.replace("#", "s");
    blockElement.style.width = `${this.config.layout.blockWidth}px`;
    blockElement.style.height = `${this.config.layout.blockHeight}px`;
    blockElement.style.left = `${blockData.xPos}px`;
    blockElement.style.top = `${blockData.yPos}px`;
    blockElement.style.position = "absolute";
    this.gameAreaElement.appendChild(blockElement);
    this.blockElements.set(blockData.id, blockElement);
  }
  public updateBlockPositions(activeBlocksData: BlockData[]): void {
    /* ... no change ... */
    activeBlocksData.forEach((blockData) => {
      const element = this.blockElements.get(blockData.id);
      if (element && !element.classList.contains("cleared")) {
        element.style.top = `${blockData.yPos}px`;
      }
    });
    const activeIds = new Set(activeBlocksData.map((b) => b.id));
    this.blockElements.forEach((element, id) => {
      if (!activeIds.has(id) && !element.classList.contains("cleared")) {
        element.remove();
        this.blockElements.delete(id);
      }
    });
  }
  private removeBlockElement(blockId: number, effectDuration: number): void {
    /* ... no change ... */
    const element = this.blockElements.get(blockId);
    if (element) {
      element.classList.add("cleared");
      element.classList.remove("lowest-note");
      setTimeout(() => {
        element.remove();
        this.blockElements.delete(blockId);
      }, effectDuration);
    }
  }
  private updateLowestBlockHighlight(lowestBlockIds: number[]): void {
    /* ... no change ... */
    const lowestIdSet = new Set(lowestBlockIds);
    this.blockElements.forEach((element, id) => {
      const isLowest = lowestIdSet.has(id);
      const hasClass = element.classList.contains("lowest-note");
      if (isLowest && !hasClass && !element.classList.contains("cleared")) {
        element.classList.add("lowest-note");
      } else if (!isLowest && hasClass) {
        element.classList.remove("lowest-note");
      }
    });
  }

  // Overlay visibility methods
  private showPauseOverlay(show: boolean): void {
    this.pauseOverlay?.classList.toggle("visible", show);
  }
  private hideEndGameOverlay(): void {
    this.endGameOverlay?.classList.remove("visible");
  } // Separate hide method
  private showLevelFlash(level: number): void {
    /* ... no change ... */
    if (this.levelFlashOverlay && this.levelFlashText && level > 0) {
      this.levelFlashText.textContent = `Level ${level}`;
      this.levelFlashOverlay.classList.add("visible");
      setTimeout(() => {
        this.levelFlashOverlay?.classList.remove("visible");
      }, this.config.timing.levelFlashDurationMs);
    } else if (this.levelFlashOverlay && level <= 0) {
      this.levelFlashOverlay.classList.remove("visible");
    }
  }

  // *** MODIFIED: Game Over handler ***
  private handleGameOverUI(finalScore: number, levelReached: number): void {
    console.log("UIManager: handleGameOverUI called");
    // Populate and show end game overlay
    if (this.endGameScoreSpan)
      this.endGameScoreSpan.textContent = `${finalScore}`;
    if (this.endGameLevelSpan)
      this.endGameLevelSpan.textContent = `${levelReached}`;
    this.endGameOverlay?.classList.add("visible"); // Show the overlay

    this.updateButtonStates(false, false); // Game is over -> pause button disabled
    this.updateGameStatus(`Game Over!`); // Update status
  }

  // Pause handler (no change needed for button logic)
  private handleGamePauseUI(): void {
    /* ... no change ... */
    console.log("UIManager: handleGamePauseUI called");
    this.showPauseOverlay(true);
    this.updateButtonStates(true, true); // Game interactive, is paused -> Button enabled, says "Resume"
    this.updateGameStatus("Paused");
  }

  // Resume handler (no change needed for button logic)
  private handleGameResumeUI(level: number): void {
    /* ... no change ... */
    console.log("UIManager: handleGameResumeUI called");
    this.showPauseOverlay(false);
    // Don't hide gameWrapper here, main.ts handles showing it on start
    this.updateButtonStates(true, false); // Game interactive, not paused -> Button enabled, says "Pause"
    this.updateGameStatus(`Level ${level}`);
  }

  // Button state logic (no change needed)
  private updateButtonStates(isInteractive: boolean, isPaused: boolean): void {
    /* ... no change ... */
    if (this.pauseGameButton) {
      this.pauseGameButton.disabled = !isInteractive;
      this.pauseGameButton.textContent = isPaused ? "Resume" : "Pause";
      console.log(
        `UIManager: Updating button states - Disabled: ${!isInteractive}, Text: ${
          isPaused ? "Resume" : "Pause"
        }`
      );
    }
  }

  // Methods for main.ts to control visibility
  public showGame(): void {
    this.gameWrapperElement?.classList.add("visible");
  }
  public hideGame(): void {
    this.gameWrapperElement?.classList.remove("visible");
  }
}
