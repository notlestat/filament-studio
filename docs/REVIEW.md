# Import review

Reviewed on 25 October 2026. This was a source review and local functional check of the imported prototype. It was not a penetration test or a cross-browser audit.

## Source and scope

The source came from the original local `outputs/filament-studio` project recorded in the [shared build conversation](https://chatgpt.com/s/cx_6add462392348191968d8d3dbaefe592). The original folder remains intact. Dependencies and generated build output were excluded from the import. Source formatting was expanded for review, and the drawing algorithms retain the original implementation.

The review covered the generator, worker cache and lifecycle, Canvas preview, SVG and PNG exports, project validation, browser storage, composition controls, and setup instructions.

## Repairs

- Malformed project layers could throw during validation. Validation now rejects them before reading layer IDs.
- Imported projects accepted zero line weight. Validation now enforces the interface's minimum of 0.15.
- Duplicating a 120-character layer name exceeded the import limit. Duplicate names now stay within that limit.
- A failed generation left exports enabled with old geometry. Failures now appear in the viewport and block exports until generation succeeds.
- The footer claimed autosave succeeded when browser storage failed. It now asks the user to save a project file.
- Canvas applied layer opacity separately to overlapping strokes, producing a darker preview than SVG. Translucent layers now render to a reusable transparent buffer before compositing. A controlled crossing-stroke fixture produced RGBA `[174, 178, 180, 255]` before the repair and `[188, 191, 193, 255]` after it, matching the SVG pixel exactly.
- Clamping placement fields on every keystroke changed typed `-50` to `50` and `0.8` to `0.208`. Placement edits now commit on Enter or blur, allowing negative and decimal values. Escape cancels the edit.

## Verification

Local automated checks passed with Node.js 26.8.1 and npm 11.19.0:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm audit
git diff --check
```

All seven Node tests passed. The two added tests failed against the original validator before the repairs. The audit reported zero known dependency vulnerabilities at review time. GitHub Actions runs installation, type checks, tests, and the build with Node.js 22.

Playwright drove installed Google Chrome against the production build served by Vite preview. The checks covered:

- Initial worker rendering and all three generation modes.
- Presets, density changes, placement, duplication, visibility, reordering, removal, and the eight-layer limit.
- Actual SVG downloads, hidden-layer exclusion, and exported transforms.
- Actual PNG downloads with a valid PNG signature and 2400 × 3000 dimensions.
- Project-file downloads, reopening, reload persistence, and malformed-file rejection.
- Zoom buttons, keyboard zoom and fit, and help-dialog dismissal.
- Page widths of 320, 390, and 768 pixels without horizontal overflow.
- Simulated worker and storage failures, including disabled exports and accurate save status.

No uncaught page errors occurred in the main browser flow. Additional component probes against the development server reproduced and verified the layer-opacity and typed-placement repairs. Desktop and mobile screenshots were inspected visually.

The T3 browser snapshot timed out twice. Browser interactions and screenshots were completed with local Playwright instead.

## Remaining limits

The sheet remains a fixed portrait format. Placement is numeric. There is no undo history, freehand drawing, node editing, animation, or pinch gesture. Dense compositions can take longer to generate and export. Google Fonts require a network connection, with system font fallbacks. Artwork and settings stay in the browser, and SVG metadata includes the project settings.

Safari, Firefox, physical mobile devices, and production hosting were not tested. The GitHub Actions workflow is separate from these local results. This review does not claim that every defect or dependency vulnerability has been found.
