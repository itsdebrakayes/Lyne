/**
 * Icon.tsx — the v5 icon set.
 *
 * Drawn as one family so the app stops mixing weights and terminals between
 * glyphs: every stroke icon is built on a 24-grid at 1.8 weight with round caps
 * and joins, matching the line style in the approved reference set. Ionicons
 * stays available for anything not covered here, but anything on a primary
 * screen should come from this file — a single mismatched glyph is what made
 * the old set read as unfinished.
 *
 * `ticket` is deliberately the Ionicons silhouette on its 45° tilt, because
 * that glyph is already the app's centre-tab identity and users know it.
 */
import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { colors } from '../lib/theme';

export type IconName =
  | 'search' | 'filter' | 'sliders' | 'bell' | 'home' | 'bookmark' | 'bookmarkFilled'
  | 'person' | 'chevronDown' | 'chevronRight' | 'pin' | 'back' | 'dots' | 'share'
  | 'clock' | 'counter' | 'arrowDown' | 'arrowRight' | 'arrowUpRight' | 'mic'
  | 'government' | 'financial' | 'education' | 'health' | 'grid'
  | 'check' | 'ticket' | 'ticketOutline' | 'walk' | 'close'
  | 'phone' | 'mail' | 'shield' | 'help' | 'appearance' | 'document' | 'plus' | 'trash';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke weight override. The set is drawn for 1.8; go up for large sizes. */
  weight?: number;
  /**
   * The knocked-out mark inside a solid glyph — currently only `check`, whose
   * tick is punched out of the filled disc. It defaults to white, which
   * disappears the moment the disc itself is white (a verified badge on an
   * accent-filled card). Pass the card's background here.
   */
  knockout?: string;
}

export default function Icon({ name, size = 22, color, weight = 1.8, knockout = '#fff' }: Props) {
  const c = color || colors.ink;
  const stroke = { stroke: c, strokeWidth: weight, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const body = () => {
    switch (name) {
      case 'search':
        return <>
          <Circle cx={11} cy={11} r={7} {...stroke} />
          <Path d="m16.2 16.2 3.8 3.8" {...stroke} />
        </>;
      case 'filter':
        return <Path d="M3 7h18M6 12h12M10 17h4" {...stroke} />;
      case 'sliders':
        return <>
          <Path d="M4 8h10M18 8h2M4 16h4M12 16h8" {...stroke} />
          <Circle cx={16} cy={8} r={2} {...stroke} />
          <Circle cx={10} cy={16} r={2} {...stroke} />
        </>;
      case 'bell':
        return <>
          <Path d="M12 3a6 6 0 0 0-6 6c0 4.6-1.8 6.4-1.8 6.4h15.6S18 13.6 18 9a6 6 0 0 0-6-6Z" {...stroke} />
          <Path d="M10 19a2.2 2.2 0 0 0 4 0" {...stroke} />
        </>;
      case 'home':
        return <>
          <Path d="M4 10.2 12 4l8 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.8Z" {...stroke} />
          <Path d="M9.6 20.4v-5.2h4.8v5.2" {...stroke} />
        </>;
      case 'bookmark':
        return <Path d="M6.5 4h11a.5.5 0 0 1 .5.5V20l-6-3.8L6 20V4.5a.5.5 0 0 1 .5-.5Z" {...stroke} />;
      case 'bookmarkFilled':
        return <Path d="M6.5 4h11a.5.5 0 0 1 .5.5V20l-6-3.8L6 20V4.5a.5.5 0 0 1 .5-.5Z" fill={c} />;
      case 'person':
        return <>
          <Circle cx={12} cy={8.2} r={3.6} {...stroke} />
          <Path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" {...stroke} />
        </>;
      case 'chevronDown':
        return <Path d="m6 9.5 6 6 6-6" {...stroke} strokeWidth={weight + 0.4} />;
      case 'chevronRight':
        return <Path d="m9.5 6 6 6-6 6" {...stroke} strokeWidth={weight + 0.4} />;
      case 'pin':
        return <>
          <Path d="M12 21s6.5-5.7 6.5-11a6.5 6.5 0 1 0-13 0c0 5.3 6.5 11 6.5 11Z" {...stroke} />
          <Circle cx={12} cy={9.8} r={2.4} {...stroke} />
        </>;
      case 'back':
        return <Path d="M14.5 5 7.5 12l7 7" {...stroke} strokeWidth={weight + 0.4} />;
      case 'close':
        return <Path d="M6 6l12 12M18 6 6 18" {...stroke} strokeWidth={weight + 0.3} />;
      case 'dots':
        return <>
          <Circle cx={5.5} cy={12} r={1.8} fill={c} />
          <Circle cx={12} cy={12} r={1.8} fill={c} />
          <Circle cx={18.5} cy={12} r={1.8} fill={c} />
        </>;
      case 'share':
        return <>
          <Path d="M12 15.5V4m0 0L8 8m4-4 4 4" {...stroke} />
          <Path d="M5 14v4.6A1.4 1.4 0 0 0 6.4 20h11.2a1.4 1.4 0 0 0 1.4-1.4V14" {...stroke} />
        </>;
      case 'clock':
        return <>
          <Circle cx={12} cy={12} r={8.6} {...stroke} />
          <Path d="M12 7v5.3l3.3 2" {...stroke} />
        </>;
      case 'counter':
        return <Path d="M3.5 19.5h17M5.5 19.5V11h13v8.5M8.5 11V8h7v3M11 15h2" {...stroke} />;
      case 'arrowDown':
        return <Path d="M12 4.5v15m0 0-5-5m5 5 5-5" {...stroke} strokeWidth={weight + 0.3} />;
      case 'arrowRight':
        return <Path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" {...stroke} />;
      case 'arrowUpRight':
        return <Path d="M7 17 17 7m0 0H9m8 0v8" {...stroke} strokeWidth={weight + 0.2} />;
      case 'mic':
        return <>
          <Rect x={9} y={3} width={6} height={10} rx={3} {...stroke} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...stroke} />
        </>;
      case 'government':
        return <>
          <Path d="M3.5 20.5h17M4.5 9.5h15M12 3.5l7.5 4h-15l7.5-4Z" {...stroke} />
          <Path d="M7 9.5v8M12 9.5v8M17 9.5v8" {...stroke} />
        </>;
      case 'financial':
        return <>
          <Rect x={3} y={6} width={18} height={12.5} rx={2.4} {...stroke} />
          <Path d="M3 10.5h18M6.5 15h3" {...stroke} />
        </>;
      case 'education':
        return <>
          <Path d="m12 4 9 4.2-9 4.2-9-4.2L12 4Z" {...stroke} />
          <Path d="M6.5 10.5V15c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-4.5" {...stroke} />
        </>;
      case 'health':
        return <>
          <Rect x={3.5} y={3.5} width={17} height={17} rx={4.5} {...stroke} />
          <Path d="M12 8v8M8 12h8" {...stroke} strokeWidth={weight + 0.3} />
        </>;
      case 'grid':
        return <>
          <Rect x={3.5} y={3.5} width={7} height={7} rx={2.2} {...stroke} />
          <Rect x={13.5} y={3.5} width={7} height={7} rx={2.2} {...stroke} />
          <Rect x={3.5} y={13.5} width={7} height={7} rx={2.2} {...stroke} />
          <Rect x={13.5} y={13.5} width={7} height={7} rx={2.2} {...stroke} />
        </>;
      case 'check':
        return <>
          <Circle cx={12} cy={12} r={9.6} fill={c} />
          <Path d="m7.8 12 3 3 5.4-6" stroke={knockout} strokeWidth={2.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>;
      case 'ticket':
        return (
          <G rotation={-45} origin="12, 12">
            <Path
              d="M4.6 6.6h14.8a2.6 2.6 0 0 1 2.6 2.6 2.8 2.8 0 0 0 0 5.6 2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 14.8a2.8 2.8 0 0 0 0-5.6 2.6 2.6 0 0 1 2.6-2.6Z"
              fill={c}
            />
          </G>
        );
      case 'ticketOutline':
        return (
          <G rotation={-45} origin="12, 12">
            <Path
              d="M4.6 6.6h14.8a2.6 2.6 0 0 1 2.6 2.6 2.8 2.8 0 0 0 0 5.6 2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 14.8a2.8 2.8 0 0 0 0-5.6 2.6 2.6 0 0 1 2.6-2.6Z"
              {...stroke}
            />
          </G>
        );
      case 'walk':
        return <>
          <Circle cx={12} cy={5} r={3.1} fill={c} />
          <Path d="M12 8.6v7.2m0 0-3.6 6.2m3.6-6.2 3.6 6.2M7.6 11.4h8.8" stroke={c} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>;
      case 'phone':
        return <Path d="M7.4 3.5h-2A2.4 2.4 0 0 0 3 6.1C3 13.8 10.2 21 17.9 21a2.4 2.4 0 0 0 2.6-2.4v-2l-4.3-1.7-2 2.4a15.6 15.6 0 0 1-6.5-6.5l2.4-2L7.4 3.5Z" {...stroke} />;
      case 'mail':
        return <>
          <Rect x={3} y={5.5} width={18} height={13} rx={2.6} {...stroke} />
          <Path d="m4 8 7.1 4.8a1.6 1.6 0 0 0 1.8 0L20 8" {...stroke} />
        </>;
      case 'shield':
        return <>
          <Path d="M12 3 5 5.8v5.5c0 4.4 3 8.1 7 9.7 4-1.6 7-5.3 7-9.7V5.8L12 3Z" {...stroke} />
          <Path d="m9 12 2.2 2.2L15 10.4" {...stroke} />
        </>;
      case 'help':
        return <>
          <Circle cx={12} cy={12} r={8.8} {...stroke} />
          <Path d="M9.7 9.4a2.4 2.4 0 1 1 3 2.3v1.5" {...stroke} />
          <Circle cx={12} cy={16.6} r={0.9} fill={c} />
        </>;
      case 'appearance':
        return <>
          <Circle cx={12} cy={12} r={8.8} {...stroke} />
          <Path d="M12 3.2v17.6a8.8 8.8 0 0 0 0-17.6Z" fill={c} />
        </>;
      case 'document':
        return <>
          <Path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3Z" {...stroke} />
          <Path d="M13.2 3.2V8.4h5.4M8.6 13h6.8M8.6 16.6h4.4" {...stroke} />
        </>;
      case 'plus':
        return <Path d="M12 5v14M5 12h14" {...stroke} strokeWidth={weight + 0.3} />;
      case 'trash':
        return <>
          <Path d="M4 6.6h16M9.4 6.6V4.4h5.2v2.2" {...stroke} />
          <Path d="M6.4 6.6 7.3 19a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.9-12.4" {...stroke} />
          <Path d="M10.4 10.4v6M13.6 10.4v6" {...stroke} />
        </>;
      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body()}
    </Svg>
  );
}
