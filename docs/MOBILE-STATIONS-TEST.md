# Mobile and passenger announcements · TEST 2026-11-28

Public release remains 0.8.3. This task updates only the separate TEST portable; the previous TEST executable is backed up locally. No recordings, data or public releases were removed.

## Passenger announcements
The supplied Katowice / Sosnowiec Główny / Sosnowiec Południowy WAV clips are present. Current official CZ1 names match the catalog. The two Sosnowiec dispatcher coordinates are outside the 300 m passenger arrival radius from independently verified OSM stop points. `findStation` applies the documented passenger references for timetable/proximity/route stops without mutating the live dispatch station list; see [coordinate sources](STATION-COORDINATES.md).

When stopped near a PH and the API index has advanced, the model can retain the immediate previous PH as current. The upcoming-point distance and the confirmed current-PH distance remain separate. Dashboard announcement input uses the confirmed standing row and its distance. It never replaces non-PH technical dwell with a passenger stop and never substitutes one Sosnowiec recording for the other.

## Mobile
- Arrival, departure, motion and delay presentation reuse the same helpers as the desktop.
- Payload includes app version/channel/build, mobile revision, host time and host-measured data age. Cached snapshots keep their true fetchedAt and receive updated age/status.
- Client ages samples with performance.now after receipt, rather than subtracting the phone wall clock from the PC clock.
- Visibility, pageshow, focus and online recovery cancel obsolete requests and fetch anew. Epoch checks reject late responses. Requests have a 15-second timeout; periodic refresh remains five seconds while visible. Expired pairing stops polling and asks for a new QR.
- Refresh button and version are visible. Static assets have revision query strings and retain no-store, private cookie and origin checks. No cloud hosting was reintroduced.
- Phone layout supports narrow, portrait and landscape screens and reduced motion. Map stations use small squares; selected train remains a colored train symbol with heading.

## Verification
251 automated tests, typecheck and build passed. A real HTTP MobileServer plus Chrome browser validated an 18-hour phone clock offset, shared estimated times, critical delay, network recovery, simulated lock/unlock, rejection of late responses, 320/390/844 px layout and pairing expiry. Both-direction arrival tests cover all three stations and an advanced timetable index, with correct recording selection and duplicate suppression.

The final portable booted in an isolated profile. All 149 application files matched the build, real IPC returned all three station clips, and a QR session served the new mobile HTML and revision directly from the package. These checks use controlled telemetry. A physical phone and a real game ride are still needed to verify device-specific sleep and in-game platform positions.

Evidence: `docs/verification/mobile-station-fix-browser.json`, `docs/verification/mobile-station-fix-package.json`. Local screenshots: `.deployment/mobile-station-fix/phone-portrait.png` and `phone-landscape.png`.
