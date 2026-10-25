# Run Filament Studio locally

1. Install [Node.js 22.12 or newer](https://nodejs.org/).
2. Unzip the download.
3. Open a terminal in the extracted `filament-studio-0.1.0-local` folder.
4. Run `npm start`.
5. Open the local address printed in the terminal, normally `http://127.0.0.1:5180/`.

Keep the terminal open while drawing. To stop the app, press Control+C in the terminal. No dependency installation, build, account, or API key is needed for this ZIP.

Use a current desktop browser. Choose a drawing mode, adjust the controls, and add layers. Export SVG for vector editing or PNG for a 2400 × 3000 image. Save project downloads the seeds and settings as a JSON file. Open loads that file later.

The latest project also saves in browser storage. Use the same local address to return to it. If another app occupies port 5180, the launcher tries the next port. Save a project file before clearing browser storage or changing ports.

The app runs on your computer. It listens only on `127.0.0.1`. Google Fonts load when a connection is available, with system font fallbacks. Double-clicking `dist/index.html` does not start the app because drawing generation uses a browser worker.
