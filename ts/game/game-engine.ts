// ts/game/game-engine.ts

import { DetectedNote } from "../pitch-detector";
import { GameConfig } from "./config";

export interface BlockData {
  /* ... no change ... */ id: number;
  noteName: string;
  yPos: number;
  xPos: number;
  columnIndex: number;
}
interface MismatchInfo {
  /* ... no change ... */ noteName: string;
  startTime: number;
}

// Updated Callbacks Interface Definition
export interface GameEngineCallbacks {
  onScoreUpdate: (newScore: number) => void;
  onLevelUpdate: (newLevel: number, progress: number) => void;
  onPenaltyUpdate: (newPenaltyPercent: number) => void;
  onBlockAdded: (block: BlockData) => void;
  onBlockRemoved: (blockId: number, effectDuration: number) => void;
  onNoteDetectedUpdate: (noteName: string | null) => void;
  // *** MODIFIED: Pass level along with score ***
  onGameOverStateUpdate: (finalScore: number, levelReached: number) => void;
  onGameReset: () => void;
  onGamePause: () => void;
  onGameResume: (level: number) => void;
  onStatusUpdate: (message: string) => void;
  onLevelFlash: (level: number) => void;
  onLowestBlocksUpdate: (lowestBlockIds: number[]) => void;
  onBlockPositionsUpdate: (blockPositions: BlockData[]) => void;
}

export class GameEngine {
  private config: GameConfig;
  private callbacks: GameEngineCallbacks;

  // Game State (no change)
  private activeBlocks: BlockData[] = [];
  private gameLoopId: number | null = null;
  private addBlockTimerId: number | null = null;
  private nextBlockId = 0;
  private isGameOver = true;
  private isPaused = false;
  private penaltyValue = 0;
  private lastActionTimestamp = 0;
  private lastCorrectNoteTimestamp = 0;
  private mismatchedNoteInfo: MismatchInfo | null = null;
  private currentLevel: number = 1;
  private notesClearedThisLevel: number = 0;
  private totalNotesCleared: number = 0;
  private currentFallSpeedMultiplier: number = 1.0;
  private isSpawningCluster: boolean = false;
  private lowestBlockIdsInternal: Set<number> = new Set();

  // Constructor initializes with defaults
  constructor(
    config: GameConfig,
    initialCallbacks?: Partial<GameEngineCallbacks>
  ) {
    this.config = config;
    this.callbacks = {
      // Initialize with defaults
      onScoreUpdate: initialCallbacks?.onScoreUpdate ?? (() => {}),
      onLevelUpdate: initialCallbacks?.onLevelUpdate ?? (() => {}),
      onPenaltyUpdate: initialCallbacks?.onPenaltyUpdate ?? (() => {}),
      onBlockAdded: initialCallbacks?.onBlockAdded ?? (() => {}),
      onBlockRemoved: initialCallbacks?.onBlockRemoved ?? (() => {}),
      onNoteDetectedUpdate:
        initialCallbacks?.onNoteDetectedUpdate ?? (() => {}),
      // *** MODIFIED: Default for new callback ***
      onGameOverStateUpdate:
        initialCallbacks?.onGameOverStateUpdate ?? (() => {}),
      onGameReset: initialCallbacks?.onGameReset ?? (() => {}),
      onGamePause: initialCallbacks?.onGamePause ?? (() => {}),
      onGameResume: initialCallbacks?.onGameResume ?? (() => {}),
      onStatusUpdate: initialCallbacks?.onStatusUpdate ?? (() => {}),
      onLevelFlash: initialCallbacks?.onLevelFlash ?? (() => {}),
      onLowestBlocksUpdate:
        initialCallbacks?.onLowestBlocksUpdate ?? (() => {}),
      onBlockPositionsUpdate:
        initialCallbacks?.onBlockPositionsUpdate ?? (() => {}),
    };
    this.isGameOver = true;
    this.isPaused = false;
  }

  // Set Callbacks method (no change)
  public setCallbacks(callbacks: GameEngineCallbacks): void {
    /* ... no change ... */
    if (!callbacks || typeof callbacks.onGameReset !== "function") {
      console.error("...");
      return;
    }
    this.callbacks = callbacks;
    console.log("GameEngine: Callbacks successfully set.");
  }

  // Start method (no change)
  public start(): void {
    /* ... no change ... */
    if (!this.callbacks.onGameReset) {
      return;
    }
    if (!this.isGameOver || this.gameLoopId !== null) return;
    console.log("Starting Game Engine...");
    this.resetGameVariables();
    this.isGameOver = false;
    this.isPaused = false;
    this.currentFallSpeedMultiplier =
      this.config.difficulty.initialSpeedMultiplier;
    this.callbacks.onGameReset();
    this.callbacks.onLevelUpdate(this.currentLevel, 0);
    this.callbacks.onScoreUpdate(this.totalNotesCleared);
    this.callbacks.onPenaltyUpdate(0);
    const now = performance.now();
    this.lastActionTimestamp = now;
    this.lastCorrectNoteTimestamp = now;
    this.gameLoopId = window.setInterval(
      () => this.gameLoop(),
      this.config.timing.gameLoopInterval
    );
    this.spawnSingleNote();
    this.scheduleNextBlockAttempt();
    this.callbacks.onGameResume(this.currentLevel); // Triggers running state in UI
    console.log("Game Engine Started...");
  }

  // Pause method (no change)
  public pause(): void {
    /* ... no change ... */
    if (!this.callbacks.onGamePause) return;
    if (this.isGameOver || this.isPaused) return;
    this.isPaused = true;
    this.clearTimersAndIntervals();
    this.isSpawningCluster = false;
    this.mismatchedNoteInfo = null;
    this.updateLowestBlocks([]);
    this.callbacks.onGamePause();
    this.callbacks.onStatusUpdate("Paused");
    console.log("Game Engine Paused");
  }

  // Resume method (no change)
  public resume(): void {
    /* ... no change ... */
    if (!this.callbacks.onGameResume) return;
    if (this.isGameOver || !this.isPaused) return;
    this.isPaused = false;
    const now = performance.now();
    this.lastActionTimestamp = now;
    this.lastCorrectNoteTimestamp = now;
    if (this.gameLoopId === null) {
      this.gameLoopId = window.setInterval(
        () => this.gameLoop(),
        this.config.timing.gameLoopInterval
      );
    }
    this.scheduleNextBlockAttempt();
    this.callbacks.onGameResume(this.currentLevel);
    console.log("Game Engine Resumed");
  }

  // processNoteInput method (no change)
  public processNoteInput(note: DetectedNote | null, rms: number): void {
    /* ... no change ... */
    if (this.callbacks.onNoteDetectedUpdate) {
      const noteName =
        rms >= this.config.rules.noteDisplayAmplitudeThreshold && note?.name
          ? note.name
          : null;
      this.callbacks.onNoteDetectedUpdate(noteName);
    }
    if (!this.isPaused && !this.isGameOver) {
      this.handleNoteDetectionInternal(note?.name ?? null, rms);
    }
  }

  // resetGameVariables method (no change)
  private resetGameVariables(): void {
    /* ... no change ... */
    this.clearTimersAndIntervals();
    this.activeBlocks = [];
    this.lowestBlockIdsInternal.clear();
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

  // gameLoop method (no change)
  private gameLoop(): void {
    /* ... no change ... */
    if (this.isPaused || this.isGameOver) return;
    const gameAreaHeight = this.config.layout.gameAreaHeight;
    const blockHeight = this.config.layout.blockHeight;
    const currentFallSpeed =
      this.config.rules.baseBlockFallSpeed * this.currentFallSpeedMultiplier;
    let lowestBlocksCurrentLoop: (BlockData | null)[] = Array(
      this.config.layout.numColumns
    ).fill(null);
    const currentBlockPositions: BlockData[] = [];
    for (const block of this.activeBlocks) {
      block.yPos += currentFallSpeed;
      currentBlockPositions.push({ ...block });
      if (block.yPos + blockHeight >= gameAreaHeight) {
        this.handleGameOver();
        return;
      }
      const colIdx = block.columnIndex;
      if (
        !lowestBlocksCurrentLoop[colIdx] ||
        block.yPos > lowestBlocksCurrentLoop[colIdx]!.yPos
      ) {
        lowestBlocksCurrentLoop[colIdx] = block;
      }
    }
    if (this.callbacks.onBlockPositionsUpdate) {
      this.callbacks.onBlockPositionsUpdate(currentBlockPositions);
    }
    this.updateLowestBlocks(
      lowestBlocksCurrentLoop.filter((b) => b !== null) as BlockData[]
    );
  }

  // updateLowestBlocks method (no change)
  private updateLowestBlocks(currentLowestBlocksData: BlockData[]): void {
    /* ... no change ... */
    const newLowestIds = new Set(currentLowestBlocksData.map((b) => b.id));
    if (this.setsAreEqual(this.lowestBlockIdsInternal, newLowestIds)) {
      return;
    }
    this.lowestBlockIdsInternal = newLowestIds;
    if (this.callbacks.onLowestBlocksUpdate) {
      this.callbacks.onLowestBlocksUpdate(
        Array.from(this.lowestBlockIdsInternal)
      );
    }
  }
  // setsAreEqual helper (no change)
  private setsAreEqual(setA: Set<number>, setB: Set<number>): boolean {
    /* ... no change ... */
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
      if (!setB.has(item)) return false;
    }
    return true;
  }

  // *** MODIFIED handleGameOver ***
  private handleGameOver(): void {
    if (this.isGameOver) return;
    // *** Use new callback ***
    if (!this.callbacks.onGameOverStateUpdate) return;

    console.log("Game Over triggered in Engine.");
    this.isGameOver = true;
    this.isPaused = false;
    this.clearTimersAndIntervals();
    this.isSpawningCluster = false;
    const finalLevel = this.currentLevel; // Capture level before potentially resetting
    const finalScore = this.totalNotesCleared; // Capture score
    this.updateLowestBlocks([]);

    // Call the new callback with score and level
    this.callbacks.onGameOverStateUpdate(finalScore, finalLevel);

    // Keep status update for logging consistency, UI manager handles display
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(`Game Over! Score: ${finalScore}`);
    }
  }

  // clearTimersAndIntervals method (no change)
  private clearTimersAndIntervals(): void {
    /* ... no change ... */
    if (this.gameLoopId) {
      clearInterval(this.gameLoopId);
      this.gameLoopId = null;
    }
    if (this.addBlockTimerId) {
      clearTimeout(this.addBlockTimerId);
      this.addBlockTimerId = null;
    }
  }

  // scheduleNextBlockAttempt method (no change)
  private scheduleNextBlockAttempt(): void {
    /* ... no change ... */
    if (this.isPaused || this.isGameOver || this.addBlockTimerId !== null)
      return;
    const baseInterval =
      this.config.timing.baseAddBlockInterval / this.currentFallSpeedMultiplier;
    const randomness =
      baseInterval * this.config.timing.intervalRandomnessFactor;
    let randomInterval = baseInterval + (Math.random() * 2 - 1) * randomness;
    randomInterval = Math.max(
      this.config.timing.minAddBlockIntervalMs,
      randomInterval
    );
    randomInterval = Math.min(
      this.config.timing.maxAddBlockIntervalMs,
      randomInterval
    );
    this.addBlockTimerId = window.setTimeout(() => {
      this.addBlockTimerId = null;
      this.attemptBlockGeneration();
    }, randomInterval);
  }
  // attemptBlockGeneration method (no change)
  private async attemptBlockGeneration(): Promise<void> {
    /* ... no change ... */
    if (this.isPaused || this.isGameOver) return;
    if (
      !this.isSpawningCluster &&
      Math.random() < this.config.rules.skipSpawnChance
    ) {
      this.scheduleNextBlockAttempt();
      return;
    }
    if (
      !this.isSpawningCluster &&
      Math.random() < this.config.rules.clusterChance
    ) {
      await this.spawnCluster();
    } else if (!this.isSpawningCluster) {
      this.spawnSingleNote();
      this.scheduleNextBlockAttempt();
    }
  }
  // spawnCluster method (no change)
  private async spawnCluster(): Promise<void> {
    /* ... no change ... */
    if (this.isSpawningCluster || this.isPaused || this.isGameOver) return;
    this.isSpawningCluster = true;
    const numNotes =
      Math.floor(Math.random() * (this.config.rules.clusterMaxNotes - 1)) + 2;
    let interrupted = false;
    for (let i = 0; i < numNotes; i++) {
      if (this.isPaused || this.isGameOver) {
        interrupted = true;
        break;
      }
      this.spawnSingleNote();
      if (i < numNotes - 1) {
        try {
          await this.delay(this.config.timing.clusterInterval);
        } catch (e) {
          interrupted = true;
          console.log("Cluster spawn interrupted.");
          break;
        }
      }
    }
    this.isSpawningCluster = false;
    if (!interrupted && !this.isPaused && !this.isGameOver) {
      this.scheduleNextBlockAttempt();
    }
  }
  // delay helper (no change)
  private delay(ms: number): Promise<void> {
    /* ... no change ... */
    return new Promise((resolve, reject) => {
      let timerId: number | null = null;
      let intervalId: number | null = null;
      const clearIds = () => {
        if (timerId !== null) clearTimeout(timerId);
        if (intervalId !== null) clearInterval(intervalId);
        timerId = null;
        intervalId = null;
      };
      timerId = window.setTimeout(() => {
        clearIds();
        resolve();
      }, ms);
      intervalId = window.setInterval(() => {
        if (this.isPaused || this.isGameOver) {
          clearIds();
          reject(new Error("Delay interrupted by game state change"));
        }
      }, 50);
    });
  }
  // spawnSingleNote method (no change)
  private spawnSingleNote(): void {
    /* ... no change ... */
    if (this.isPaused || this.isGameOver) return;
    const lowestBlocksData = this.findLowestBlocksData();
    const lowestNotes = lowestBlocksData
      .filter((b) => b !== null)
      .map((b) => b!.noteName);
    const occupiedColumns = this.activeBlocks
      .filter((b) => b.yPos < this.config.layout.blockHeight * 1.5)
      .map((b) => b.columnIndex);
    let randomNote: string;
    let noteAttempts = 0;
    const maxNoteAttempts = this.config.rules.allowedNotes.length * 2;
    do {
      randomNote = this.getRandomAllowedNote();
      noteAttempts++;
    } while (
      lowestNotes.includes(randomNote) &&
      noteAttempts <= maxNoteAttempts
    );
    let randomColumn: number;
    let columnAttempts = 0;
    const maxColumnAttempts = this.config.layout.numColumns * 2;
    do {
      randomColumn = Math.floor(Math.random() * this.config.layout.numColumns);
      columnAttempts++;
    } while (
      occupiedColumns.includes(randomColumn) &&
      columnAttempts <= maxColumnAttempts
    );
    if (columnAttempts > maxColumnAttempts) {
      return;
    }
    this.addBlockData(randomNote, randomColumn);
  }
  // getRandomAllowedNote method (no change)
  private getRandomAllowedNote(): string {
    /* ... no change ... */
    const notes = this.config.rules.allowedNotes;
    if (notes.length === 0) return "C";
    const i = Math.floor(Math.random() * notes.length);
    return notes[i];
  }
  // addBlockData method (no change)
  private addBlockData(noteName: string, columnIndex: number): void {
    /* ... no change ... */
    if (!this.callbacks.onBlockAdded) return;
    columnIndex = Math.max(
      0,
      Math.min(columnIndex, this.config.layout.numColumns - 1)
    );
    const columnStart = columnIndex * this.config.layout.columnWidth;
    const blockX =
      columnStart +
      (this.config.layout.columnWidth - this.config.layout.blockWidth) / 2;
    const newBlock: BlockData = {
      id: this.nextBlockId++,
      noteName,
      yPos: 0,
      xPos: blockX,
      columnIndex,
    };
    this.activeBlocks.push(newBlock);
    this.callbacks.onBlockAdded(newBlock);
  }
  // findLowestBlocksData method (no change)
  private findLowestBlocksData(): (BlockData | null)[] {
    /* ... no change ... */
    const lowest: (BlockData | null)[] = Array(
      this.config.layout.numColumns
    ).fill(null);
    for (const block of this.activeBlocks) {
      const colIdx = block.columnIndex;
      if (!lowest[colIdx] || block.yPos > lowest[colIdx]!.yPos) {
        lowest[colIdx] = block;
      }
    }
    return lowest;
  }
  // handleNoteDetectionInternal method (Simultaneous clear logic - no change from previous step)
  private handleNoteDetectionInternal(
    detectedNoteName: string | null,
    rmsValue: number
  ): void {
    /* ... no change ... */
    if (this.isPaused || this.isGameOver || this.activeBlocks.length === 0) {
      if (detectedNoteName === null) this.mismatchedNoteInfo = null;
      return;
    }
    const currentTime = performance.now();
    if (
      currentTime - this.lastActionTimestamp <
      this.config.timing.actionCooldownMs
    ) {
      return;
    }
    if (
      detectedNoteName === null ||
      rmsValue < this.config.rules.minClearAmplitude
    ) {
      this.mismatchedNoteInfo = null;
      return;
    }
    const lowestBlocksData = this.findLowestBlocksData();
    const blocksToClear = new Set<BlockData>();
    const lowestMatchingBlocks = lowestBlocksData.filter(
      (block) => block !== null && block.noteName === detectedNoteName
    ) as BlockData[];
    if (lowestMatchingBlocks.length > 0) {
      this.mismatchedNoteInfo = null;
      this.lastActionTimestamp = currentTime;
      this.lastCorrectNoteTimestamp = currentTime;
      for (const startBlock of lowestMatchingBlocks) {
        blocksToClear.add(startBlock);
        let currentCheckBlock: BlockData | null = startBlock;
        while (currentCheckBlock) {
          const blockAbove = this.findBlockDirectlyAbove(currentCheckBlock);
          if (blockAbove && blockAbove.noteName === detectedNoteName) {
            blocksToClear.add(blockAbove);
            currentCheckBlock = blockAbove;
          } else {
            currentCheckBlock = null;
          }
        }
      }
      if (blocksToClear.size > 0) {
        console.log(
          `Clearing ${blocksToClear.size} blocks simultaneously for note ${detectedNoteName}.`
        );
        const sortedBlocks = Array.from(blocksToClear).sort(
          (a, b) => b.yPos - a.yPos
        );
        sortedBlocks.forEach((block) => {
          if (this.activeBlocks.some((ab) => ab.id === block.id)) {
            this.clearBlock(block);
          }
        });
      }
    } else {
      if (
        currentTime - this.lastCorrectNoteTimestamp <=
        this.config.timing.correctNoteGracePeriodMs
      ) {
        this.mismatchedNoteInfo = null;
        return;
      }
      if (rmsValue >= this.config.rules.minPenaltyAmplitude) {
        if (this.mismatchedNoteInfo?.noteName === detectedNoteName) {
          const durationHeld = currentTime - this.mismatchedNoteInfo.startTime;
          if (durationHeld >= this.config.timing.penaltyDelayMs) {
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
        this.mismatchedNoteInfo = null;
      }
    }
  }
  // findBlockDirectlyAbove helper (no change)
  private findBlockDirectlyAbove(baseBlock: BlockData): BlockData | null {
    /* ... no change ... */
    let closestBlockAbove: BlockData | null = null;
    let minDistance = Infinity;
    for (const otherBlock of this.activeBlocks) {
      if (
        otherBlock.id === baseBlock.id ||
        otherBlock.columnIndex !== baseBlock.columnIndex
      ) {
        continue;
      }
      const verticalDistance = baseBlock.yPos - otherBlock.yPos;
      const horizontalDistance = Math.abs(baseBlock.xPos - otherBlock.xPos);
      if (
        verticalDistance > 0 &&
        verticalDistance < this.config.layout.blockHeight * 1.75 &&
        horizontalDistance < 5
      ) {
        if (verticalDistance < minDistance) {
          minDistance = verticalDistance;
          closestBlockAbove = otherBlock;
        }
      }
    }
    return closestBlockAbove;
  }
  // clearBlock method (no change)
  private clearBlock(blockToClear: BlockData): void {
    /* ... no change ... */
    if (
      !this.callbacks.onScoreUpdate ||
      !this.callbacks.onBlockRemoved ||
      !this.callbacks.onLevelUpdate
    )
      return;
    const blockIndex = this.activeBlocks.findIndex(
      (b) => b.id === blockToClear.id
    );
    if (blockIndex === -1) {
      return;
    }
    this.activeBlocks.splice(blockIndex, 1);
    this.totalNotesCleared++;
    this.notesClearedThisLevel++;
    this.callbacks.onScoreUpdate(this.totalNotesCleared);
    this.callbacks.onBlockRemoved(
      blockToClear.id,
      this.config.timing.blockRemoveEffectDurationMs
    );
    const progress = Math.min(
      1,
      this.notesClearedThisLevel / this.config.difficulty.notesPerLevel
    );
    this.callbacks.onLevelUpdate(this.currentLevel, progress);
    if (this.notesClearedThisLevel >= this.config.difficulty.notesPerLevel) {
      this.levelUp();
    }
    this.updateLowestBlocks(
      this.findLowestBlocksData().filter((b) => b !== null) as BlockData[]
    );
  }
  // applyPenalty method (no change)
  private applyPenalty(): void {
    /* ... no change ... */
    if (this.isPaused || this.isGameOver || !this.callbacks.onPenaltyUpdate)
      return;
    this.penaltyValue += this.config.rules.penaltyIncrement;
    this.lastActionTimestamp = performance.now();
    const penaltyPercent = Math.min(
      100,
      (this.penaltyValue / this.config.rules.maxPenalty) * 100
    );
    this.callbacks.onPenaltyUpdate(penaltyPercent);
    if (this.penaltyValue >= this.config.rules.maxPenalty) {
      this.penaltyValue = 0;
      this.callbacks.onPenaltyUpdate(0);
      console.log(
        `Penalty maxed out! Spawning ${this.config.rules.penaltyBlockCount} blocks.`
      );
      for (let i = 0; i < this.config.rules.penaltyBlockCount; i++) {
        ((delayMultiplier) => {
          setTimeout(() => {
            if (!this.isPaused && !this.isGameOver) {
              this.spawnSingleNote();
            }
          }, delayMultiplier * this.config.timing.clusterInterval);
        })(i);
      }
    }
  }
  // levelUp method (no change)
  private levelUp(): void {
    /* ... no change ... */
    if (
      this.isPaused ||
      this.isGameOver ||
      !this.callbacks.onLevelUpdate ||
      !this.callbacks.onStatusUpdate ||
      !this.callbacks.onLevelFlash
    )
      return;
    this.currentLevel++;
    this.notesClearedThisLevel = 0;
    this.currentFallSpeedMultiplier *=
      1.0 + this.config.difficulty.fallSpeedIncreaseFactor;
    console.log(
      `LEVEL UP! Level ${
        this.currentLevel
      }. Speed Multiplier: ${this.currentFallSpeedMultiplier.toFixed(2)}x`
    );
    this.callbacks.onLevelUpdate(this.currentLevel, 0);
    this.callbacks.onStatusUpdate(`Level ${this.currentLevel}`);
    this.callbacks.onLevelFlash(this.currentLevel);
  }
}
