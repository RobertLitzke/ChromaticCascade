// ts/main.ts

import { AudioController } from "./audio-controller";
import { TunerDisplayController } from "./tuner-display-controller";
import { GameEngine, GameEngineCallbacks } from "./game/game-engine";
import { GameUIManager } from "./game/game-ui-manager";
import {
  GameConfig,
  getConfiguration,
  generateMajorScale,
  ALL_CHROMATIC_NOTES,
} from "./game/config";

// --- Helper Function ---
function getElement<T extends HTMLElement>(
  id: string,
  typeName: string
): T | null {
  /* ... no change ... */
  const el = document.getElementById(id);
  if (!el) {
    console.error(`Main: Could not find ${typeName} element with ID: ${id}`);
    return null;
  }
  return el as T;
}

// --- Global Variables ---
let audioController: AudioController | null = null;
let tunerDisplay: TunerDisplayController | null = null;
let gameEngine: GameEngine | null = null;
let gameUIManager: GameUIManager | null = null;
let lastUsedConfig: GameConfig | null = null; // Store the config used for restart

// --- Configuration UI References ---
let configMenuElement: HTMLElement | null = null;
let gameWrapperElement: HTMLElement | null = null;
let difficultySelect: HTMLSelectElement | null = null;
let noteModeChromaticRadio: HTMLInputElement | null = null;
let noteModeMajorScaleRadio: HTMLInputElement | null = null;
let noteModeManualRadio: HTMLInputElement | null = null; // Added manual radio ref
let keySelectionGroup: HTMLElement | null = null;
let keySelect: HTMLSelectElement | null = null;
let noteSelectionDisplayElement: HTMLElement | null = null;
let manualNoteSelectionGroup: HTMLElement | null = null; // Added manual group ref
let manualNoteCheckboxesElement: HTMLElement | null = null; // Added checkboxes container ref
let startGameButton: HTMLButtonElement | null = null;
let noteCheckboxes: Map<string, HTMLInputElement> = new Map(); // To store manual checkboxes

// --- Initialization ---
function initializeApp() {
  console.log("Initializing Chromatic Cascade...");

  try {
    // 1. Initialize independent components FIRST
    tunerDisplay = new TunerDisplayController();

    // *** Initialize AudioController early so controls are available ***
    audioController = new AudioController((note, rms) => {
      // This callback now needs null checks as engine might not exist yet
      if (tunerDisplay) tunerDisplay.update(note, rms);
      if (gameEngine) gameEngine.processNoteInput(note, rms);
    });

    // 2. Get references to UI elements
    configMenuElement = getElement<HTMLElement>("configMenu", "Config Menu");
    gameWrapperElement = getElement<HTMLElement>("gameWrapper", "Game Wrapper");
    difficultySelect = getElement<HTMLSelectElement>(
      "difficultySelect",
      "Difficulty Select"
    );
    noteModeChromaticRadio = getElement<HTMLInputElement>(
      "noteModeChromatic",
      "Chromatic Radio"
    );
    noteModeMajorScaleRadio = getElement<HTMLInputElement>(
      "noteModeMajorScale",
      "Major Scale Radio"
    );
    noteModeManualRadio = getElement<HTMLInputElement>(
      "noteModeManual",
      "Manual Radio"
    ); // Get manual radio
    keySelectionGroup = getElement<HTMLElement>(
      "keySelectionGroup",
      "Key Selection Group"
    );
    keySelect = getElement<HTMLSelectElement>("keySelect", "Key Select");
    noteSelectionDisplayElement = getElement<HTMLElement>(
      "noteSelectionDisplay",
      "Note Selection Display"
    );
    manualNoteSelectionGroup = getElement<HTMLElement>(
      "manualNoteSelectionGroup",
      "Manual Note Group"
    ); // Get manual group
    manualNoteCheckboxesElement = getElement<HTMLElement>(
      "manualNoteCheckboxes",
      "Manual Checkboxes Container"
    ); // Get checkbox container
    startGameButton = getElement<HTMLButtonElement>(
      "startGameButton",
      "Start Game Button"
    );

    // Check essential elements
    if (
      !configMenuElement ||
      !gameWrapperElement ||
      !difficultySelect ||
      !noteModeChromaticRadio ||
      !noteModeMajorScaleRadio ||
      !noteModeManualRadio ||
      !keySelectionGroup ||
      !keySelect ||
      !noteSelectionDisplayElement ||
      !manualNoteSelectionGroup ||
      !manualNoteCheckboxesElement ||
      !startGameButton
    ) {
      throw new Error("Failed to find all required configuration UI elements.");
    }

    // 3. Populate dynamic UI parts
    populateNoteDisplay(); // Create the note indicator divs
    populateManualCheckboxes(); // Create the manual selection checkboxes

    // 4. Setup Config UI Listeners
    setupConfigUIListeners();

    // 5. Update displays based on initial default selections
    handleNoteModeChange(); // Show/hide relevant sections and update display

    // 6. Show Config Menu initially
    showConfigMenu(); // Use helper function

    // 7. Setup Tuner Modal (remains independent)
    const tunerModal = getElement<HTMLDivElement>("tunerModal", "Tuner Modal");
    const showTunerButton = getElement<HTMLButtonElement>(
      "showTunerButton",
      "Show Tuner Button"
    );
    const closeTunerButton = getElement<HTMLButtonElement>(
      "closeTunerButton",
      "Close Tuner Button"
    );
    if (tunerModal && showTunerButton && closeTunerButton) {
      showTunerButton.addEventListener("click", () =>
        tunerModal.classList.add("visible")
      );
      closeTunerButton.addEventListener("click", () =>
        tunerModal.classList.remove("visible")
      );
      tunerModal.addEventListener("click", (event) => {
        if (event.target === tunerModal) tunerModal.classList.remove("visible");
      });
    }

    console.log("Configuration UI ready.");
  } catch (error) {
    console.error("Failed to initialize application setup:", error);
    const body = document.body;
    body.innerHTML = `<p style="color: red; padding: 20px; font-size: 1.2em;">Error initializing: ${
      error instanceof Error ? error.message : String(error)
    }</p>`;
  }
}

// --- Config UI Logic ---

function setupConfigUIListeners(): void {
  difficultySelect?.addEventListener("change", updateNoteSelectionDisplay); // Might influence display later
  noteModeChromaticRadio?.addEventListener("change", handleNoteModeChange);
  noteModeMajorScaleRadio?.addEventListener("change", handleNoteModeChange);
  noteModeManualRadio?.addEventListener("change", handleNoteModeChange); // Add listener for manual radio
  keySelect?.addEventListener("change", updateNoteSelectionDisplay);
  startGameButton?.addEventListener("click", startGame); // Renamed function
  // Add listener for changes within the manual checkboxes group
  manualNoteCheckboxesElement?.addEventListener(
    "change",
    handleManualCheckboxChange
  );
}

function handleNoteModeChange(): void {
  const isMajorScale = noteModeMajorScaleRadio?.checked;
  const isManual = noteModeManualRadio?.checked;

  if (keySelectionGroup)
    keySelectionGroup.style.display = isMajorScale ? "block" : "none";
  if (manualNoteSelectionGroup)
    manualNoteSelectionGroup.style.display = isManual ? "block" : "none";

  updateNoteSelectionDisplay(); // Update the main display based on new mode
}

function handleManualCheckboxChange(): void {
  // When a manual checkbox changes, just update the main note display
  if (noteModeManualRadio?.checked) {
    updateNoteSelectionDisplay();
  }
}

function populateNoteDisplay(): void {
  // Creates the top display indicators
  if (!noteSelectionDisplayElement) return;
  noteSelectionDisplayElement.innerHTML = "";
  ALL_CHROMATIC_NOTES.forEach((note) => {
    const noteEl = document.createElement("div");
    noteEl.classList.add("note-display-item");
    noteEl.dataset.note = note;
    noteEl.textContent = note;
    noteSelectionDisplayElement?.appendChild(noteEl);
  });
}

function populateManualCheckboxes(): void {
  // Creates the checkboxes
  if (!manualNoteCheckboxesElement) return;
  manualNoteCheckboxesElement.innerHTML = "";
  noteCheckboxes.clear(); // Clear map before repopulating

  ALL_CHROMATIC_NOTES.forEach((note) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = note;
    checkbox.id = `manualNote_${note.replace("#", "s")}`; // Create unique ID
    checkbox.checked = true; // Default to checked

    const span = document.createElement("span");
    span.textContent = note;

    label.appendChild(checkbox);
    label.appendChild(span);
    manualNoteCheckboxesElement?.appendChild(label);
    noteCheckboxes.set(note, checkbox); // Store reference
  });
}

function updateNoteSelectionDisplay(): void {
  // Updates the top indicator display
  if (!noteSelectionDisplayElement) return;

  const noteMode = noteModeMajorScaleRadio?.checked
    ? "majorScale"
    : noteModeManualRadio?.checked
    ? "manual"
    : "chromatic";
  const rootNote = keySelect?.value;
  let allowedNotes: string[] = [];

  if (noteMode === "majorScale" && rootNote) {
    allowedNotes = generateMajorScale(rootNote);
  } else if (noteMode === "manual") {
    allowedNotes = getManuallySelectedNotes();
    // Optionally disable checkboxes if not in manual mode
    noteCheckboxes.forEach((checkbox) => (checkbox.disabled = false));
  } else {
    // Chromatic
    allowedNotes = [...ALL_CHROMATIC_NOTES];
  }

  // Update highlighting in the top display
  const noteElements =
    noteSelectionDisplayElement.querySelectorAll(".note-display-item");
  noteElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const note = htmlEl.dataset.note;
    if (note && allowedNotes.includes(note)) {
      htmlEl.classList.add("note-active");
    } else {
      htmlEl.classList.remove("note-active");
    }
  });

  // Disable manual checkboxes if not in manual mode
  if (noteMode !== "manual") {
    noteCheckboxes.forEach((checkbox) => (checkbox.disabled = true));
  } else {
    noteCheckboxes.forEach((checkbox) => (checkbox.disabled = false));
    // Update checkboxes based on allowedNotes (in case it was empty)
    noteCheckboxes.forEach((checkbox, note) => {
      checkbox.checked = allowedNotes.includes(note);
    });
  }
}

function getManuallySelectedNotes(): string[] {
  const selected: string[] = [];
  noteCheckboxes.forEach((checkbox, note) => {
    if (checkbox.checked) {
      selected.push(note);
    }
  });
  return selected;
}

// --- Game Start/Control Logic ---

function startGame(): void {
  // Starts a new game from config menu
  console.log("Start Game button clicked.");
  if (!difficultySelect || !keySelect) return;

  // 1. Gather selections
  const difficulty = difficultySelect.value;
  const noteModeValue = document.querySelector<HTMLInputElement>(
    'input[name="noteMode"]:checked'
  )?.value;
  const noteMode =
    noteModeValue === "majorScale" ||
    noteModeValue === "manual" ||
    noteModeValue === "chromatic"
      ? noteModeValue
      : "chromatic"; // Type assertion
  const rootNote = keySelect.value;
  const manualNotes = getManuallySelectedNotes();

  // 2. Generate configuration
  try {
    lastUsedConfig = getConfiguration(
      difficulty,
      noteMode,
      manualNotes,
      rootNote
    ); // Store for restart
  } catch (err) {
    console.error("Error generating game configuration:", err);
    alert("Error setting up game configuration. Please check console.");
    return;
  }

  if (!lastUsedConfig) {
    console.error("Configuration is null, cannot start game.");
    return;
  }

  console.log("Initializing game engine and UI with config:", lastUsedConfig);

  // 3. Instantiate Engine and UI Manager
  gameEngine = new GameEngine(lastUsedConfig);
  gameUIManager = new GameUIManager(gameEngine, lastUsedConfig, onReturnToMenu); // Pass callback
  const realEngineCallbacks = gameUIManager.getEngineCallbacks();
  gameEngine.setCallbacks(realEngineCallbacks);

  // 4. Ensure Audio Controller is ready (already created in initializeApp)
  // Make sure microphone is potentially started or user can toggle it
  // (AudioController now handles enabling its button earlier)

  // 5. Switch Views
  if (configMenuElement && gameWrapperElement) {
    configMenuElement.classList.remove("visible");
    gameWrapperElement.classList.add("visible");
    if (gameUIManager) gameUIManager.showGame(); // Ensure game UI is visible if needed
  }

  // 6. Start the Engine
  console.log("Telling Game Engine to start...");
  gameEngine.start(); // Engine start triggers onGameResume in UI Manager
}

function restartGame(): void {
  console.log("Restart Game requested.");
  if (!lastUsedConfig) {
    console.error("Cannot restart, no previous config found.");
    showConfigMenu(); // Go back to config if no previous config
    return;
  }
  if (gameEngine && gameUIManager) {
    console.log("Restarting game with last used config.");
    // Engine start handles resetting state and UI via callbacks
    gameEngine.start();
    // Ensure game wrapper is visible and config menu hidden
    if (configMenuElement) configMenuElement.classList.remove("visible");
    gameUIManager.showGame(); // Make sure game view is shown
  } else {
    console.error("Engine or UI Manager not initialized, cannot restart.");
    showConfigMenu();
  }
}

function showConfigMenu(): void {
  console.log("Showing config menu.");
  if (gameUIManager) gameUIManager.hideGame(); // Hide game elements
  if (configMenuElement) configMenuElement.classList.add("visible");
  // Optionally reset game engine state if returning to menu means ending current game session
  gameEngine = null;
  gameUIManager = null; // Allow re-creation on next start
  lastUsedConfig = null;
  // Ensure audio controller is stopped? Or leave it running? Let's leave it.
  const statusDiv = document.getElementById("status");
  if (statusDiv) statusDiv.textContent = "Select Settings"; // Update status
}

// Callback for UI Manager when "New Game" / "Return to Menu" is clicked on End Game Overlay
function onReturnToMenu(): void {
  console.log("Return to Menu requested from Game UI.");
  showConfigMenu();
}

// --- Run Initialization ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
