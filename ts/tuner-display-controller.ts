import { DetectedNote } from "./pitch-detector";

function getElement<T extends HTMLElement>(id: string, typeName: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(
      `TunerDisplayController Error: Could not find ${typeName} element with ID: ${id}`
    );
  }
  if (!(el instanceof HTMLElement)) {
    throw new Error(
      `TunerDisplayController Error: Element with ID ${id} is not an HTMLElement.`
    );
  }
  return el as T;
}

const NULL_DISPLAY_TEXT = "---";
const CENTS_IN_TUNE_THRESHOLD = 15;
const MAX_EXPECTED_RMS = 0.5;

export class TunerDisplayController {
  // Tuner Elements
  private largeNoteDiv: HTMLDivElement;
  private tunerIndicator: HTMLDivElement;
  // Amplitude Elements
  private amplitudeValueSpan: HTMLSpanElement;
  private amplitudeBar: HTMLProgressElement;
  // Details Table Cells
  private rawFreqCell: HTMLTableCellElement;
  private rawNoteCell: HTMLTableCellElement;
  private rawCentsCell: HTMLTableCellElement;

  constructor() {
    this.largeNoteDiv = getElement<HTMLDivElement>(
      "largeNoteDisplay",
      "Large Note Display"
    );
    this.tunerIndicator = getElement<HTMLDivElement>(
      "tunerIndicator",
      "Tuner Indicator"
    );
    this.amplitudeValueSpan = getElement<HTMLSpanElement>(
      "amplitudeValue",
      "Amplitude Value"
    );
    this.amplitudeBar = getElement<HTMLProgressElement>(
      "amplitudeBar",
      "Amplitude Bar"
    );
    this.rawFreqCell = getElement<HTMLTableCellElement>(
      "rawFreq",
      "Raw Freq Cell"
    );
    this.rawNoteCell = getElement<HTMLTableCellElement>(
      "rawNote",
      "Raw Note Cell"
    );
    this.rawCentsCell = getElement<HTMLTableCellElement>(
      "rawCents",
      "Raw Cents Cell"
    );

    this.reset();
  }

  /** Resets all tuner UI elements to their default state. */
  public reset(): void {
    this.amplitudeValueSpan.textContent = "0.000";
    this.amplitudeBar.value = 0;
    this.rawFreqCell.textContent = NULL_DISPLAY_TEXT;
    this.rawNoteCell.textContent = NULL_DISPLAY_TEXT;
    this.rawCentsCell.textContent = NULL_DISPLAY_TEXT;
    this.largeNoteDiv.textContent = "--";
    this.largeNoteDiv.classList.remove("in-tune");
    this.tunerIndicator.style.left = "50%";
    this.tunerIndicator.classList.remove("in-tune", "sharp", "flat");
  }

  /**
   * Updates all tuner display elements based on the latest detection results.
   * @param note The detected note object (contains name, freq, cents, rms) or null.
   * @param rms The current RMS value (might differ slightly from note.rms if note is null).
   */
  public update(note: DetectedNote | null, rms: number): void {
    this.amplitudeValueSpan.textContent = rms.toFixed(3);
    this.amplitudeBar.value = Math.min(rms / MAX_EXPECTED_RMS, 1.0);

    if (note) {
      this.rawFreqCell.textContent = note.frequency.toFixed(1);
      this.rawNoteCell.textContent = note.fullName;
      this.rawCentsCell.textContent = this.formatCents(note.cents);
    } else {
      this.rawFreqCell.textContent = NULL_DISPLAY_TEXT;
      this.rawNoteCell.textContent = NULL_DISPLAY_TEXT;
      this.rawCentsCell.textContent = NULL_DISPLAY_TEXT;
    }

    const noteName = note?.name ?? null;
    const cents = note?.cents ?? 0;

    if (noteName) {
      this.largeNoteDiv.textContent = noteName;
      const positionPercent = 50 + cents;
      const clampedPercent = Math.max(0, Math.min(100, positionPercent));
      this.tunerIndicator.style.left = `${clampedPercent}%`;

      const inTune = Math.abs(cents) <= CENTS_IN_TUNE_THRESHOLD;
      this.largeNoteDiv.classList.toggle("in-tune", inTune);
      this.tunerIndicator.classList.toggle("in-tune", inTune);
      this.tunerIndicator.classList.toggle("sharp", !inTune && cents > 0);
      this.tunerIndicator.classList.toggle("flat", !inTune && cents < 0);
    } else {
      // Reset if no valid note
      this.largeNoteDiv.textContent = "--";
      this.largeNoteDiv.classList.remove("in-tune");
      this.tunerIndicator.style.left = "50%";
      this.tunerIndicator.classList.remove("in-tune", "sharp", "flat");
    }
  }

  private formatCents(cents: number): string {
    if (!isFinite(cents)) return NULL_DISPLAY_TEXT;
    const roundedCents = Math.round(cents);
    if (roundedCents === 0) return "0";
    return roundedCents > 0 ? `+${roundedCents}` : `${roundedCents}`;
  }
}
