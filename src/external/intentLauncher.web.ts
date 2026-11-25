/**
 * Web build: there are no Android intents, and launch.ts only calls these when Platform.OS is
 * 'android'. A stub keeps expo-intent-launcher out of the web bundle.
 */
const androidOnly = async (): Promise<never> => {
  throw new Error('Android intents are not available on the web');
};
export const getApplicationIconAsync = androidOnly;
export const startActivityAsync = androidOnly;
