# Changelog

All notable changes to Vispar. The format follows [Keep a Changelog](https://keepachangelog.com/), and the project uses semantic versioning.

## [Unreleased]

### Fixed

- **iPhone: new versions are announced again** ([#89](https://github.com/TssHack/vispar/issues/89)). The iOS app never checked for updates, and "check for updates" always said it was up to date. It now checks the releases like Android does. It offers the new `.ipa` and says to install it with AltStore, SideStore or Sideloadly, as before. Safari and the home-screen web app are unchanged: they always run the latest version.

## [2.5.0] - 2026-11-26

### Added

- **Linux: `.rpm` for Fedora and `.pacman` for Arch** in every release, next to the AppImage and `.deb`. Install with `sudo dnf install ./Vispar-*.rpm` or `sudo pacman -U Vispar-*.pacman`.
  - The Arch package lists dependencies that exist in the Arch repositories. electron-builder's defaults include `http-parser`, which is only in the AUR, so `pacman -U` would refuse the package.
  - The `.rpm` skips `/usr/lib/.build-id` links, so it does not conflict with other Electron apps on Fedora.
- **`npm run test:linux-packages`**: installs the built Linux packages on clean Arch, Fedora, Debian and Ubuntu containers (Docker or Podman, on your machine) and checks that each installs with its package manager, has no missing library, has its menu entry and icons, and opens its window. It is how the ALSA bug below was found.

### Changed

- **Linux: the update offer matches how you installed Vispar.** A `.deb`, `.rpm` or `.pacman` install is offered the same format, so your package manager keeps tracking it; an AppImage gets the AppImage. The update sheet names the format and shows the command that installs the file. When the release has no file of that format, or the app cannot tell, it offers the AppImage as before.
- **Desktop apps without 53 unused Chromium languages.** Electron ships its own interface strings in 55 languages (44 MB); the app has no Chromium menus and is in Persian, so only `fa` and `en-US` (Chromium's fallback) are kept. Measured on Linux: installed size 42 MB smaller; AppImage 110 → 99 MB, `.deb` 86 → 78 MB, `.rpm` 77 → 70 MB, `.pacman` 78 → 71 MB. Checked with a Persian and a German system language: the app opens and works in both.
- **Smaller desktop apps.** The web build prerenders 18,000 title pages, list pages and a sitemap for search engines; the desktop packages carried all of them, but the desktop app never opens them (it serves `index.html` for every route). They are now left out, with `og.png`, `robots.txt` and `app.html`. Measured on Linux: installed size 506 → 286 MB, AppImage 150 → 111 MB, `.pacman` 87 → 79 MB.
- **The web app and PWA stop downloading the app again on every visit.** The service worker served the cached JavaScript and fonts but also fetched every one of them again in the background, so each visit downloaded the whole app (about 1.5 MB) for nothing. Those files have the content hash in their name and never change, so they now come from the cache alone. Measured over three loads: 30 downloads of the hashed files before, 10 after (each once). Old files from earlier releases are removed from the cache instead of piling up. Icons, whose names do not change, still refresh in the background.
- **Web, PWA and desktop load the fonts in half the size.** The first screen waits for all five Arad weights; they are now WOFF2 (126 KB) instead of TTF (290 KB), with identical glyphs. Android and iOS keep the TTF files. `scripts/build-fonts.py` writes both.
- **A smaller web bundle.** `expo-notifications`, `expo-updates` and `expo-intent-launcher` only work on Android and iOS, but the web build bundled them because they were imported unconditionally. The web build now gets small platform stubs instead (`*.web.ts`): the shared chunk is 406 → 320 KB (106 → 87 KB gzipped), and none of the three modules is in the web bundle. Native builds are unchanged; web notifications already used the browser's Notification API.

### Fixed

- **Resuming from "Continue watching" opened the end screen** ([#86](https://github.com/TssHack/vispar/issues/86)). The player opens before it knows the file, and the empty player reported "finished" at once. The "پایان" screen then covered the film and the resume prompt, and both of its buttons started from the beginning. Now the player offers to resume, and "ادامه" goes to the saved spot. On TV the prompt keeps the remote's focus and stays up for 15 seconds.
- **Subtitles no longer drop lines in fast dialogue.** When a line started before the previous one ended, only the first was shown; a short reply inside a longer line never appeared. Overlapping lines now show together, and lines appear and disappear on their exact times instead of up to half a second late. A line of an MKV subtitle that failed to download is tried once more at the end, instead of staying missing for the whole film.
- **Android TV: a mouse (air mouse) can seek.** Clicking or dragging the seek bar goes to that point; it used to only pause. A click on the video while the controls are hidden brings them back. The remote works as before.
- **Android TV: the "play with…" sheet takes the remote's focus** when it opens.
- **Linux: the app icon was missing in GNOME (and other desktops).** Only a 1024×1024 icon was installed, and the hicolor icon theme has no folder for that size. Every Linux package now installs 16 to 512 px icons, generated from the logo by `scripts/build-icons.js`.
  - The window icon file was never packaged, so the window and task switcher had no icon either. It is now inside the app.
  - The running window is now tied to its menu entry (`desktopName`, so `StartupWMClass` and the window class are both `vispar-desktop`). Checked on X11; GNOME on Wayland is checked by installing the package.
- **Linux: the `.deb` did not start on a minimal Debian or Ubuntu** (`libasound.so.2` not found). It never listed ALSA as a dependency; desktops usually have it, so it went unnoticed until the package was installed on a clean system. The `.deb` now depends on `libasound2t64` (Ubuntu 24.04, Debian 13) or `libasound2` (older releases), in that order: on Ubuntu 24.04 the name `libasound2` resolves to an OSS emulation library that lacks ALSA functions, and the app crashed at start. The `.rpm` now depends on `alsa-lib`, which Fedora only had because another package pulled it in.
- **Desktop builds no longer depend on finding the git remote.** Without it, electron-builder 26 built every file and then exited with an error (`Cannot read properties of null (reading 'channel')`). `desktop/package.json` now names the repository.

## [2.4.2] - 2026-11-21

### Fixed

- **iOS: MKV files play in the built-in player again** ([#58](https://github.com/TssHack/vispar/issues/58), [#59](https://github.com/TssHack/vispar/pull/59)). 2.4.0 refused MKV on iPhone and iPad *before trying* and sent you to VLC/Infuse. That was based on an assumption about Apple's player that was never checked on a device, and on real iPhones those files had been playing.
  - The file is always tried again, at the quality you chose, with its embedded subtitle (2.4.1).
  - If an MKV really cannot play on your device, the player says so and puts *play with another player* first.

## [2.4.1] - 2026-11-21

Every item here was checked on the official Android TV emulator image, and the subtitle fix with a real catalogue file.

### Fixed

- **Android TV: Movies, Series, Search and Library rendered blank** ([#52](https://github.com/TssHack/vispar/issues/52), [#55](https://github.com/TssHack/vispar/pull/55)). The TV fork of React Native wraps every list in a focus guide with no size, so a full-screen list collapsed to 2 dp. That is why the list pages were empty while Home and Settings worked. It was already broken in 2.3.0. The TV build now gives that wrapper the list's size, and fails the build if the fork's code changes.
- **Android TV: the remote did nothing in the player** ([#53](https://github.com/TssHack/vispar/issues/53), [#55](https://github.com/TssHack/vispar/pull/55)). There were two causes:
  - Android TV sends a press only as a key-up by default, and the app ignored key-ups.
  - With the controls hidden, nothing had focus, and Android delivers keys only along the focused path.

  Left/right now seek ±10 s per press (and repeat while held), the controls open with the seek bar focused, and Play/Pause toggles exactly once.
- **Subtitles inside MKV files now show in the built-in player, on every platform** ([#54](https://github.com/TssHack/vispar/issues/54), [#56](https://github.com/TssHack/vispar/pull/56)). Most of the catalogue (`SoftSub`, `زیرنویس`) carries the subtitle inside the MKV. VLC showed it; the app said "no subtitle", or on Android drew it tiny.
  - The app now reads the subtitle straight from the file with small range requests, without downloading the film, starting with the lines around the playback position.
  - It draws the subtitle in its own overlay, with your size, background and sync settings.
  - Works with mkvmerge and ffmpeg files; SubRip, ASS/SSA and WebVTT tracks; UTF-8 and Windows-1256 text.
  - Checked with a real 860 MB catalogue file on the Android TV emulator and in the browser.
  - Reading the subtitle never takes more than two connections, so the video keeps streaming. Each request is retried after a stall.

## [2.4.0] - 2026-11-21

### Fixed: subtitles, at the root ([#49](https://github.com/TssHack/vispar/issues/49), [#50](https://github.com/TssHack/vispar/pull/50))

Most of the catalogue is MKV with the subtitle *inside* the file (`SoftSub`, `زیرنویس`). That path never worked:

- **Embedded tracks never reached the app.** The track list was read once, before the file had loaded, and nothing listened for `expo-video`'s `sourceLoad` / `availableSubtitleTracksChange`. The menu said "no subtitle found" for files that have a Persian track, and no track was ever selected. The player's events now drive the list.
- **"Off" was only remembered, never applied.** The native player selects a track flagged *default* in the file on its own, so it kept showing after subtitles were turned off globally or for one title. "Off" now sets the player's track to none, and the menu mirrors what the player really shows (`subtitleTrackChange`).
- **Two subtitles at once.** The sidecar search ran before the tracks were known, so a found `.srt` was drawn on top of the embedded track. The search now waits for the tracks (with an 8 s timeout), and only one subtitle is visible at a time.
- **Better track choice:** the language picked for that title before, then Persian by language code *or* track name ("Farsi", "فارسی", `per`/`fas`), preferring the default-flagged track. The menu shows the file's own track names.
- **The menu promised a feature that did not exist.** "Not found" pointed to adding a subtitle from a link, but nothing could. The menu now has **چسباندن لینک زیرنویس** (paste a `.srt`/`.vtt` link from the clipboard), and shows "searching" while it is still looking.
- Known limits, recorded in #49: `expo-video` drops subtitle tracks that have no language tag, and embedded subtitles follow the system caption style rather than the app's size and background settings.

### Fixed: Android TV ([#47](https://github.com/TssHack/vispar/issues/47), [#48](https://github.com/TssHack/vispar/pull/48))

- **Focus was invisible on every button.** Buttons clipped their own focus ring. The hero slider dots had no focus state at all.
- **Focus jumped on its own.** A virtualised list's first poster pulled focus back to the top when it remounted, and every route change pulled focus into the side rail. Lists now ask for initial focus only once.
- **Search trapped the remote.** On TV the text field no longer takes focus and opens the keyboard by itself.
- **Seeking with the remote** works repeatedly: left/right with the controls hidden open them with the seek bar focused, and the bar keeps left/right for seeking. The speed, quality and subtitle menus focus their selected row.
- **Layout on a 1080p TV (960×540 dp):** the side rail fits (Settings was cut off), grids no longer overflow by 16 dp, and the hero leaves room for the first rail.
- **Picture-in-picture is off on TV.**
- **The TV APK is built on the stable TV fork that matches React Native exactly** (`react-native-tvos@0.88.1-0`). It was a hand-pinned release candidate, `0.88.0-0rc2`. The version now comes from `package.json` (`scripts/tvos-version.js`).

### Added

- **Recent searches** when the search box is empty, with remove and clear-all ([#26](https://github.com/TssHack/vispar/issues/26)).
- **Library backup and restore through the clipboard** (Settings → Data): the list and history, merged on restore, source URLs never included ([#32](https://github.com/TssHack/vispar/issues/32)).
- **Crash screen instead of a blank page,** with *Try again*, *Back* and *Copy details*. A crash in the player returns to the previous screen ([#14](https://github.com/TssHack/vispar/issues/14)).
- **Web link previews** (Open Graph and Twitter card), a real `robots.txt` and `sitemap.xml`, and `dir="rtl"` on the document ([#24](https://github.com/TssHack/vispar/issues/24)).
- **iOS builds** ([#7](https://github.com/TssHack/vispar/issues/7)): CI builds the iOS Simulator app (`Vispar-<version>-ios-simulator.zip`) and an unsigned iPhone/iPad IPA (`Vispar-<version>-ios-unsigned.ipa`). The IPA must be re-signed (AltStore, Sideloadly or your own certificate) to install on a device.
- **Docs:** a guide to sign and install the unsigned iOS IPA from Linux with xtool and a free Apple ID ([#11](https://github.com/TssHack/vispar/issues/11)).

### Changed

- **iOS: MKV files are no longer handed to the built-in player** (part of [#6](https://github.com/TssHack/vispar/issues/6)). Apple's player cannot decode MKV, about 89% of the catalogue's full-length files. The app picks a full-length MP4 when one exists, otherwise *Play* opens the external-player chooser with an explanation. Android, desktop and web behave as before.
- **Descriptions show the synopsis** and the useful fields (director, stars, language, age rating), not the catalogue's info card ([#20](https://github.com/TssHack/vispar/issues/20)).
- **Short quality labels** (`1080p`) in the play button, the player pill and the source badge, so they are not clipped on phones ([#22](https://github.com/TssHack/vispar/issues/22)).
- **Dependencies:** Expo SDK 58 patch releases, React Native 0.88.1 and react-query 5.108. Every package is back on the version SDK 58 expects, and Dependabot no longer moves Expo's exact pins ([#44](https://github.com/TssHack/vispar/issues/44)). The CI actions are on their current major versions.

### Fixed

- **A connection lost after launch** is detected: the screen stays, a banner shows, and failed rows reload when the connection returns ([#16](https://github.com/TssHack/vispar/issues/16)).
- **Settings and library changes are saved** when the app goes to the background or the page is hidden. A change made just before closing could be lost ([#18](https://github.com/TssHack/vispar/issues/18)).
- **iOS artifact names** ([#9](https://github.com/TssHack/vispar/issues/9)): the packaged app was `wyspar.app`. It is now `Vispar.app`.

### Project

- Issue and PR templates, Dependabot, and a security policy ([#30](https://github.com/TssHack/vispar/issues/30)). CI runs with a read-only token and a 15-minute timeout, and cancels superseded PR runs ([#28](https://github.com/TssHack/vispar/issues/28)).

### Not verified before release

- The Android TV changes and the embedded-subtitle path need a real device. Their checklists are in #47 and #49. The web build was tested in a browser, including the TV preview (`?tv=1`, 960×540) and a Windows-1256 sidecar subtitle.

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
