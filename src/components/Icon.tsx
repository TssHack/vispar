import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/tokens';

export type IconName =
  | 'home'
  | 'film'
  | 'tv'
  | 'search'
  | 'settings'
  | 'download'
  | 'chevronLeft'
  | 'back'
  | 'share'
  | 'close'
  | 'play'
  | 'star'
  | 'github'
  | 'globe'
  | 'refresh'
  | 'check'
  | 'alert'
  | 'pause'
  | 'rewind'
  | 'forward'
  | 'fullscreen'
  | 'fullscreenExit'
  | 'gauge'
  | 'layers'
  | 'subtitles'
  | 'more'
  | 'bookmark'
  | 'bookmarkFilled'
  | 'volume'
  | 'mute'
  | 'next'
  | 'trash'
  | 'sort'
  | 'filter'
  | 'history'
  | 'external'
  | 'pip'
  | 'library'
  | 'palette'
  | 'link'
  | 'wifiOff'
  | 'bell'
  | 'plus'
  | 'desktop'
  | 'info';

type Props = { name: IconName; size?: number; color?: keyof Palette | (string & {}); strokeWidth?: number };

export function Icon({ name, size = 22, color = 'text', strokeWidth = 1.8 }: Props) {
  const { colors } = useTheme();
  const c = (colors as Record<string, string>)[color] ?? color;
  const stroke = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  const body = (() => {
    switch (name) {
      case 'home':
        return <Path {...stroke} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />;
      case 'film':
        return (
          <>
            <Rect {...stroke} x={3} y={3} width={18} height={18} rx={3} />
            <Path {...stroke} d="M7.5 3v18M16.5 3v18M3 12h18" />
          </>
        );
      case 'tv':
        return (
          <>
            <Rect {...stroke} x={2} y={7} width={20} height={14} rx={3} />
            <Path {...stroke} d="m17 2-5 5-5-5" />
          </>
        );
      case 'search':
        return (
          <>
            <Circle {...stroke} cx={11} cy={11} r={7} />
            <Path {...stroke} d="m20 20-3.5-3.5" />
          </>
        );
      case 'settings':
        return (
          <>
            <Path {...stroke} d="M4 6h9M18 6h2M4 12h3M12 12h8M4 18h11" />
            <Circle {...stroke} cx={15.5} cy={6} r={2} />
            <Circle {...stroke} cx={9.5} cy={12} r={2} />
            <Circle {...stroke} cx={17.5} cy={18} r={2} />
          </>
        );
      case 'download':
        return <Path {...stroke} d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />;
      case 'chevronLeft':
        return <Path {...stroke} d="m15 6-6 6 6 6" />;
      case 'back':
        // RTL: "back" points to the right.
        return <Path {...stroke} d="M5 12h14m-6-6 6 6-6 6" />;
      case 'wifiOff':
        return (
          <>
            <Path {...stroke} d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 3.2-2.1M10.7 5.1A15 15 0 0 1 22 9M2 9a15 15 0 0 1 4-2.7" />
            <Circle cx={12} cy={20} r={1.2} fill={c} />
          </>
        );
      case 'bell':
        return <Path {...stroke} d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0" />;
      case 'plus':
        return <Path {...stroke} d="M12 5v14M5 12h14" />;
      case 'desktop':
        return (
          <>
            <Rect {...stroke} x={2.5} y={4} width={19} height={12} rx={2} />
            <Path {...stroke} d="M8 20h8M12 16v4" />
          </>
        );
      case 'info':
        return (
          <>
            <Circle {...stroke} cx={12} cy={12} r={9} />
            <Path {...stroke} d="M12 11v5.5" />
            <Circle cx={12} cy={7.7} r={1.1} fill={c} />
          </>
        );
      case 'share':
        return <Path {...stroke} d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />;
      case 'close':
        return <Path {...stroke} d="M6 6l12 12M18 6 6 18" />;
      case 'play':
        return <Path d="M7 4.5v15l13-7.5z" fill={c} />;
      case 'star':
        return <Path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={c} />;
      case 'github':
        return (
          <Path
            {...stroke}
            d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
          />
        );
      case 'globe':
        return (
          <>
            <Circle {...stroke} cx={12} cy={12} r={9} />
            <Path {...stroke} d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </>
        );
      case 'refresh':
        return <Path {...stroke} d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />;
      case 'check':
        return <Path {...stroke} d="m5 12 4.5 4.5L19 7" />;
      case 'alert':
        return (
          <>
            <Circle {...stroke} cx={12} cy={12} r={9} />
            <Path {...stroke} d="M12 7.5v5.5M12 16.5h.01" />
          </>
        );
      case 'pause':
        return (
          <>
            <Rect x={6} y={4.5} width={4} height={15} rx={1.2} fill={c} />
            <Rect x={14} y={4.5} width={4} height={15} rx={1.2} fill={c} />
          </>
        );
      case 'rewind':
        // Circular arrow back (seek backwards), media convention: always points left.
        return (
          <>
            <Path {...stroke} d="M4 12a8 8 0 1 0 2.4-5.7" />
            <Path {...stroke} d="M4 4v4.5h4.5" />
          </>
        );
      case 'forward':
        return (
          <>
            <Path {...stroke} d="M20 12a8 8 0 1 1-2.4-5.7" />
            <Path {...stroke} d="M20 4v4.5h-4.5" />
          </>
        );
      case 'fullscreen':
        return <Path {...stroke} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />;
      case 'fullscreenExit':
        return <Path {...stroke} d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />;
      case 'gauge':
        return (
          <>
            <Path {...stroke} d="M4.5 17a8.5 8.5 0 1 1 15 0" />
            <Path {...stroke} d="m12 14 4-5" />
          </>
        );
      case 'layers':
        return <Path {...stroke} d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />;
      case 'subtitles':
        // A screen with two caption lines: reads as "text on video" at 20 px.
        return (
          <>
            <Path {...stroke} d="M3 5.5h18v13H3z" />
            <Path {...stroke} d="M6.5 11h5M6.5 14h11M14 11h3.5" />
          </>
        );
      case 'more':
        return (
          <>
            <Circle cx={5} cy={12} r={1.8} fill={c} />
            <Circle cx={12} cy={12} r={1.8} fill={c} />
            <Circle cx={19} cy={12} r={1.8} fill={c} />
          </>
        );
      case 'bookmark':
        return <Path {...stroke} d="M6 4h12v17l-6-4-6 4V4Z" />;
      case 'bookmarkFilled':
        return <Path d="M6 4h12v17l-6-4-6 4V4Z" fill={c} stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" />;
      case 'volume':
        return (
          <>
            <Path {...stroke} d="M4 9.5h3.5L12 5v14l-4.5-4.5H4v-5Z" />
            <Path {...stroke} d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
          </>
        );
      case 'mute':
        return (
          <>
            <Path {...stroke} d="M4 9.5h3.5L12 5v14l-4.5-4.5H4v-5Z" />
            <Path {...stroke} d="m16 9.5 5 5M21 9.5l-5 5" />
          </>
        );
      case 'next':
        return (
          <>
            <Path d="M5 5v14l10-7z" fill={c} />
            <Rect x={16.5} y={5} width={2.5} height={14} rx={1} fill={c} />
          </>
        );
      case 'trash':
        return <Path {...stroke} d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />;
      case 'sort':
        return <Path {...stroke} d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />;
      case 'filter':
        return <Path {...stroke} d="M3.5 5h17l-6.5 8v5.5l-4 2V13L3.5 5Z" />;
      case 'history':
        return (
          <>
            <Path {...stroke} d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />
            <Path {...stroke} d="M12 8v4.5l3 2" />
          </>
        );
      case 'external':
        return <Path {...stroke} d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />;
      case 'pip':
        return (
          <>
            <Rect {...stroke} x={2.5} y={4.5} width={19} height={15} rx={2.5} />
            <Rect x={12} y={11.5} width={7} height={5.5} rx={1.2} fill={c} />
          </>
        );
      case 'library':
        return (
          <>
            <Rect {...stroke} x={3} y={4} width={4.5} height={16} rx={1} />
            <Rect {...stroke} x={9.5} y={4} width={4.5} height={16} rx={1} />
            <Path {...stroke} d="m16 5.2 4.3-1.2 3 15.5-4.3 1.2z" />
          </>
        );
      case 'palette':
        return (
          <>
            <Path {...stroke} d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
            <Circle cx={7.5} cy={11} r={1.3} fill={c} />
            <Circle cx={10.5} cy={7.3} r={1.3} fill={c} />
            <Circle cx={15} cy={7.5} r={1.3} fill={c} />
          </>
        );
      case 'link':
        return <Path {...stroke} d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />;
    }
  })();

  return (
    // Accessibility props live on the wrapper: react-native-svg passes its own props to the DOM on web.
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {body}
      </Svg>
    </View>
  );
}
