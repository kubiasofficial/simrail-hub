# Expanded station voice pack – TEST 2026-11-28

Imported 121 owner-supplied M4A recordings without deleting or renaming originals. Converted to PCM16 mono 48 kHz with a 65 Hz high-pass and -20 LUFS / -2 dBTP target. Each clip has verified non-silent samples and a stored source/output SHA256.

112 names are active across arbitrary passenger train numbers, increasing station coverage from 44 to 156. Sędziszów is included. The preview selector uses the same registry as playback, so it cannot silently omit newly added names. Transit and technical stops do not become PH because a recording exists.

Nine confirmed upcoming Lublin names are prepared separately and excluded from current playback and application resources. Two source filename differences were confirmed by the owner. The truncated Warsaw filename `warszawa_srodmiesci.m4a` is mapped to canonical `warszawa_srodmiescie.wav`; originals are retained.

Evidence: `verification/station-recordings-import.json` lists every source, destination, hash, duration and signal level. `verification/station-recordings-package.json` records the actual portable EXE verification, all 156 names rendered through native IPC on two passenger train numbers, resource hashes, original preservation, inactive future clips, preview selector and mobile QR smoke check.

Checks: 262 tests passed across 42 files, TypeScript checks and production build. These validate voice selection and packaging; they do not claim a physical drive through every station. Proximity-triggered arrival/approach still requires valid station coordinates from the existing onboard data model.

The remaining 48 API candidates are not automatically a list of playable stations. Verify corridor/DLC availability before requesting another recording batch.

This batch was first delivered in the separate TEST executable, then promoted to public stable 0.8.5 on 2026-11-28. See RELEASE-0.8.5.md and verification/release085-published.json.
