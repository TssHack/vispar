# Working rules for this repository

These are hard rules, not suggestions. They came from a real failure: PR #3 merged a subtitle
feature whose typecheck and 72 unit tests were green, yet the player crashed with a blank page for
any title without a saved subtitle choice, and five more behavioural bugs shipped to `main`. The user
found them, not the tests.

## 1. No pull request merges without an independent review

Every PR gets a review before merge. Period. This applies even when the author is also the reviewer,
and especially when CI is green.

A review is **not**:

- Reading the diff once and saying "looks good".
- Restating what the tests already cover.
- Trusting the PR description. The description is a claim, not evidence.

A review **is** a second pass that assumes the code is wrong and tries to prove it:

1. Trace each user-visible path end to end, and name what the user sees at every step.
2. Ask what happens on the failure path: no data, a slow network, a wrong type, a stale value, a
   platform that does not have the API.
3. Check every claim the PR description makes against the code. If the description says a name is
   probed, open the file and confirm the loop reaches it.
4. Look for the specific hazards listed below.

Record the review on the PR itself (a comment or the review body), not only in chat, so it outlives
the conversation.

## 2. Green tests are not evidence that a feature works

`tsc` and `vitest` prove that units behave. They do not prove that the pieces are wired together,
because most of these bugs live in the wiring.

Before calling a feature done, it must be exercised the way a user exercises it:

- Web: `npx expo export -p web`, serve it, and open the actual route. Watch the console.
- Native-only behaviour: state plainly that it is unverified, and say what needs a device.
- If a build or a browser is not available in the environment, say so in the report instead of
  implying the feature was verified.

## 3. Known hazards in this codebase

These have already caused real bugs. Check them on every PR that touches the related area.

### `useSyncExternalStore` snapshots must be stable
The persisted stores in `src/lib/persist.ts` feed `useSyncExternalStore`. A selector that returns a
**new object, array or function on every call** makes React loop and abort with
*Maximum update depth exceeded* — a blank screen, not a warning.

```ts
// Wrong: a fresh {} per call, an infinite render loop for every title with no saved choice.
subtitleStore.use((all) => all[key] ?? {});

// Right: one shared frozen value.
const EMPTY = Object.freeze({});
subtitleStore.use((all) => all[key] ?? EMPTY);
```

Every selector in this repository must be checked for this. Add a regression test on the selector's
identity, not only on its value.

### Platform APIs differ, and the type declarations say so
`expo-video` exposes `availableSubtitleTracks` and `subtitleTrack` as **Android and iOS only**; the web
build stubs them out. Before using any Expo API across platforms, read its `.d.ts` `@platform` tags and
the `.web.js` implementation. Assume a no-op rather than a working feature.

### Native handles cannot be stashed
Assigning a track, player or controller object that is not from the live array the native module
exposes crashes the app. Always re-look-up by id in the current array.

### Async results outlive their screen
Routes can change while a request is in flight (`router.replace` keeps the screen alive). Every async
effect needs a guard — a request counter or an `AbortController` — so a late response cannot write
state belonging to a different title.

### Legacy encodings are the normal case, not the edge case
Persian subtitle and text files are frequently Windows-1256. Never assume UTF-8. Decode by sniffing
bytes, and keep a built-in decoder because Hermes only ships UTF-8 `TextDecoder`.

### Copies drift
- `src/external/apps.ts` and `plugins/withExternalApps.js` must list the same Android packages.
- `proxy/src/index.ts` and `server/src/routes.ts` must allow the same paths.

There are tests for both; keep them passing and extend them when the lists change.

## 4. Reporting

- Never describe unverified work as done. Say what was run, and what was not.
- If the PR description states a behaviour, that behaviour must be true in the code.
- When something is out of scope, say so explicitly rather than leaving it implied.

## 5. Git workflow

1. Issue first, with the problem, the evidence, the plan, the risks and acceptance criteria.
2. Branch from `main`: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
3. Small, focused commits in the imperative mood.
4. PR that closes the issue, with a body that states what changed, what was verified, and what was
   not.
5. Review on the PR, then squash-merge.
