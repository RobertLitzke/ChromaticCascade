export enum NoteType {
  REGULAR = "regular",
}

export interface NoteDefinition {
  type: NoteType;
  baseHealth: number;
  cssClass?: string; // Optional specific class for this type
}

export const REGULAR_NOTE: NoteDefinition = {
  type: NoteType.REGULAR,
  baseHealth: 1,
};