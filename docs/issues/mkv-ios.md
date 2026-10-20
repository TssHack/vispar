## Problem

On iPhone and iPad, roughly three quarters of the catalogue cannot be played at all.

The sources are mostly MKV, and Apple's `AVPlayer` — which is what `expo-video` uses on iOS — does not
decode MKV. The app currently tries, fails, and shows a generic error, so the user has no way to know
whether the link is broken, the network dropped, or the format is simply unsupported.

## Evidence from the live catalogue

Sampled the first page of movies from the deployed proxy
(`https://cdnd.ehsanfazli.ir/api/movie/by/filtres/0/created/0`, 30 titles):

| Container | Sources | Share |
| --- | --- | --- |
| MKV | 67 | **77%** |
| MP4 | 20 | 23% |

Those MP4 entries are almost all trailers (`تیزر`). Broken down by title:

| Titles with | Count | Share |
| --- | --- | --- |
| MKV and MP4 both | 18 | 60% |
| **MKV only** | **10** | **33%** |
| MP4 only | 0 | 0% |

Two conclusions follow, and they point at different fixes:

1. **A third of titles have no playable source on iOS at all.** Only an MKV decoder fixes these.
2. **Two thirds have an MP4 alongside the MKV.** For those, preferring the MP4 on iOS solves the
   problem with no native work. Today the app picks by quality only, so it can hand `AVPlayer` an MKV
   while a perfectly good MP4 sits in the same list.

Sample filenames, for reference:

```
mkv | 720 زیرنویس  | Three.Goodbyes.2025.720p.BluRay.x264.AAC-YTS.SoftSub.mkv
mkv | 720 زیرنویس  | By.Any.Means.2026.720p.WEB-DL.YIFY.Farsi.Sub.Film2Media.mkv
mkv | 480 زیرنویس  | Ghabadkund.2026.Marathi.480p.WEBDL.HardSub.mkv
mp4 | تیزر          | Ghabadkund - Trailer.mp4
```

## Proposed approach

Split into two PRs, because the cheap half should not wait for the expensive half.

### PR 1 — Fail clearly, and prefer what can play (no native work)

- **Detect unsupported containers per platform.** A small helper next to `isStreamOnly` in
  `src/lib/format.ts`: MKV is unplayable on iOS, and on the web it depends on the browser (Chrome and
  Edge generally can, Safari cannot).
- **Prefer a playable source in `pickSource`.** When several qualities exist, skip containers the
  current platform cannot decode, then apply the existing quality preference. If nothing playable
  remains, say so rather than handing over a broken URL.
- **Explain instead of failing silently.** The player's error screen already has a retry-with-another-
  quality button; give it the real reason ("این فایل MKV است و iOS آن را پخش نمیکند") and offer
  "بازکردن با پلیر دیگر", which already exists for external players.
- **Show it in the source list.** An MKV row on iOS should be marked as not playable in-app, with the
  external-player action as the primary one. The user should not discover this by tapping.

This alone fixes two thirds of the affected titles and removes the confusion for the rest.

### PR 2 — Research: real MKV playback on iOS

Out of scope for PR 1, and it needs a decision before code:

- **Options:** bundle libmpv (or VLCKit) as a native module, or hand MKV to an external player only.
- **Costs to weigh:** app size (tens of MB), App Store review, licensing (VLCKit is LGPL/GPL
  depending on build), and the fact that this project currently has no native modules of its own.
- **Deliverable of the research PR:** a written comparison with a recommendation, not an implementation.

## Acceptance criteria (PR 1)

- [ ] On iOS, a title with both MKV and MP4 picks the MP4 automatically.
- [ ] On iOS, a title with only MKV shows a clear, specific message instead of a generic playback error.
- [ ] The source list marks unplayable containers before the user taps one.
- [ ] Android and the Electron desktop app keep their current behaviour: MKV plays there.
- [ ] Web behaviour is unchanged (playback already hands off to external players).
- [ ] Container detection handles the URL form actually in use: `.mkv` with and without a query
      string, and percent-encoded filenames.
- [ ] Unit tests cover the preference logic and the detection helper; `tsc` and `vitest` green.
- [ ] PR reviewed on the PR itself before merge, per `AGENTS.md`.

## Risks

1. **Preferring MP4 can lower quality.** A 480p MP4 is not a better experience than a 1080p MKV on a
   device that could play it. The preference must apply **only** where the container is genuinely
   unplayable, never as a general ranking rule.
2. **Detection can be wrong.** Some sources have no extension, or a misleading one. A wrong "cannot
   play" verdict is worse than a failed attempt, so detection should be conservative and the external
   player must always remain reachable.
3. **iOS is not the only gap.** This does not touch the fact that the web build cannot play these
   files inline either; that is a deliberate product decision (`webHandsOff`).
4. **`pickSource` is shared** by the detail screen, the player's fallback, and next-episode autoplay.
   Changing its signature touches all three; it needs the platform as an explicit input, not a global
   read, so it stays testable.

## Out of scope

- Bundling a native decoder (that is PR 2).
- Transcoding or remuxing on the proxy.
- Downloading and playing locally.
