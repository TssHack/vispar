# Install the iOS build from Linux (xtool, free Apple ID)

The release ships `Vispar-<version>-ios-unsigned.ipa`. Apple only runs signed apps on a real iPhone or iPad, so the file has to be **signed with your own Apple ID** before it installs. This guide does that from Linux with [xtool](https://github.com/xtool-org/xtool).

> **Status: not tested end to end.** The steps below follow xtool's own documentation. The IPA itself was inspected (bundle id `com.fazli.vispar`, device families iPhone and iPad, unsigned), but nobody has yet run these commands against a phone. If something differs on your machine, run `xtool help <command>` and trust that over this page, then please send a correction (issue #11).

## What a free Apple ID can and cannot do

| | Free Apple ID | Paid Apple Developer Program |
| --- | --- | --- |
| Install on your own devices | Yes | Yes |
| Signature lasts | **7 days**, then the app stops opening until you sign it again | 1 year |
| Apps you can have signed at once | A small number (Apple limits it; currently 3) | Not limited this way |
| TestFlight / App Store | No | Yes |
| xtool login mode | Password | API key or password |

Re-signing is just running the install command again with the same IPA.

## 1. Prepare the phone

1. iOS 16.4 or newer (the app's minimum).
2. **Settings → Privacy & Security → Developer Mode → On**, then restart (needed on iOS 16 and later).
3. Plug the phone in with a cable and tap **Trust This Computer**.

## 2. Install the requirements on Linux

```bash
# Debian/Ubuntu. On Arch/CachyOS: sudo pacman -S usbmuxd libimobiledevice
sudo apt-get install usbmuxd libimobiledevice-utils
```

xtool also needs:

- the **Swift toolchain** (see <https://swift.org/install/linux>),
- a copy of **`Xcode.xip`** downloaded in a browser from Apple's developer downloads page (it asks for an Apple ID). `xtool setup` extracts the SDK from it. This is a multi-gigabyte download that is only used locally.

## 3. Install xtool

```bash
curl -fL "https://github.com/xtool-org/xtool/releases/latest/download/xtool-$(uname -m).AppImage" -o xtool
chmod +x xtool
sudo mv xtool /usr/local/bin/
xtool --help
```

## 4. Set it up with your Apple ID

```bash
xtool setup
```

- Choose the **password** login mode (the API-key mode needs a paid membership).
- Enter your Apple ID, password and two-factor code **only in xtool's own prompt**. The password login uses private Apple APIs, so consider a separate Apple ID created for sideloading.
- When asked, give the path to `Xcode.xip`.

## 5. Install the IPA

Check the exact flags first, because they are the part that may change between versions:

```bash
xtool help install
xtool install Vispar-<version>-ios-unsigned.ipa
```

xtool signs the app with a development certificate tied to your Apple ID and installs it on the connected phone.

## 6. Trust the developer on the phone

If iOS says **Untrusted Developer**: **Settings → General → VPN & Device Management → your Apple ID → Trust**. The app can then be opened from the Home Screen.

## Troubleshooting

| Symptom | Things to try |
| --- | --- |
| Phone not found | `systemctl status usbmuxd`, a different cable or port, unplug and re-trust the computer, `ideviceinfo` (from `libimobiledevice-utils`) should print device info |
| Login fails or loops | Check the two-factor code, try again after a few minutes, or use a separate Apple ID |
| App installs but will not open | Developer Mode off, developer not trusted, or the 7-day signature has expired: sign and install again |
| "Maximum number of apps" | Remove another sideloaded app, or wait for Apple's limit to reset |
| Entitlement errors | Some capabilities need a paid membership; the app only needs the basic ones for a free install |

## Alternatives

- **AltStore / Sideloadly** on a Mac or Windows computer (free Apple ID, same 7-day limit).
- **Your own certificate and provisioning profile** with a signing tool such as [zsign](https://github.com/zhlynn/zsign), if you have a paid account.
- The **web app** (`vispar.ehsanfazli.ir`) installs from Safari with *Add to Home Screen*, no signing needed.

## Known limits of the iOS build

- Matroska (`.mkv`) files do not play in the built-in player on iOS (`AVPlayer` has no MKV support). Use *Play with…* and pick VLC, Infuse or nPlayer.
- The app has not yet been launched on a device by the maintainers: report what you see.
