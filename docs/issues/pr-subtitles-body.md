## What this does

Adds subtitles to the built-in player, which previously had none: `VideoView` was rendered with
`nativeControls={false}` and nothing else. Closes #1.

Subtitles arrive two ways with this catalogue, and they need different handling, so both are here.

### Embedded tracks (Android and iOS)

`expo-video` can show tracks muxed into the container. We read `availableSubtitleTracks`, auto-select
the track matching the user's language preference, and expose the rest in the player menu.

Two details that matter:

- The track is assigned from the **live `availableSubtitleTracks` array**, never from our copy of it.
  Assigning a stale object crashes the native player.
- Web is excluded on purpose: `expo-video` stubs these properties out there
  (`VideoPlayer.web.js` sets `subtitleTrack = null` and nothing else), so pretending otherwise would
  ship a control that does nothing.

### Sidecar files (every platform, including web)

The API supplies no subtitle URLs, so a sidecar has to be found or supplied:

- SRT and WebVTT parsing, tolerant of what real files contain: BOM, CRLF, 1–3 digit milliseconds,
  VTT without an hour, ASS `{\an8}` blocks, inline `<i>`/`<font>`, out-of-order cues, duplicates,
  inverted times, and a malformed cue that should cost only that cue.
- A bounded fetch (2 MiB cap, 8 s timeout) that **never throws**. A subtitle failing is a normal
  outcome; it must not interrupt playback. CORS rejection is handled like offline.
- Cue lookup is a binary search, because it runs on every player tick. A linear scan over a few
  thousand cues would be the most expensive thing in the render loop.
- Rendering in our own overlay, which is the only path that works in a browser.
- Conventional sidecar probing (`<name>.fa.srt`, `.persian.srt`, `.srt`, `.vtt`, first two only),
  skipped when the file has burned-in subtitles: overlaying text on `HardSub` would double it.

## Settings

| Setting | Default | Note |
| --- | --- | --- |
| `subtitlesEnabled` | `true` | Master switch |
| `subtitleLanguage` | `fa` | Persian-first, matching the product; falls back to the first track |
| `subtitleSize` | `md` | `sm` / `md` / `lg` |
| `subtitleBackground` | `soft` | `none` / `soft` / `solid` |
| `subtitleAutoProbe` | `true` | Look for a same-name `.srt` next to the video |

All five go through `migrateSettings`, so an install upgrading from 2.2 gets defaults and a corrupt
value is repaired instead of reaching the renderer. Settings shows a **live preview**, so the choice
is made by eye rather than by name.

Per-title choice (which track, which URL, sync offset, or "off for this title") is stored separately
from settings, capped at 500 entries. Mixing hundreds of title keys into the settings blob would make
every settings write rewrite all of them.

## Sync offset

The menu has ±0.5 s buttons, clamped to ±30 s in 250 ms steps, persisted per title.

The offset is applied **once**, in the overlay's cue lookup. An earlier draft also shifted the cue
array in the hook, which would have doubled the correction. Noted because it is the kind of bug that
looks correct in a screenshot.

## Verification

- `npx tsc --noEmit` clean.
- `npx vitest run` → **72 tests pass** (27 new).
- `npx expo export -p web` completes; the player and settings chunks build.
- Parser checked against a real file with CRLF line endings, a BOM and inline tags.

## Risks and what is not covered

1. **Web has no native subtitle support.** Our overlay is the only web path, and the web build hands
   playback to external players anyway (`webHandsOff`).
2. **CORS on third-party sidecars.** A `.srt` on another host will usually fail to fetch in a browser.
   It fails quietly and the menu offers manual entry, but a proxy pass-through would be the real fix.
3. **MKV on iOS.** `AVPlayer` does not play MKV, and most sources here are MKV. Pre-existing, not
   caused by this change, but it becomes obvious next to it. Deserves its own issue.
4. **Timing resolution.** The overlay follows `timeUpdate`, which ticks every 0.5 s today. Cue
   boundaries can lag by up to half a second. A smoother clock for the overlay alone is the next step
   if it is noticeable in practice.
5. **Manual URL entry** exists in the store and the hook (`loadFromUrl`) but has no text field in the
   UI yet. A file picker needs `expo-document-picker`, which is not a dependency and would need a
   native rebuild.

## Follow-ups (not in this PR)

- Offset from a text field, and a file picker.
- A `subtitles` field on `Source`, so a future API can supply URLs without a redesign.
- MKV playback on iOS.
