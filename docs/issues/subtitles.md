## Problem

Subtitles cannot be displayed or controlled in the built-in player.

`src/app/player.tsx` renders `VideoView` with `nativeControls={false}` and no subtitle handling of any
kind. There is no subtitle state, no track selector, and no subtitle settings. The user has no way to
turn subtitles on, choose a track, or adjust how they look.

This matters more than a missing polish item: for a large part of the catalogue the subtitle is the
only thing that makes the title usable, and the API gives us no hint that a subtitle exists.

## What actually ships from the API today

Probing the live proxy (`https://cdnd.ehsanfazli.ir/api/movie/by/filtres/0/created/0`) shows the shape
we have to work with. A source is only ever:

```json
{ "id": 513950, "quality": "720 زیرنویس", "type": "mkv", "url": "http://peer.tci.cdn.../movie.mkv" }
```

There is **no subtitle URL field anywhere**: not on the poster, not on the source, not on the episode.
The only signal is human-readable text inside `quality`:

| `quality` label | count in one page | meaning |
| --- | --- | --- |
| `720 زیرنویس` | 22 | Persian subtitle |
| `1080 زیرنویس` | 20 | Persian subtitle |
| `480 زیرنویس` | 12 | Persian subtitle |
| `480 دوبله پارسی` | 5 | Persian dub, no subtitle needed |
| `تیزر` | 18 | trailer |

So subtitles come from two places, and they need different handling:

1. **Muxed into the container** — filenames show `SoftSub` (a track inside the MKV) or `HardSub`
   (burned into the picture). A soft track can be selected; a hard one is already visible and must
   not be double-handled.
2. **Sidecar files we would have to find ourselves** — nothing tells us the URL.

`2_2` of the sources on one page are `.mkv`. That matters because **iOS `AVPlayer` does not play MKV**,
so the biggest part of the catalogue is already unplayable on iPhone, subtitles or not.

## Platform reality (verified against the installed version)

`expo-video@58.0.11` exposes subtitle APIs, but they are **Android and iOS only**. The type
declarations say so explicitly (`@platform android`, `@platform ios`), and in
`node_modules/expo-video/build/VideoPlayer.web.js` the properties are inert stubs:

```js
subtitleTrack = null;
availableSubtitleTracks = [];
```

There is no `createElement('track')` anywhere in the web build. **On the web, `player.subtitleTrack`
does nothing.** Any design that assumes it works everywhere will be wrong on the surface where the
most users land first.

Additionally, the web app deliberately hands playback off to external players (see
`webHandsOff` in `src/external/actions.ts`), so the in-app renderer only matters on native and on the
Electron desktop app (whose page is `app://vispar`, not a plain HTTPS page).

## Proposed approach

Two complementary layers, shipped together because either alone leaves a visible hole.

### Layer 1 — Embedded tracks (native)

Use `player.availableSubtitleTracks` and `player.subtitleTrack` as intended. This covers MKV soft
tracks on Android, which is where most users are.

- React to `availableSubtitleTracksChange` and keep the list in state.
- Default to a Persian track (`language` starting with `fa` or `per`) when one exists.
- Expose a selector in the player menu.

### Layer 2 — Sidecar subtitles (all platforms, including web)

A subtitle is treated as data we own, not as a player feature:

- Fetch the `.srt`/`.vtt`, parse it, and render cues in our own overlay.
- This is the only path that works on web, and the only path that works when the container has no
  soft track.
- It also makes styling, RTL and timing offset possible, which `expo-video` does not offer.

Because the API supplies no subtitle URLs, the user must be able to add one. Two sources for that:

- **Automatic probe** — the conventional sidecar name next to the video
  (`<same-name>.srt`, `.fa.srt`, `.vtt`) with a short timeout. Best-effort, never blocking.
- **Manual** — paste a URL, or pick a local file via `expo-document-picker` (not currently a
  dependency). Remember the choice per title so it is not asked again.

## Scope of changes

| Area | File | Change |
| --- | --- | --- |
| Parsing | `src/lib/subtitles/parse.ts` (new) | SRT and WebVTT to cue list; tolerant of BOM, CRLF, malformed timestamps |
| Loading | `src/lib/subtitles/load.ts` (new) | Fetch with timeout and size cap, plus the sidecar-name probe |
| Rendering | `src/components/SubtitleOverlay.tsx` (new) | Cue renderer driven by current time, RTL aware, safe margins |
| Storage | `src/lib/subtitles/store.ts` (new) | Chosen subtitle per title and per language, in the existing persisted store |
| Player | `src/app/player.tsx` | Track list, `subtitleTrack` wiring on native, overlay on all platforms |
| Menu | `src/app/player.tsx` | New `subtitles` menu: off / embedded tracks / sidecar / offset |
| Settings | `src/settings/store.ts` | Font size, background opacity, edge style, default language, "prefer Persian" |
| Settings UI | `src/app/(tabs)/settings.tsx` | A "Subtitles" section with a live preview |
| Types | `src/api/types.ts` | Optional `subtitles` on `Source`, so a future API can supply URLs without a redesign |

A new `Menu` member, `'subtitles'`, follows the existing `'quality' | 'speed' | 'more'` pattern, so
the player's structure does not change.

## Settings to add

| Setting | Type | Default | Why |
| --- | --- | --- | --- |
| `subtitlesEnabled` | boolean | `true` | Master switch |
| `subtitleLanguage` | `'fa' \| 'en' \| 'auto'` | `'fa'` | Persian-first, matching the product |
| `subtitleSize` | `'sm' \| 'md' \| 'lg'` | `'md'` | Small screens vs. TV |
| `subtitleBackground` | `'none' \| 'soft' \| 'solid'` | `'soft'` | Legibility over bright scenes |
| `subtitleOffsetMs` | number | `0` | Sync correction, ±30 s in 250 ms steps |

All go through the existing `migrateSettings`, so old installs keep working and unknown values fall
back to defaults.

## Risks

1. **Web has no native subtitle support.** Must be stated plainly: Layer 2 is the only web path, and
   the web build hands playback to external players anyway.
2. **No subtitle URLs from the API.** Automatic probing will often find nothing. Manual entry is not
   a nicety, it is the primary path.
3. **CORS on sidecar fetch.** A `.srt` on a third-party host will usually fail to fetch in a browser.
   Needs a clear error rather than a silent no-subtitle state, and possibly a pass-through on our own
   proxy later.
4. **MKV on iOS.** Not caused by this work, but it becomes visible next to it. Out of scope here;
   tracked separately.
5. **Burned-in subtitles.** `HardSub` files already show text. Enabling our overlay on top would
   double it, so the automatic probe must not fire for those.
6. **Timing drift.** Our overlay is driven by `timeUpdate`, which ticks every 0.5 s today
   (`timeUpdateEventInterval`). Cue boundaries would visibly lag. Needs a smoother clock for the
   overlay than the one used for progress saving.
7. **Right-to-left mixing.** Persian cues with Latin fragments (names, numbers) need bidi handling,
   or the text renders in the wrong order.
8. **Performance.** A 2000-cue file must not re-render the tree on every tick. Cue lookup has to be a
   seek, not a filter.

## Acceptance criteria

- [ ] On Android, an MKV with an embedded Persian track shows it in the subtitle menu and plays it.
- [ ] On web and desktop, a sidecar `.vtt`/`.srt` renders in our own overlay, in sync.
- [ ] With no subtitle found, the player says so and offers "add a subtitle" instead of failing quietly.
- [ ] Settings persist across restarts and survive an upgrade from an older settings blob.
- [ ] Offset adjustment of ±30 s visibly changes sync and is remembered per title.
- [ ] A 2000-cue file scrolls and seeks without dropping frames.
- [ ] Persian cues are correct in RTL; mixed Latin text stays in reading order.
- [ ] `npm run typecheck` and `npm test` stay clean.

## Out of scope

- OpenSubtitles or any third-party subtitle search service.
- Automatic translation.
- Subtitle extraction from an MKV container (we would need a demuxer; not justified yet).
