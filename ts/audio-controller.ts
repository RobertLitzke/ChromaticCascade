import { PitchDetector, DetectedNote } from "./pitch-detector";

function getElement<T extends HTMLElement>(
  id: string,
  typeName: string
): T | null {
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

export type NoteUpdateCallback = (
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
  private isPlaybackEnabled: boolean = true; // Start with sound ON
  private latestRms: number = 0;
  private latestNote: DetectedNote | null = null;
  private isStarting: boolean = true; // Flag during initial auto-start attempt

  // Callback
  private onNoteUpdate: NoteUpdateCallback;

  constructor(noteCallback: NoteUpdateCallback) {
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
    this.onNoteUpdate = noteCallback;

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
      return;
    }
    this.setupEventListeners();
    this.updateButtonStates(); // Set initial state (listening=false, playback=true)
    if (this.statusDiv) this.statusDiv.textContent = "Initializing...";

    // Attempt auto-start after listeners are attached
    this.attemptAutoStart();
  }

  // Separate function for attempting auto-start, allows retries or user prompts if needed
  private async attemptAutoStart() {
    console.log("Attempting to auto-start listening...");
    this.isStarting = true; // Mark as starting
    if (this.statusDiv) this.statusDiv.textContent = "Starting Mic...";
    try {
      // Create context if it doesn't exist (needed before starting)
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        // Check state *after* creation, may need resume()
        if (this.audioContext.state === "suspended") {
          console.warn(
            "AudioContext suspended. User interaction might be needed to resume."
          );
          // Add a visual cue for the user?
          if (this.statusDiv)
            this.statusDiv.textContent = "Click page to enable mic";
          // Add a one-time click listener to resume context
          const resumeHandler = async () => {
            if (this.audioContext?.state === "suspended") {
              console.log("Resuming audio context on user interaction.");
              await this.audioContext.resume();
              // Now try starting again if not already started by a manual click
              if (!this.isListening) {
                await this.startListening();
              }
            }
            document.body.removeEventListener("click", resumeHandler); // Remove listener after use
          };
          document.body.addEventListener("click", resumeHandler, {
            once: true,
          });
          // Don't proceed with startListening until resumed
          this.isStarting = false;
          return;
        }
      }
      // If context is running or was just created okay, proceed to start
      await this.startListening();
    } catch (error) {
      console.error("Auto-start listening failed:", error);
      // Don't set statusDiv here, startListening already handles error display
    } finally {
      this.isStarting = false; // Finished starting attempt
      // Ensure button states are correct after attempt
      this.updateButtonStates();
    }
  }

  private setupEventListeners(): void {
    this.toggleListeningButton?.addEventListener("click", () => {
      if (!this.isStarting) {
        // Prevent toggle if initial start is still pending
        this.toggleListening();
      } else {
        console.log("Ignoring toggle click during initial start attempt.");
      }
    });
    this.togglePlaybackButton?.addEventListener("click", () =>
      this.togglePlayback()
    );
    window.addEventListener("beforeunload", () => {
      if (this.isListening) this.stopListening();
    });
  }

  private handlePitchDetection(note: DetectedNote | null): void {
    this.latestNote = note;
    this.latestRms = note?.rms ?? 0;
    this.onNoteUpdate(this.latestNote, this.latestRms);
  }

  public async toggleListening(): Promise<void> {
    if (this.isListening) await this.stopListening();
    else await this.startListening();
  }

  public async startListening(): Promise<void> {
    if (this.isListening) return;
    if (this.isStarting && !this.audioContext) {
      // If auto-start is running but context creation failed somehow earlier
      console.warn(
        "Start called while isStarting=true but no context, retrying context creation."
      );
      await this.attemptAutoStart(); // Retry the whole sequence
      return; // Exit here, let retry handle it
    }

    console.log("startListening() called...");
    if (this.statusDiv) this.statusDiv.textContent = "Starting Mic...";
    this.isListening = true;
    this.updateButtonStates(); // Optimistic UI

    try {
      if (!this.audioContext || this.audioContext.state === "closed")
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      if (this.audioContext.state === "suspended") {
        console.log("Resuming suspended audio context...");
        await this.audioContext.resume(); // Attempt resume again if needed
      }
      if (this.audioContext.state !== "running")
        throw new Error(
          `AudioContext not running (state: ${this.audioContext.state}). User interaction might be required.`
        );

      if (!this.gainNode) {
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
      }
      this.gainNode.gain.setValueAtTime(
        this.isPlaybackEnabled ? 1 : 0,
        this.audioContext.currentTime
      );
      if (!this.pitchDetectorInstance)
        this.pitchDetectorInstance = new PitchDetector({
          audioContext: this.audioContext,
          onNoteDetected: (n) => this.handlePitchDetection(n),
        });
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
      console.log("Listening started successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.statusDiv) this.statusDiv.textContent = `Mic Error`;
      console.error("Error starting audio:", err);
      // Reset state fully on error
      this.isListening = false;
      // Don't call stopListening here as it might try to stop things that failed to start
    } finally {
      this.isStarting = false;
      this.updateButtonStates();
    } // Mark starting as finished
  }

  public async stopListening(): Promise<void> {
    // No need to check context state here, just stop if listening
    if (!this.isListening) return;
    console.log("Stopping listener...");
    const wasListening = this.isListening;
    this.isListening = false;
    this.pitchDetectorInstance?.stop();
    try {
      this.sourceNodeForPlayback?.disconnect();
    } catch (e) {}
    this.sourceNodeForPlayback = null;
    this.latestNote = null;
    this.latestRms = 0;
    if (wasListening) this.onNoteUpdate(null, 0);
    if (this.statusDiv) this.statusDiv.textContent = "Mic Off";
    this.updateButtonStates();
    console.log("Listener stopped.");
  }

  public togglePlayback(): void {
    // Allow toggling even if not listening, just update the state
    this.isPlaybackEnabled = !this.isPlaybackEnabled;
    if (this.isListening && this.audioContext && this.gainNode) {
      // Apply gain change only if listening
      const targetGain = this.isPlaybackEnabled ? 1 : 0;
      this.gainNode.gain.setTargetAtTime(
        targetGain,
        this.audioContext.currentTime,
        0.015
      );
    }
    this.updateButtonStates();
    console.log(`Playback toggled: ${this.isPlaybackEnabled ? "ON" : "OFF"}`);
  }

  private updateButtonStates(): void {
    if (this.toggleListeningButton && this.listeningIcon) {
      this.toggleListeningButton.disabled = this.isStarting; // Disable only during initial auto-start attempt
      this.listeningIcon.textContent = this.isListening ? "mic_off" : "mic";
      this.toggleListeningButton.setAttribute(
        "title",
        this.isListening ? "Stop Listening" : "Start Listening"
      );
    }
    if (this.togglePlaybackButton && this.playbackIcon) {
      // Always enable playback button unless during initial startup? Or maybe always enable? Let's enable always.
      this.togglePlaybackButton.disabled = false; // Enable playback toggle always
      this.playbackIcon.textContent = this.isPlaybackEnabled
        ? "volume_off"
        : "volume_up"; // Reflect actual state
      this.togglePlaybackButton.setAttribute(
        "title",
        this.isPlaybackEnabled ? "Mute Playback" : "Unmute Playback"
      );
    }
  }
}
