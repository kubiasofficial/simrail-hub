# Station recordings, journey information and radio cues - TEST

Prepared 2026-11-27. Public release and update feed remain 0.8.2. The new portable is installed only as `../SimRail Hub TEST.exe`; its previous executable was backed up under `../.zalohy/`.

## Station recordings
44 station names are registered. Matching is shared by station across every passenger train number, and the automatic station trigger still requires PH/CommercialStop. Freight stays silent. New optional files never become mandatory for the original base set.

14 supplied Krakow-area clips were converted to PCM WAV mono 48 kHz / 16 bit without modifying originals. User confirmed `klimatow.m4a` means Klimontow and `zasow.m4a` means Zastow. The five earlier Kutno / Piotrkow / Sieradz / Olkusz / Wolbrom recordings are also included.

## Journey information
Optional Settings / Announcements controls persist locally. Consideration is eligible 10 minutes after welcome completes; assistance is eligible after 25 minutes. Information messages are separated by at least 15 minutes after successful completion, only with fresh moving telemetry, outside a current PH and over 4 km from the next stop. Station events retain queue priority. Ticket inspection is manual only. `hlaseni.m4a` was confirmed by the user as assistance and converted to `hlaseni_zavad.wav`.

## Christmas
Automatic seasonal messages are allowed only on December 24 according to real Europe/Prague date, independent of simulated server time. Every calendar year is supported. Welcome replaces ordinary welcome only after an observed departure from the first playable PH; joining a moving train does not catch up. Farewell belongs to the last playable PH and never calls the map boundary a terminal station. Missing boundary metadata means no automatic holiday boundary message.

Playable PH uses the existing recording-preparation criterion: CommercialStop/PH, positive railway line, point ID not starting 999. This is a conservative API heuristic, not a claim that every future API point is released scenery. Unknown geometry/distance does not trigger a speculative approach. Queue validity rejects stale data, changed runs, disabled settings and messages crossing out of December 24.

Manual buttons explicitly allow previewing recordings outside the seasonal date. The optional Christmas journey clip is supported but absent, and is skipped without error. Other users without the private seasonal files retain the regular welcome.

## Radio
A locally synthesized 1050/1450 Hz two-tone opening and reversed closing replace the continuous noise. Squelch is quieter and limited to about 65 ms. Opening 450 ms, closing 320 ms; existing independent radio volume and before/after dispatcher framing are preserved. No externally licensed sound or paid API is used.

## Remaining recordings
- `sedziszow.wav` (station not supplied)
- `vanoce_behem_jizdy.wav` (optional in-journey Christmas greeting not supplied)

## Validation
244 automated tests and typecheck passed. Build succeeded. Real-file validation assembled 171 station/phrase/number combinations and checked five new service clips. Isolated packaged Electron validation checked IPC audio, actual muted opening/closing playback, settings and station preview. The portable booted in an isolated profile, 147 bundled files matched build output, and personal audio was excluded. See `docs/verification/seasonal-recordings*.json`.
