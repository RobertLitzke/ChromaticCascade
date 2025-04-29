// ts/audio-controller.ts

import { PitchDetector, DetectedNote } from "./pitch-detector";

function getElement<T extends HTMLElement>(
  id: string,
  typeName: string
): T | null {
  /* ... no change ... */
  const el = document.getElementById(id);
  if (!el) {
    console.warn(
      `AudioController Warning: Could not find ${typeName} element with ID: ${id}`
    );
    return null;
  }
  if (!(el instanceof HTMLElement)) {
    console.warn(`AudioController Warning: Element ${id} not HTMLElement.`);
    return null;
  }
  return el as T;
}

export type AudioUpdateCallback = (
  note: DetectedNote | null,
  rms: number
) => void;

export class AudioController {
  // DOM Elements
  private toggleListeningButton: HTMLButtonElement | null;
  private togglePlaybackButton: HTMLButtonElement | null;
  private statusDiv: HTMLDivElement | null;
  private listeningIcon: HTMLSpanElement | null;
  private playbackIcon: HTMLSpanElement | null;

  // Audio Components
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNodeForPlayback: MediaStreamAudioSourceNode | null = null;
  private pitchDetectorInstance: PitchDetector | null = null;

  // State
  private isListening: boolean = false;
  private isPlaybackEnabled: boolean = true;
  private latestRms: number = 0;
  private latestNote: DetectedNote | null = null;
  private isStarting: boolean = true; // Flag during initial auto-start attempt

  private onAudioUpdate: AudioUpdateCallback;

  constructor(audioCallback: AudioUpdateCallback) {
    /* ... no change ... */
    this.toggleListeningButton = getElement<HTMLButtonElement>(
      "toggleListeningButton",
      "Toggle Listening Button"
    );
    this.togglePlaybackButton = getElement<HTMLButtonElement>(
      "togglePlaybackButton",
      "Toggle Playback Button"
    );
    this.statusDiv = getElement<HTMLDivElement>("status", "Status Display");
    this.listeningIcon =
      this.toggleListeningButton?.querySelector("span.material-icons") ?? null;
    this.playbackIcon =
      this.togglePlaybackButton?.querySelector("span.material-icons") ?? null;
    this.onAudioUpdate = audioCallback;
    if (
      !this.toggleListeningButton ||
      !this.togglePlaybackButton ||
      !this.statusDiv ||
      !this.listeningIcon ||
      !this.playbackIcon
    ) {
      console.error(
        "AudioController Error: Failed to find essential control elements or icons."
      );
      if (this.statusDiv) this.statusDiv.textContent = "UI Error";
    }
    this.setupEventListeners();
    this.updateButtonStates(); // Set initial state (will be disabled due to isStarting=true)
    if (this.statusDiv) this.statusDiv.textContent = "Initializing...";
    this.attemptAutoStart(); // Attempt to start mic automatically
  }

  private async attemptAutoStart() {
    /* ... no change ... */
    console.log("Attempting to auto-start listening...");
    this.isStarting = true;
    if (this.statusDiv) this.statusDiv.textContent = "Starting Mic...";
    this.updateButtonStates();
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      let initialState: AudioContextState | undefined =
        this.audioContext?.state;
      if (initialState === "suspended") {
        console.warn("AudioContext suspended. User interaction needed.");
        if (this.statusDiv)
          this.statusDiv.textContent = "Click page to enable mic";
        const resumeHandler = async () => {
          document.body.removeEventListener("click", resumeHandler);
          if (!this.audioContext) {
            console.error("AudioContext missing...");
            this.isStarting = false;
            this.updateButtonStates();
            return;
          }
          let currentState = this.audioContext.state;
          if (currentState === "suspended") {
            console.log("Resuming audio context...");
            try {
              await this.audioContext.resume();
              currentState = this.audioContext.state;
              console.log("AudioContext resumed. New State:", currentState);
              if (currentState === "running" && !this.isListening) {
                await this.startListening();
              } else if (currentState !== "running") {
                if (this.statusDiv)
                  this.statusDiv.textContent = "Resume Failed";
                console.warn(`Could not resume. State: ${currentState}`);
              }
            } catch (err) {
              console.error("Resume failed:", err);
              if (this.statusDiv)
                this.statusDiv.textContent = "Mic Resume Error";
            } finally {
              this.isStarting = false;
              this.updateButtonStates();
            }
          } else {
            console.log(
              `Resume handler clicked, but context state is: ${currentState}`
            );
            this.isStarting = false;
            this.updateButtonStates();
          }
        };
        document.body.addEventListener("click", resumeHandler, { once: true });
        this.isStarting = false;
        this.updateButtonStates();
        return;
      } else if (initialState === "running") {
        await this.startListening();
      } else {
        console.warn(
          `Initial AudioContext state is not 'running' or 'suspended': ${initialState}`
        );
        if (this.statusDiv) this.statusDiv.textContent = "Mic Init Failed";
      }
    } catch (error) {
      console.error("Auto-start process failed:", error);
      if (this.statusDiv) this.statusDiv.textContent = "Mic Error";
    } finally {
      if (this.audioContext?.state !== "suspended") {
        this.isStarting = false;
        this.updateButtonStates();
      }
    }
  }

  private setupEventListeners(): void {
    /* ... no change ... */
    this.toggleListeningButton?.addEventListener("click", () => {
      if (!this.isStarting) {
        this.toggleListening();
      } else {
        console.log("Ignoring listening toggle during initial start.");
      }
    });
    this.togglePlaybackButton?.addEventListener("click", () => {
      this.togglePlayback();
    });
    window.addEventListener("beforeunload", () => {
      this.stopListening();
    });
  }
  private handlePitchDetection(note: DetectedNote | null): void {
    /* ... no change ... */
    this.latestNote = note;
    this.latestRms = note?.rms ?? 0;
    this.onAudioUpdate(this.latestNote, this.latestRms);
  }
  public async toggleListening(): Promise<void> {
    /* ... no change ... */
    if (this.isListening) {
      await this.stopListening();
    } else {
      await this.startListening();
    }
  }
  public async startListening(): Promise<void> {
    /* ... no change ... */
    if (this.isListening || this.isStarting) return;
    console.log("AudioController: startListening() called...");
    this.isStarting = true;
    if (this.statusDiv) this.statusDiv.textContent = "Starting Mic...";
    this.updateButtonStates();
    try {
      if (!this.audioContext || this.audioContext.state === "closed") {
        console.log("Creating new AudioContext...");
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      let currentContextState = this.audioContext.state;
      if (currentContextState === "suspended") {
        console.log("Context suspended, attempting resume...");
        await this.audioContext.resume();
        currentContextState = this.audioContext.state;
      }
      if (currentContextState !== "running") {
        throw new Error(
          `AudioContext failed to start or resume (state: ${currentContextState}).`
        );
      }
      if (!this.gainNode) {
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
      }
      this.gainNode.gain.setValueAtTime(
        this.isPlaybackEnabled ? 1 : 0,
        this.audioContext.currentTime
      );
      if (!this.pitchDetectorInstance) {
        this.pitchDetectorInstance = new PitchDetector({
          audioContext: this.audioContext,
          onNoteDetected: (n) => this.handlePitchDetection(n),
        });
      }
      await this.pitchDetectorInstance.start();
      if (this.pitchDetectorInstance?.stream && !this.sourceNodeForPlayback) {
        this.sourceNodeForPlayback = this.audioContext.createMediaStreamSource(
          this.pitchDetectorInstance.stream
        );
        this.sourceNodeForPlayback.connect(this.gainNode);
      } else if (
        this.pitchDetectorInstance?.stream &&
        this.sourceNodeForPlayback
      ) {
        try {
          this.sourceNodeForPlayback.disconnect();
        } catch (e) {}
        this.sourceNodeForPlayback.connect(this.gainNode);
      }
      this.isListening = true;
      if (this.statusDiv) this.statusDiv.textContent = "Listening";
      console.log("AudioController: Listening started successfully.");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("AudioController: Error starting audio -", errorMsg);
      if (this.statusDiv) this.statusDiv.textContent = "Mic Error";
      this.isListening = false;
      this.pitchDetectorInstance?.stop();
      try {
        this.sourceNodeForPlayback?.disconnect();
      } catch (e) {}
      this.sourceNodeForPlayback = null;
    } finally {
      this.isStarting = false;
      this.updateButtonStates();
    }
  }
  public async stopListening(): Promise<void> {
    /* ... no change ... */
    if (!this.isListening) {
      if (this.isStarting) {
        console.log(
          "StopListening called during start attempt, cancelling start."
        );
        this.isStarting = false;
      }
      return;
    }
    console.log("AudioController: Stopping listener...");
    const wasListening = this.isListening;
    this.isListening = false;
    this.isStarting = false;
    this.pitchDetectorInstance?.stop();
    try {
      this.sourceNodeForPlayback?.disconnect();
    } catch (e) {}
    this.sourceNodeForPlayback = null;
    this.latestNote = null;
    this.latestRms = 0;
    if (wasListening) {
      this.onAudioUpdate(null, 0);
    }
    if (this.statusDiv) this.statusDiv.textContent = "Mic Off";
    this.updateButtonStates();
    console.log("AudioController: Listener stopped.");
  }
  public togglePlayback(): void {
    /* ... no change ... */
    this.isPlaybackEnabled = !this.isPlaybackEnabled;
    console.log(
      `AudioController: Playback toggled to ${
        this.isPlaybackEnabled ? "ON" : "OFF"
      }.`
    );
    if (this.audioContext && this.gainNode) {
      const targetGain = this.isPlaybackEnabled ? 1 : 0;
      this.gainNode.gain.setTargetAtTime(
        targetGain,
        this.audioContext.currentTime,
        0.015
      );
    }
    this.updateButtonStates();
  }

  // *** MODIFIED updateButtonStates ***
  private updateButtonStates(): void {
    // Listening button state
    if (this.toggleListeningButton && this.listeningIcon) {
      const needsInteraction = this.audioContext?.state === "suspended";
      // *** FIX: Disable if interaction needed, OR if actively starting. Enable otherwise. ***
      this.toggleListeningButton.disabled = needsInteraction || this.isStarting;

      this.listeningIcon.textContent = this.isListening ? "mic_off" : "mic";

      if (needsInteraction && !this.isStarting) {
        // Indicate interaction needed *after* initial start attempt finishes
        this.toggleListeningButton.style.opacity = "0.6";
        this.toggleListeningButton.setAttribute(
          "title",
          "Click page to enable microphone"
        );
        if (this.statusDiv)
          this.statusDiv.textContent = "Click page to enable mic"; // Redundant with attemptAutoStart? maybe ok
      } else if (this.isStarting) {
        // Indicate starting in progress
        this.toggleListeningButton.style.opacity = "0.6";
        this.toggleListeningButton.setAttribute(
          "title",
          "Initializing microphone..."
        );
      } else {
        // Normal enabled state
        this.toggleListeningButton.style.opacity = "1";
        this.toggleListeningButton.setAttribute(
          "title",
          this.isListening ? "Stop Listening" : "Start Listening"
        );
      }
    }

    // Playback button state (enable only when listening is possible/active)
    if (this.togglePlaybackButton && this.playbackIcon) {
      // Enable playback toggle only if mic is active OR potentially usable (not closed/failed hard)
      const micPotentiallyUsable =
        this.audioContext?.state === "running" ||
        this.audioContext?.state === "suspended";
      this.togglePlaybackButton.disabled = !micPotentiallyUsable; // Enable if running or suspended

      this.playbackIcon.textContent = this.isPlaybackEnabled
        ? "volume_off"
        : "volume_up";
      this.togglePlaybackButton.setAttribute(
        "title",
        this.isPlaybackEnabled ? "Mute Playback" : "Unmute Playback"
      );
    }

    // Update overall status text based on listening state if not handled by interaction need
    if (
      this.statusDiv &&
      !this.isStarting &&
      this.audioContext?.state !== "suspended"
    ) {
      this.statusDiv.textContent = this.isListening ? "Listening" : "Mic Off";
    } else if (
      this.statusDiv &&
      !this.isStarting &&
      this.audioContext?.state === "suspended"
    ) {
      this.statusDiv.textContent = "Click page to enable mic";
    }
  }
}
