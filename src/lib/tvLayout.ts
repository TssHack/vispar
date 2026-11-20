/**
 * Android TV layout numbers. A 1080p TV usually reports 960×540 dp (density 2.0) and a 720p one
 * 1280×720 dp, so everything here must fit 540 dp of height.
 */

/** Width of the TV side rail. Grids subtract the same number, so they never overflow it. */
export const SIDE_RAIL_WIDTH = 112;

export type RailMetrics = { padV: number; logo: number; logoGap: number; item: number; gap: number };

const ROOMY: RailMetrics = { padV: 28, logo: 44, logoGap: 28, item: 68, gap: 10 };
const COMPACT: Omit<RailMetrics, 'item'> = { padV: 16, logo: 36, logoGap: 10, gap: 6 };

/** Total height of the rail for a given set of metrics. */
export function railHeight(m: RailMetrics, items: number): number {
  return m.padV * 2 + m.logo + m.logoGap + items * m.item + Math.max(0, items - 1) * m.gap;
}

/** Rail metrics that fit `height`: the roomy layout when it fits, otherwise compact with items sized to the space left. */
export function railMetrics(height: number, items: number): RailMetrics {
  if (railHeight(ROOMY, items) <= height) return ROOMY;
  const free = height - COMPACT.padV * 2 - COMPACT.logo - COMPACT.logoGap - Math.max(0, items - 1) * COMPACT.gap;
  const item = Math.max(40, Math.min(ROOMY.item, Math.floor(free / Math.max(1, items))));
  return { ...COMPACT, item };
}

/** Hero height on TV: leaves room for the first rail's title and posters to peek in below it. */
export function tvHeroHeight(height: number): number {
  return Math.min(470, Math.round(height * 0.66));
}

/** Hero title size on TV: 56 dp on a 720 dp screen is fine, on 540 dp it takes two thirds of the hero. */
export function tvHeroTitleSize(height: number): number {
  return height < 640 ? 40 : 56;
}
