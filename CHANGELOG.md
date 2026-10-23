# Changelog

All notable changes to Vispar. The format follows [Keep a Changelog](https://keepachangelog.com/), and the project uses semantic versioning.

## [Unreleased]

### Fixed

- **iOS artifact names** ([#9](https://github.com/TssHack/vispar/issues/9)): the packaged app was called `wyspar.app` (Expo's transliteration of the Persian app name), so the documented `Vispar.app` commands did not match. The simulator zip and the IPA now contain `Vispar.app`, and the workflow log prints the archive layout.

### Added

- **iOS builds** ([#7](https://github.com/TssHack/vispar/issues/7)): a CI workflow that builds the iOS Simulator app (`Vispar-<version>-ios-simulator.zip`) and an unsigned iPhone/iPad IPA (`Vispar-<version>-ios-unsigned.ipa`) and attaches them to a release. The IPA must be re-signed (AltStore, Sideloadly, or your own certificate) to install on a device.

## [2.3.0] - 2026-10-20

### Added

- **Subtitles in the built-in player** ([#3](https://github.com/TssHack/vispar/pull/3)): embedded tracks on Android/iOS, sidecar `.srt`/`.vtt` files on every platform, Persian-first language choice, size and background settings with a live preview, per-title choice and a sync offset.

### Fixed — subtitles review ([#4](https://github.com/TssHack/vispar/issues/4))

The subtitles feature from [#3](https://github.com/TssHack/vispar/pull/3) shipped with these defects; all are fixed here.

- **Player screen crashed into a render loop.** `useSubtitleChoice` returned a *new* `{}` on every call when a title had no saved choice, so `useSyncExternalStore` kept seeing a "changed" snapshot and React gave up with *Maximum update depth exceeded* (error #185). On the web the player rendered blank; on native it would crash the player for any title without a saved subtitle choice. It now returns one shared frozen empty value, with a regression test on the selector.
- **Windows-1256 Persian subtitles showed as garbage.** Files were always decoded as UTF-8. They are now read as bytes and sniffed: UTF-8 (with or without BOM), UTF-16 with BOM, otherwise Windows-1256 through a built-in table (Hermes only has a UTF-8 `TextDecoder`). Arabic `ي`/`ك` from those files are normalised to Persian `ی`/`ک`.
- **The most common sidecar name was never tried.** The default probe tries two names, but `Movie.srt` was fourth in the list. The order is now `.fa.srt`, `.srt`, `.persian.srt`, `.fa.vtt`, `.vtt`.
- **"Off for this title" was ignored for sidecar subtitles.** Turning subtitles off removed the saved URL, which re-ran the probe and showed the sidecar again; the saved "off" was also not read on the next play. The decision now lives in one pure function (`planSidecar`) where "off" wins over everything, and the menu has a **Turn subtitles on** row to undo it.
- **Subtitles from the previous episode could remain.** Cues were only replaced on a successful load, and the hook survives the next-episode `router.replace`. State is now reset when the title changes, and results of superseded requests are discarded.
- **Sync buttons moved subtitles the wrong way.** The labels said "later/ahead" but the maths did the opposite. They now read **Subtitles earlier / later · 0.5 s** and match what they do.

### Changed

- The subtitle choice store re-inserts a title on every update, so a title you use daily is no longer evicted first when the 500-entry cap is reached.
- The control-bar subtitle label says "فارسی" only for Persian-named sidecars, and "روشن" otherwise.
- The subtitle overlay is no longer an accessibility live region: it repeated the audio and made screen readers talk over it.
- Code tidy-ups in the player (imports order, a redundant wrapper) and in settings (a merged line).

### Tests

- New `tests/subtitles-review.test.ts`: cp1256, UTF-8/UTF-16 detection, loading a cp1256 file end to end, probe order, the sidecar decision table, selector identity (the render-loop regression) and store ordering.
- 85 tests pass.

## [2.2.0] - 2026-10-17

### Added

- New-episode notifications for series in *My list* and series being watched.
- MIT license.

## [2.1.4]

### Added

- Clearer playback errors with a copy-details button; the web player tries HTTPS when the host offers it.

## [2.1.3]

### Fixed

- Playback on Android (cleartext HTTP allowed), desktop relay for HTTP media, and an explanation for blocked media on HTTPS web.

## [2.1.2] and earlier

- Android x86_64 builds, health-based startup check, update checks for every platform, PWA, notifications, TV remote support, desktop apps and the splash screen. See the [releases](https://github.com/TssHack/vispar/releases).
