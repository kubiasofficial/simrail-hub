# Passenger station coordinate fallback

`stations-open` omits the three Warsaw passenger stations. Live coordinates remain preferred; missing names receive approximate OSM station-centre coordinates. These support PH proximity checks, map markers and route matching, not exact platforms or train control.

Verified 2026-11-27 via Nominatim (railway=station):
- Warszawa Wschodnia: https://www.openstreetmap.org/node/33210583
- Warszawa Centralna: https://www.openstreetmap.org/node/9814916146
- Warszawa Zachodnia: https://www.openstreetmap.org/node/3390821831

© OpenStreetMap contributors, ODbL https://www.openstreetmap.org/copyright . Source coordinates are in `stationFallbacks.ts`. Missing live station lists remain reported as network errors; fallback coordinates do not imply fresh traffic data.
