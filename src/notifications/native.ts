/** Native local notifications. The web build gets native.web.ts, so expo-notifications is not bundled there. */
export function expoNotifications(): typeof import('expo-notifications') | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}
