# ♟ ChessMaster AI

A responsive chess web app built with HTML, CSS, and JavaScript. Play against a computer opponent or switch to local two-player mode on the same device.

## Features

- Full legal chess move validation through [`chess.js`](https://github.com/jhlywa/chess.js)
- Computer opponent with Easy, Medium, and Hard settings
- Local two-player mode
- Choose to play as White or Black
- Legal-move highlights, check indicator, castling, en passant, and pawn promotion
- Optional clocks: no timer, 3, 5, 10, or 15 minutes
- Move history, undo, board flip, captured-piece display, and PGN export
- Responsive layout for desktop and mobile
- Optional move sounds

## Run locally

This project uses browser ES modules and loads `chess.js` from jsDelivr, so use a local web server rather than opening `index.html` directly.

### Option 1: VS Code Live Server

1. Open the `ChessMaster-AI` folder in VS Code.
2. Install the **Live Server** extension if needed.
3. Right-click `index.html` and choose **Open with Live Server**.

### Option 2: Python on macOS

1. Open Terminal and navigate to this folder:
   ```bash
   cd path/to/ChessMaster-AI
   ```
2. Start a local server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser.

An internet connection is required to load the chess rules library and Google Fonts.

## How the AI works

The Easy level selects a legal move with some preference for captures. Medium and Hard use a minimax search with alpha-beta pruning and a material/position evaluation. This is a lightweight learning-project engine, not a replacement for Stockfish; the Hard level searches deeper and may take longer on slower devices.

## Deploy

### GitHub Pages

1. Create a GitHub repository named `ChessMaster-AI`.
2. Upload the files and folders in this project.
3. Open **Settings → Pages**.
4. Under the build/deployment section, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Wait for the published URL shown on the Pages settings screen.

### Vercel

1. Push this folder to GitHub.
2. Import the repository in Vercel.
3. Choose the static site / Other framework preset, with no build command and `.` as the output directory.
4. Deploy.

## Project structure

```text
ChessMaster-AI/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── README.md
├── LICENSE
└── .gitignore
```

## Credits and licensing

- Application code: MIT License; see [`LICENSE`](LICENSE).
- Chess rules library: `chess.js`, BSD-2-Clause; see the [upstream repository](https://github.com/jhlywa/chess.js).
- Google Fonts are loaded from Google Fonts.

## Future improvements

- Integrate Stockfish for a stronger computer opponent
- Save player statistics and game history
- Add online multiplayer with a backend
- Add board themes and accessibility preferences
