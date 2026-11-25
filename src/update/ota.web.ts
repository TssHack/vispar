/**
 * Web build: no over-the-air updates (the site is always the latest deploy). UpdateProvider only
 * calls these when isEnabled is true, so a stub keeps expo-updates out of the web bundle.
 */
export const isEnabled = false;
const unavailable = async (): Promise<never> => {
  throw new Error('Over-the-air updates are not available on the web');
};
export const checkForUpdateAsync = unavailable;
export const fetchUpdateAsync = unavailable;
export const reloadAsync = unavailable;
