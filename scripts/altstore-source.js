#!/usr/bin/env node
// Writes the SideStore / AltStore source for Vispar (#95): a JSON file those apps read to show the
// app, its newest version and its notes, and to update it with one tap.
//
// The iOS workflow runs this for every release tag and attaches the result to the release, so the
// source always lives at the same address:
//   https://github.com/TssHack/vispar/releases/latest/download/altstore-source.json
//
// Usage: node scripts/altstore-source.js <path to the .ipa> > altstore-source.json
const fs = require('node:fs');
const path = require('node:path');

const REPO = 'TssHack/vispar';
const SOURCE_URL = `https://github.com/${REPO}/releases/latest/download/altstore-source.json`;
const ICON_URL = 'https://vispar.ehsanfazli.ir/icons/icon-512.png';
const TINT = 'F2B544';

/** The section of one version from CHANGELOG.md, as plain text (bold and links removed). */
function changelogNotes(changelog, version) {
  const start = changelog.indexOf(`## [${version}]`);
  if (start < 0) return '';
  const rest = changelog.slice(start).split('\n').slice(1);
  const end = rest.findIndex((l) => /^## \[/.test(l));
  return (end < 0 ? rest : rest.slice(0, end))
    .join('\n')
    .replace(/^#{3,}\s*(.+)$/gm, '$1:')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The source document. Pure, so it is unit tested (tests/altstore-source.test.ts). */
function buildSource({ version, date, size, notes, minOSVersion = '15.1' }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`not a release version: ${version}`);
  if (!(size > 0)) throw new Error('the .ipa size is missing');
  const downloadURL = `https://github.com/${REPO}/releases/download/v${version}/Vispar-${version}-ios-unsigned.ipa`;
  return {
    name: 'Vispar',
    identifier: 'ir.ehsanfazli.vispar.source',
    sourceURL: SOURCE_URL,
    subtitle: 'فیلم و سریال، هر جا و هر دستگاه',
    description: 'ویسپار؛ تماشای فیلم و سریال با زیرنویس فارسی.',
    iconURL: ICON_URL,
    website: 'https://vispar.ehsanfazli.ir',
    tintColor: TINT,
    apps: [
      {
        name: 'Vispar',
        // The bundle id the app is built with; SideStore adds its own suffix when it signs it.
        bundleIdentifier: 'com.fazli.vispar',
        developerName: 'Ehsan Fazli',
        subtitle: 'فیلم و سریال با زیرنویس فارسی',
        localizedDescription: 'تماشای فیلم و سریال با زیرنویس فارسی و دوبله، با پلیر داخلی، زیرنویس داخل فایل MKV، ادامه از جای قبلی و پخش با VLC و Infuse.',
        iconURL: ICON_URL,
        tintColor: TINT,
        category: 'entertainment',
        // Kept for older AltStore/SideStore versions, which read these top-level fields.
        version,
        versionDate: date,
        versionDescription: notes,
        downloadURL,
        size,
        versions: [{ version, buildVersion: '1', date, localizedDescription: notes, downloadURL, size, minOSVersion }],
        appPermissions: { entitlements: [], privacy: {} },
      },
    ],
    news: [],
  };
}

if (require.main === module) {
  const ipa = process.argv[2];
  if (!ipa || !fs.existsSync(ipa)) {
    console.error('usage: node scripts/altstore-source.js <path to the .ipa>');
    process.exit(1);
  }
  const root = path.join(__dirname, '..');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.version;
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const source = buildSource({
    version,
    date: new Date().toISOString().slice(0, 10),
    size: fs.statSync(ipa).size,
    notes: changelogNotes(changelog, version),
  });
  process.stdout.write(`${JSON.stringify(source, null, 2)}\n`);
}

module.exports = { buildSource, changelogNotes, SOURCE_URL };
