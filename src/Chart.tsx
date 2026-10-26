import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { C } from './theme';
import { Muted } from './ui';

const fmtDay = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Minimal time-series line chart: y labels at min/max, x labels at first/last date. */
export function LineChart({ points, color = C.accent, height = 170, unit = '' }: { points: { at: number; y: number }[]; color?: string; height?: number; unit?: string }) {
  const [width, setWidth] = useState(0);
  if (points.length < 2) return <Muted>Log this exercise in 2+ workouts to see a trend.</Muted>;

  const left = 44, right = 12, top = 12, bottom = 22;
  const xs = points.map((p) => p.at);
  const ys = points.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const pad = (Math.max(...ys) - Math.min(...ys)) * 0.1 || 5;
  const [y0, y1] = [Math.min(...ys) - pad, Math.max(...ys) + pad];
  const X = (x: number) => left + ((x - x0) / (x1 - x0 || 1)) * (width - left - right);
  const Y = (y: number) => top + (1 - (y - y0) / (y1 - y0)) * (height - top - bottom);
  const last = points[points.length - 1]!;

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[y0 + pad, y1 - pad].map((y) => (
            <SvgText key={y} x={left - 6} y={Y(y) + 4} fill={C.muted} fontSize={11} textAnchor="end">{Math.round(y)}</SvgText>
          ))}
          <Line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke={C.border} />
          <SvgText x={left} y={height - 6} fill={C.muted} fontSize={11}>{fmtDay(x0)}</SvgText>
          <SvgText x={width - right} y={height - 6} fill={C.muted} fontSize={11} textAnchor="end">{fmtDay(x1)}</SvgText>
          <Polyline points={points.map((p) => `${X(p.at)},${Y(p.y)}`).join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
          {points.map((p) => <Circle key={p.at} cx={X(p.at)} cy={Y(p.y)} r={3} fill={color} />)}
          <SvgText x={X(last.at)} y={Y(last.y) - 8} fill={C.text} fontSize={12} fontWeight="bold" textAnchor="end">{`${Math.round(last.y)}${unit}`}</SvgText>
        </Svg>
      )}
    </View>
  );
}
