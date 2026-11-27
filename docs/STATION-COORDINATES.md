# Passenger station coordinate fallback

`stations-open` omits the three Warsaw passenger stations. Live coordinates remain preferred; missing names receive approximate OSM station-centre coordinates. These support PH proximity checks, map markers and route matching, not exact platforms or train control.

Verified 2026-11-27 via Nominatim (railway=station):
- Warszawa Wschodnia: https://www.openstreetmap.org/node/33210583
- Warszawa Centralna: https://www.openstreetmap.org/node/9814916146
- Warszawa Zachodnia: https://www.openstreetmap.org/node/3390821831

© OpenStreetMap contributors, ODbL https://www.openstreetmap.org/copyright . Source coordinates are in `stationFallbacks.ts`. Missing live station lists remain reported as network errors; fallback coordinates do not imply fresh traffic data.

## Passenger platform references, checked 2026-11-28
The live dispatcher markers for Sosnowiec are over 300 m from the OSM railway stop points used by passenger trains. Do not move the live station marker globally or broaden every station arrival radius. `passengerStationLocations.ts` overrides passenger/route proximity only:

- Sosnowiec Główny: https://www.openstreetmap.org/node/12585026591 (50.2791423, 19.1262529).
- Sosnowiec Południowy: https://www.openstreetmap.org/node/10567112402 (50.2703012, 19.1248035).

Queried from the primary Nominatim API as `railway=stop`; the station nodes are 3455731172 and 684107255 respectively. Katowice live coordinates remain unchanged. Physical validation against the game in both directions is still recommended; these are measured map references, not a claim of exact platform geometry.

The onboard model also checks the immediate previous PH when a stopped train remains within 300 m after the API advances its timetable index. It preserves distance to the upcoming index separately from the confirmed current PH distance. Announcement selection uses the confirmed standing row, suppresses duplicates and never converts a technical stop into PH.

Katowice was also checked against the primary OSM API station node https://www.openstreetmap.org/node/3246621282 (50.2576071, 19.0171456). Its live API point is within the existing 300 m threshold, so no coordinate override was added. The direction/index regression test uses this independent passenger reference rather than assuming the dispatcher point is the platform.
