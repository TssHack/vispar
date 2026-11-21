#!/usr/bin/env node
/**
 * Fixes blank FlatList screens on Android TV (#52).
 *
 * `@react-native-tvos/virtualized-lists` wraps every list's ScrollView in a `TVFocusGuideView` when
 * `Platform.isTV`, and gives that wrapper no style. The list's own `style={{ flex: 1 }}` lands on the
 * ScrollView inside it, so the wrapper sizes to nothing and a full-screen list collapses to 0 dp:
 * every FlatList-based screen (catalogue grids, search, library) rendered blank on TV, while
 * ScrollView screens (home, settings) worked.
 *
 * This hands the list's flex sizing to the wrapper as well. It runs in the TV build right after the
 * fork is installed, and fails loudly if the code it patches has changed, so a fork upgrade cannot
 * silently bring the blank screens back.
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '/* vispar: TV focus guide takes the list size */';
const NEEDLE = '<TVFocusGuideView\n            {...trapFocusHorizontal}';

/** Returns the patched source, the same source when already patched, or throws when the shape changed. */
function patchSource(src) {
  if (src.includes(MARKER)) return src;
  if (!src.includes(NEEDLE)) throw new Error('VirtualizedList.js no longer has the expected TVFocusGuideView block; check #52 against the new fork.');
  return src.replace(
    NEEDLE,
    `<TVFocusGuideView\n            ${MARKER}\n            style={__visparGuideStyle(this.props.style)}\n            {...trapFocusHorizontal}`,
  ) + `\n${MARKER}\nfunction __visparGuideStyle(style) {\n  const s = StyleSheet.flatten(style) || {};\n  const out = {};\n  for (const k of ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'height', 'minHeight', 'maxHeight', 'width', 'minWidth', 'maxWidth', 'alignSelf']) if (s[k] !== undefined) out[k] = s[k];\n  return out;\n}\n`;
}

function listFile(root) {
  const candidates = [
    path.join(root, 'node_modules/@react-native-tvos/virtualized-lists/Lists/VirtualizedList.js'),
    path.join(root, 'node_modules/react-native/node_modules/@react-native-tvos/virtualized-lists/Lists/VirtualizedList.js'),
  ];
  return candidates.find((f) => fs.existsSync(f)) ?? null;
}

module.exports = { patchSource, MARKER };

if (require.main === module) {
  const file = listFile(path.join(__dirname, '..'));
  if (!file) {
    console.error('@react-native-tvos/virtualized-lists not found: run this after installing react-native-tvos.');
    process.exit(1);
  }
  const src = fs.readFileSync(file, 'utf8');
  if (!/\bStyleSheet\b/.test(src.split('\n').slice(0, 80).join('\n'))) {
    console.error(`${file} does not import StyleSheet; the patch needs it.`);
    process.exit(1);
  }
  fs.writeFileSync(file, patchSource(src));
  console.log(`Patched ${path.relative(process.cwd(), file)}`);
}
