// src/pitch-detector.ts
import Aubio from "aubiojs";

/** Lightweight object emitted when a valid note is detected */
export interface DetectedNote {
  name: string; // Note name without octave (e.g., "C", "G#")
  fullName: string; // Note name with octave (e.g., "C4", "G#3")
  frequency: number; // The detected frequency
  cents: number; // Deviation from perfect pitch
  rms: number;
}

/** Configuration options for the PitchDetector */
export interface PitchDetectorOptions {
  audioContext: AudioContext;
  noteSustainThresholdMs?: number; // Default: 10ms
  minAmplitudeThreshold?: number; // Default: 0.01
  onNoteDetected: (note: DetectedNote | null) => void;
}

interface NoteInfo {
  name: string | null;
  octave: number | null;
  cents: number;
}

interface SustainedPitchInfo {
  frequency: number;
  startTime: number; // Timestamp when sustain started (in seconds)
}

const A4_FREQUENCY = 440.0;
const NOTE_STRINGS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;
const DEFAULT_SUSTAIN_MS = 10;
const DEFAULT_AMPLITUDE_THRESHOLD = 0.01;

export class PitchDetector {
  private audioContext: AudioContext;
  private onNoteDetected: (note: DetectedNote | null) => void;
  private _noteSustainThresholdMs: number;
  private _minAmplitudeThreshold: number;

  private microphoneStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private aubioPitch: any | null = null; // Use 'any' for AubioPitch type if specific type is complex/unknown
  private isRunning: boolean = false;
  private sustainedPitchInfo: SustainedPitchInfo | null = null; // Track sustained pitch

  constructor(options: PitchDetectorOptions) {
    this.audioContext = options.audioContext;
    this.onNoteDetected = options.onNoteDetected;
    this._noteSustainThresholdMs =
      options.noteSustainThresholdMs ?? DEFAULT_SUSTAIN_MS;
    this._minAmplitudeThreshold =
      options.minAmplitudeThreshold ?? DEFAULT_AMPLITUDE_THRESHOLD;

    console.log(
      `PitchDetector initialized with sustain: ${this._noteSustainThresholdMs}ms, amplitude: ${this._minAmplitudeThreshold}`
    );
  }

  get noteSustainThresholdMs(): number {
    return this._noteSustainThresholdMs;
  }
  set noteSustainThresholdMs(value: number) {
    this._noteSustainThresholdMs = Math.max(0, value);
    console.log(
      `PitchDetector: Sustain threshold set to ${this._noteSustainThresholdMs}ms`
    );
  }

  get minAmplitudeThreshold(): number {
    return this._minAmplitudeThreshold;
  }
  set minAmplitudeThreshold(value: number) {
    this._minAmplitudeThreshold = Math.max(0, value);
    console.log(
      `PitchDetector: Amplitude threshold set to ${this._minAmplitudeThreshold}`
    );
  }

  /**
   * Starts the pitch detection process. Acquires microphone access.
   */
  async start(): Promise<void> {
    if (this.isRunning || this.audioContext.state !== "running") {
      console.warn(
        "PitchDetector already running or AudioContext not running."
      );
      return;
    }

    console.log("PitchDetector: Starting...");
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      // --- Create Nodes ---
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(
        SCRIPT_PROCESSOR_BUFFER_SIZE,
        1,
        1
      );
      this.scriptProcessorNode.onaudioprocess =
        this.handleAudioProcess.bind(this); // Bind 'this'

      // Initialize Aubio Pitch Detector
      const AubioModule = await Aubio();
      if (!AubioModule) throw new Error("Aubio module failed to load.");
      this.aubioPitch = new AubioModule.Pitch(
        "yin",
        SCRIPT_PROCESSOR_BUFFER_SIZE * 2,
        SCRIPT_PROCESSOR_BUFFER_SIZE,
        this.audioContext.sampleRate
      );

      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.microphoneStream
      );

      // --- Connect Nodes ---
      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.audioContext.destination); // Necessary connection

      this.isRunning = true;
      this.sustainedPitchInfo = null; // Reset sustain state
      console.log("PitchDetector: Started successfully.");
    } catch (err) {
      console.error("PitchDetector: Error starting -", err);
      this.stop(); // Clean up on error
      throw err; // Re-throw error for caller to handle
    }
  }

  /**
   * Stops the pitch detection process and releases resources.
   */
  stop(): void {
    if (!this.isRunning) return;
    console.log("PitchDetector: Stopping...");

    try {
      if (this.sourceNode) this.sourceNode.disconnect();
    } catch (e) {}
    try {
      if (this.scriptProcessorNode) {
        this.scriptProcessorNode.disconnect();
        this.scriptProcessorNode.onaudioprocess = null; // Remove handler
      }
    } catch (e) {}

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      console.log("PitchDetector: Microphone stream stopped.");
    }

    this.sourceNode = null;
    this.scriptProcessorNode = null;
    this.microphoneStream = null;
    this.aubioPitch = null;
    this.isRunning = false;
    this.sustainedPitchInfo = null;
    this.onNoteDetected(null); // Notify listener that detection stopped
    console.log("PitchDetector: Stopped.");
  }

  /**
   * Handles the audio processing event from the ScriptProcessorNode.
   * Performs pitch detection, amplitude check, and sustain logic.
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (!this.isRunning || !this.aubioPitch) {
      return;
    }

    const inputBuffer = event.inputBuffer.getChannelData(0);
    const currentTime = this.audioContext.currentTime; // Use context time for accuracy

    // 1. Calculate RMS Amplitude
    let sumOfSquares = 0;
    for (let i = 0; i < inputBuffer.length; i++) {
      sumOfSquares += inputBuffer[i] ** 2;
    }
    const rms = Math.sqrt(sumOfSquares / inputBuffer.length);

    // 2. Check Minimum Amplitude - But don't return immediately if we need to report silence
    const isAmplitudeSufficient = rms >= this._minAmplitudeThreshold;

    // 3. Detect Pitch
    let frequency = 0;
    if (isAmplitudeSufficient) {
      try {
        frequency = this.aubioPitch.do(inputBuffer);
      } catch (error) {
        console.error("Aubio pitch detection error:", error);
        frequency = 0;
      }
    } else {
      // If amplitude drops below threshold, treat as no valid pitch
      frequency = 0;
    }

    // 4. Handle Sustain Logic and Note Detection
    const isValidFrequencyDetected = frequency > 0;

    if (isValidFrequencyDetected) {
      // --- Valid frequency detected & amplitude sufficient ---
      if (
        this.sustainedPitchInfo === null ||
        !this.isFrequencySimilar(this.sustainedPitchInfo.frequency, frequency)
      ) {
        // Start tracking sustain for this new pitch
        this.sustainedPitchInfo = {
          frequency: frequency,
          startTime: currentTime,
        };
        // Don't notify yet, wait for sustain duration
        // Note: We don't call onNoteDetected(null) here, as a new pitch might be starting
      } else {
        // Pitch is being sustained, check duration
        const sustainDurationMs =
          (currentTime - this.sustainedPitchInfo.startTime) * 1000;

        if (sustainDurationMs >= this._noteSustainThresholdMs) {
          // Convert frequency to note info
          const noteInfo = this.frequencyToNoteInternal(frequency);

          if (noteInfo.name) {
            const detectedNote: DetectedNote = {
              name: noteInfo.name,
              fullName: `${noteInfo.name}${noteInfo.octave}`,
              frequency: frequency,
              cents: noteInfo.cents,
              rms: rms,
            };
            // Notify listener ONLY ONCE per sustained period
            this.onNoteDetected(detectedNote);
            this.sustainedPitchInfo = null; // Require release/new sustain
          } else {
            // Frequency was valid but couldn't map to note (should be rare)
            if (this.sustainedPitchInfo !== null) {
              this.sustainedPitchInfo = null;
              this.onNoteDetected(null); // Notify silence/null
            }
          }
        }
      }
    } else {
      // --- No valid pitch detected OR amplitude too low ---
      if (this.sustainedPitchInfo !== null) {
        // If we were tracking a sustained pitch, it has now stopped
        this.sustainedPitchInfo = null;
        this.onNoteDetected(null); // Notify silence/null
      }
      // If sustainedPitchInfo was already null, do nothing (already silent)
    }
  }

  /**
   * Checks if two frequencies are close enough to be considered the same pitch
   * for sustain tracking purposes (e.g., within ~1/4 semitone).
   */
  private isFrequencySimilar(freq1: number, freq2: number): boolean {
    if (freq1 === 0 || freq2 === 0) return false;
    // Check if ratio is within approximately 1.5% (roughly 25 cents)
    const ratio = freq1 / freq2;
    return ratio > 0.985 && ratio < 1.015;
  }

  private frequencyToNoteInternal(frequency: number): NoteInfo {
    if (!frequency || frequency <= 0 || !isFinite(frequency)) {
      return { name: null, octave: null, cents: 0 };
    }
    const midiNum = 12 * Math.log2(frequency / A4_FREQUENCY) + 69;
    if (!isFinite(midiNum)) {
      return { name: null, octave: null, cents: 0 };
    }

    const roundedMidiNum = Math.round(midiNum);
    const referenceFreq = this.frequencyFromMidiInternal(roundedMidiNum);
    let cents = 0;
    if (referenceFreq > 0 && frequency > 0) {
      cents = 1200 * Math.log2(frequency / referenceFreq);
      if (!isFinite(cents)) {
        cents = 0;
      } else {
        cents = Math.floor(cents);
      }
    }
    const noteIndex = ((roundedMidiNum % 12) + 12) % 12;
    const octave = Math.floor(roundedMidiNum / 12) - 1;
    const noteName = NOTE_STRINGS[noteIndex];
    return { name: noteName, octave: octave, cents: cents };
  }

  private frequencyFromMidiInternal(midiNum: number): number {
    return A4_FREQUENCY * Math.pow(2, (midiNum - 69) / 12);
  }

  public get stream(): MediaStream | null {
    return this.microphoneStream;
  }
}
