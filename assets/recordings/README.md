# Czech passenger announcement pack

This pack contains 156 recorded station names shared across all passenger services, 3 phrase clips, 14 general/seasonal clips and the supplied dispatcher radio cue: 174 WAV files total.

The project owner supplied and authorized these recordings for integration. The original voice pack was approved on 2026-11-27, the radio cue and 112 additional station names on 2026-11-28. Source M4A and MP3 files are retained in the private recordings folder and are not packaged.

Every WAV is mono PCM16 at 48 kHz; `manifest.json` records byte length, duration and SHA256. Optional local WAV overrides take precedence per file. The shared station lookup is `src/services/stationRecordings.ts`; train numbers do not restrict playback. Automatic station triggers still require a passenger stop (PH/CommercialStop), and freight services remain silent.

Nine recordings for confirmed upcoming Lublin Region DLC are stored separately under `assets/upcoming-recordings/lublin-region`. They are not part of the active lookup, preview list or packaged application resources. Activate them only after the playable route and actual passenger stops have been verified.
