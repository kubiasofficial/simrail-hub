# Railway launcher / Warsaw / announcements / shift — TEST

This is a local TEST build based on 0.7.0, not a new public release. The build timestamp and executable hash identify it. The public release and updater feed are unchanged.

## Changes
- Missing Warsaw Wschodnia, Centralna and Zachodnia coordinates have documented approximate OSM fallbacks, without replacing live coordinates. See STATION-COORDINATES.md.
- Eight new personal names cover 16xx/61xx/16xxx/61xxx as well as existing 35/53/45/54 groups. skierniewic.m4a is mapped to skierniewice.wav. Originals remain untouched, private audio stays outside the application.
- Welcome requires monitoring a stationary passenger PH before departure; no welcome when joining a moving train. Luggage waits at least 60 seconds after welcome finishes.
- Waiting requires >5 minutes of continuous fresh stopped telemetry, zero signal speed, and signal distance <=250m. Planned dwell is excluded. Outside a confirmed passenger platform, one queued message combines departure wait and stay onboard. Movement, stale data and gaps reset/cancel the warning. Missing signal data does not imply red.
- New toggles are under Settings / Hlášení. Recordings preview lets you choose Warsaw and the new names. Passenger announcements stay disabled for freight.
- New Shift page plans same-station connections from actual API timetables and shared station data. Time range is current SERVER time through chosen end, 15 minutes–16 hours, including midnight. User declares DLC. Known vehicle DLC requirements are filtered, unknown locomotive types are excluded. Route and consist DLC requirements are not fully exposed by the API: verify these in the game.
- No train is reserved. A plan can include a future train not yet visible. Before following it, live run identity, bot state and unpassed takeover point are rechecked. Game takeover is always manual.
- Arrival/departure at takeover and planned destination times are shown. A break starts only after observed travel and a confirmed stop at the destination. A global banner counts down and announces break completion. Delays can invalidate later connections; replan from the actual station. Replanning retains remaining rest and is disabled while driving.
- Shift, owned DLC and existing favorites stay local to the profile. Progress is restored on restart, but a new observation of movement is required before confirming arrival.
- Approved charcoal/ice-blue shell, real game screenshots, shared controls, DLC page, updated server tiles, map symbols, onboard display, history, extensions, settings and mobile styling. Train icons are rounded rectangles with class colours; station icons are smaller squares. Existing route/Steam avatar/traffic/sneak-peek behaviour remains.
- Rapid navigation exposed a Leaflet cleanup race; late resize callbacks are guarded and zoom transitions cannot outlive destroyed maps.

## Verification
- 211 unit/regression tests, TypeScript checks and production build.
- recordings-16-61.json: 96 actual WAV compositions, all eight names, four numbering groups, three announcement kinds. No listening/transcription claim.
- railway-redesign-ui.json: all nine screens, large and narrow layout, language close/Escape, shift generation and persistence, no renderer errors.
- railway-live.json: actual CZ1 API, all three Warsaw stations, live train/timetable and multi-leg shift. Timetables are planned information, not reservation or measured travel times.
- railway-mobile.json: real pairing-cookie flow, three phone tabs at 390px and fresh HTTP data while the main window is minimized.
- railway-test-package.json and railway-portable.json identify the final binary and verify isolation/private audio exclusion.

## Manual ride check still useful
Run the TEST executable, enable own recordings/automatic announcements and follow a passenger PH service through Warsaw. Check both directions, distances and wording against the game. The automated proximity checks use known coordinates and controlled telemetry; they do not replace an actual human-driven Warsaw run.
