import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { formatShortDate } from '@/domain/format';
import { compactNumber, niceTicks, type SeriesPoint } from '@/domain/stats';
import { colors, radius, space } from '@/theme';

// Chart tokens (validated with the dataviz palette checker against colors.surface).
export const chartColors = {
  series: colors.accent,
  record: '#C28600',
  grid: colors.border,
  axisText: colors.textFaint,
  surface: colors.surface,
};

const PAD = { left: 40, right: 16, top: 16, bottom: 26 };
// SVG text doesn't inherit the app font; on web it would fall back to a serif face.
const SVG_FONT = Platform.select({ web: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', default: undefined });

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

/**
 * Single-series time chart. Touch and drag to move the crosshair; the readout
 * above the plot shows the nearest session. Record-setting sessions get a gold
 * marker, explained by the legend underneath.
 */
export function LineChart({
  points,
  height = 200,
  formatValue,
  testID,
  accessibilityLabel,
}: {
  points: SeriesPoint[];
  height?: number;
  formatValue: (v: number) => string;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;
    const ys = points.map((p) => p.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 4);
    const yMin = ticks[0] ?? 0;
    const yMax = ticks[ticks.length - 1] ?? 1;
    const minX = points[0]?.x ?? 0;
    const maxX = points[points.length - 1]?.x ?? 1;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const sx = (x: number) => (maxX === minX ? PAD.left + plotW / 2 : PAD.left + ((x - minX) / (maxX - minX)) * plotW);
    const sy = (y: number) => PAD.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;
    const coords = points.map((p) => ({ cx: sx(p.x), cy: sy(p.y) }));
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ');
    const first = coords[0];
    const last = coords[coords.length - 1];
    const baseline = PAD.top + plotH;
    const area =
      first && last && coords.length > 1 ? `${line} L${last.cx.toFixed(1)},${baseline} L${first.cx.toFixed(1)},${baseline} Z` : '';
    return { ticks, sy, coords, line, area, baseline, plotW };
  }, [width, height, points]);

  const pick = (e: GestureResponderEvent) => {
    if (!geometry) return;
    const x = e.nativeEvent.locationX;
    let best = 0;
    let bestDist = Infinity;
    geometry.coords.forEach((c, i) => {
      const d = Math.abs(c.cx - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setSelected(best);
  };

  const active = selected !== null ? points[selected] : points[points.length - 1];
  const hasRecords = points.some((p) => p.record);
  // Dense histories only mark records and the latest point, so markers never crowd the line.
  const dense = points.length > 30;

  return (
    <View testID={testID} accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.readout}>
        {active ? (
          <>
            <Text style={styles.readoutValue}>{formatValue(active.y)}</Text>
            <Text style={styles.readoutLabel}>
              {formatShortDate(active.x)}
              {active.record ? ' · new record' : ''}
              {selected === null ? ' · latest' : ''}
            </Text>
          </>
        ) : null}
      </View>
      <View
        onLayout={onLayout}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderTerminationRequest={() => true}
      >
        {geometry ? (
          <Svg width={width} height={height} pointerEvents="none">
            <Defs>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={chartColors.series} stopOpacity={0.14} />
                <Stop offset="1" stopColor={chartColors.series} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {geometry.ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={geometry.sy(t)} y2={geometry.sy(t)} stroke={chartColors.grid} strokeWidth={StyleSheet.hairlineWidth} />
            ))}
            {geometry.ticks.map((t) => (
              <SvgText fontFamily={SVG_FONT} key={`l${t}`} x={PAD.left - 8} y={geometry.sy(t) + 4} fill={chartColors.axisText} fontSize={11} textAnchor="end">
                {compactNumber(t)}
              </SvgText>
            ))}
            {geometry.area ? <Path d={geometry.area} fill="url(#area)" /> : null}
            {geometry.coords.length > 1 ? (
              <Path d={geometry.line} stroke={chartColors.series} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {selected !== null && geometry.coords[selected] ? (
              <Line
                x1={geometry.coords[selected].cx}
                x2={geometry.coords[selected].cx}
                y1={PAD.top}
                y2={geometry.baseline}
                stroke={colors.textFaint}
                strokeWidth={1}
              />
            ) : null}
            {geometry.coords.map((c, i) => {
              const p = points[i];
              if (!p) return null;
              const isLast = i === points.length - 1;
              if (dense && !p.record && !isLast && i !== selected) return null;
              const r = p.record ? 5 : 4;
              return (
                <Circle
                  key={p.x}
                  cx={c.cx}
                  cy={c.cy}
                  r={i === selected ? r + 1.5 : r}
                  fill={p.record ? chartColors.record : chartColors.series}
                  stroke={chartColors.surface}
                  strokeWidth={2}
                />
              );
            })}
            {points.length > 0 ? (
              <>
                <SvgText fontFamily={SVG_FONT} x={PAD.left} y={height - 6} fill={chartColors.axisText} fontSize={11} textAnchor="start">
                  {formatShortDate(points[0]?.x ?? 0)}
                </SvgText>
                {points.length > 1 ? (
                  <SvgText fontFamily={SVG_FONT} x={width - PAD.right} y={height - 6} fill={chartColors.axisText} fontSize={11} textAnchor="end">
                    {formatShortDate(points[points.length - 1]?.x ?? 0)}
                  </SvgText>
                ) : null}
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
      {hasRecords ? (
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: chartColors.series }]} />
          <Text style={styles.legendText}>Session</Text>
          <View style={[styles.legendDot, { backgroundColor: chartColors.record, marginLeft: space.md }]} />
          <Text style={styles.legendText}>New record</Text>
        </View>
      ) : null}
    </View>
  );
}

function roundedTopBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/** Weekly column chart: one series, value on the cap of the selected (default: latest) column. */
export function WeeklyBars({
  data,
  height = 140,
  formatValue,
  testID,
}: {
  data: { weekStart: number; value: number }[];
  height?: number;
  formatValue: (v: number) => string;
  testID?: string;
}) {
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = 22;
  const bottom = 22;
  const plotH = height - top - bottom;
  const slot = data.length > 0 ? width / data.length : 0;
  const barW = Math.min(24, Math.max(4, slot - 2));
  const focus = selected ?? data.length - 1;

  const pick = (e: GestureResponderEvent) => {
    if (slot <= 0) return;
    setSelected(Math.max(0, Math.min(data.length - 1, Math.floor(e.nativeEvent.locationX / slot))));
  };

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={{ height }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
      onResponderTerminationRequest={() => true}
    >
      {width > 0 ? (
        <Svg width={width} height={height} pointerEvents="none">
          <Line x1={0} x2={width} y1={top + plotH} y2={top + plotH} stroke={chartColors.grid} strokeWidth={StyleSheet.hairlineWidth} />
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(3, (d.value / max) * plotH) : 0;
            const x = i * slot + (slot - barW) / 2;
            const y = top + plotH - h;
            return (
              <Path
                key={d.weekStart}
                d={h > 0 ? roundedTopBar(x, y, barW, h) : ''}
                fill={chartColors.series}
                opacity={i === focus ? 1 : 0.55}
              />
            );
          })}
          {data[focus] ? (
            <SvgText
              fontFamily={SVG_FONT}
              x={focus * slot + slot / 2}
              y={top + plotH - Math.max(3, (data[focus].value / max) * plotH) - 6}
              fill={colors.text}
              fontSize={12}
              fontWeight="700"
              textAnchor="middle"
            >
              {formatValue(data[focus].value)}
            </SvgText>
          ) : null}
          {data.map((d, i) =>
            i === 0 || i === data.length - 1 || i === focus ? (
              <SvgText
                fontFamily={SVG_FONT}
                key={`x${d.weekStart}`}
                x={i * slot + slot / 2}
                y={height - 6}
                fill={i === focus ? colors.textDim : chartColors.axisText}
                fontSize={10}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              >
                {i === data.length - 1 ? 'This wk' : formatShortDate(d.weekStart)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

/** Horizontal bars for a ranked breakdown (e.g. sets per muscle). Labels sit outside the bars. */
export function RankedBars({ rows, formatValue }: { rows: { label: string; value: number }[]; formatValue: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.label} style={styles.rankRow}>
          <Text style={styles.rankLabel} numberOfLines={1}>
            {r.label}
          </Text>
          <View style={styles.rankTrack}>
            <View style={[styles.rankBar, { width: `${(r.value / max) * 100}%` }]} />
          </View>
          <Text style={styles.rankValue}>{formatValue(r.value)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 44, marginBottom: space.xs },
  readoutValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  readoutLabel: { color: colors.textDim, fontSize: 13 },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: colors.textDim, fontSize: 12 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rankLabel: { width: 84, color: colors.textDim, fontSize: 13, textTransform: 'capitalize' },
  rankTrack: { flex: 1, height: 10 },
  rankBar: { height: 10, borderRadius: radius.sm / 2, backgroundColor: chartColors.series, minWidth: 3 },
  rankValue: { width: 32, color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});
