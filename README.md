# Chromatic Cascade

Chromatic Cascade is a web-based game that challenges your note memorization and pitch accuracy. Connec to an instrument or microphone and sing or play the correct notes to clear falling blocks.

## Features

* **Real-time Pitch Detection:** Uses your microphone and the Web Audio API to detect the pitch you're singing or playing.
* **Falling Block Gameplay:** Clear blocks representing musical notes as they fall down the screen.
* **Level Progression:** As you clear notes, you advance to more challenging levels.
* **Scoring:** Earn points for each correctly matched note - or penalties for the wrong note.
* **Integrated Tuner:** A detailed tuner display (accessible via the 'tune' icon) shows the detected note, frequency, cents deviation, and input amplitude.
* **Audio Controls:** Easily toggle microphone input and mute/unmute audio playback.

## How to Play

1.  Click "New Game" to start.
2.  Colored blocks representing musical notes will begin to fall in different columns.
3.  Identify the **lowest** block in any column.
4.  Sing or play the musical note shown on that block into your microphone.
5.  If you play or sing the right note, the block will be cleared, and you'll score points.
6.  Don't let the blocks reach the bottom red line!
7.  If you sing or play an incorrect note for too long while a block needs clearing, you'll be penalized
8.  Clear the required number of notes (indicated by the progress bar) to advance to the next level.

## Requirements

* A modern web browser that supports the Web Audio API (`AudioContext`) and `navigator.mediaDevices.getUserMedia`. (Most recent versions of Chrome, Firefox, Edge, Safari should work).
* A functional microphone or audio connection (such as Focusrite Scarlett) connected to your computer and permission granted for the browser to access it.

## Setup and Installation

1.  Clone this repository:
    ```bash
    git clone <repository-url>
    ```
2.  Navigate into the TypeScript source directory:
    ```bash
    cd path/to/repository/ts
    ```
3.  Install the necessary Node.js dependencies:
    ```bash
    npm install
    ```

## Running the Game

1.  Make sure you are in the `ts` directory.
2.  Run the development server:
    ```bash
    npm start
    ```
   
3.  This command uses `webpack-dev-server` and should automatically open the game in your default web browser. You may need to grant microphone permissions when prompted.

## Building the Project

1.  Make sure you are in the `ts` directory.
2.  Run the build command:
    ```bash
    npm run build
    ```
   
3.  This will compile the TypeScript code and create a `bundle.js` file in the `../js/` directory.
4.  After building, you can open the main `index.html` file (in the repository root) directly in your web browser to play the game.

## Key Dependencies

* [Aubiojs](https://github.com/qiuxiang/aubiojs) for pitch detection.
* Webpack for bundling.