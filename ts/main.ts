import { AudioController } from "./audio-controller";
import { TunerDisplayController } from "./tuner-display-controller";
import { GameController } from "./game/game";

function getElement<T extends HTMLElement>(
  id: string,
  typeName: string
): T | null {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`Could not find ${typeName} element with ID: ${id}`);
    return null;
  }
  return el as T;
}

function initializeApp() {
  console.log("Initializing Chromatic Cascade...");

  try {
    const tunerDisplay = new TunerDisplayController();
    const gameController = new GameController();

    const audioController = new AudioController((note, rms) => {
      tunerDisplay.update(note, rms);
      gameController.onNoteUpdate(note, rms);
    });

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
    } else {
      console.error("Failed to find all modal elements for tuner.");
    }

    console.log("Chromatic Cascade Initialized.");
  } catch (error) {
    console.error("Failed to initialize application:", error);
    const appContainer = getElement<HTMLDivElement>(
      "appContainer",
      "App Container"
    );
    const audioControls = getElement<HTMLDivElement>(
      "audioControlPanel",
      "Audio Controls"
    );
    // Display error more prominently if init fails
    if (appContainer)
      appContainer.innerHTML = `<p style="color: #d32f2f; text-align: center; font-size: 1.2em; padding: 20px;">Error initializing: ${
        error instanceof Error ? error.message : String(error)
      }</p>`;
    if (audioControls) audioControls.style.display = "none";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
