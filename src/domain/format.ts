export type DistanceUnit = 'mi' | 'km';

export const METERS_PER_MILE = 1609.344;

export function metersToUnit(meters: number, unit: DistanceUnit): number {
  return unit === 'mi' ? meters / METERS_PER_MILE : meters / 1000;
}

export function unitToMeters(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * METERS_PER_MILE : value * 1000;
}

export function formatDistance(meters: number, unit: DistanceUnit, digits = 2): string {
  return `${metersToUnit(meters, unit).toFixed(digits)} ${unit}`;
}

/** Pace as "m:ss /mi". Returns "–" when there is no distance. */
export function formatPace(seconds: number, meters: number, unit: DistanceUnit): string {
  const distance = metersToUnit(meters, unit);
  if (!(distance > 0) || !(seconds > 0)) return '–';
  const secPerUnit = Math.round(seconds / distance);
  const m = Math.floor(secPerUnit / 60);
  const s = secPerUnit % 60;
  return `${m}:${String(s).padStart(2, '0')} /${unit}`;
}

/** "1:02:03" for long durations, "42:07" otherwise. */
export function formatClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1h 5m" / "42m" for summary cards. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** Parses "mm:ss" or "h:mm:ss" (or plain minutes) into seconds. Returns null if invalid. */
export function parseClock(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return (nums[0] ?? 0) * 60;
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatWeight(lbs: number): string {
  const rounded = Math.round(lbs * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatVolume(lbs: number): string {
  if (lbs >= 100000) return `${Math.round(lbs / 1000)}k lb`;
  if (lbs >= 10000) return `${(lbs / 1000).toFixed(1)}k lb`;
  return `${Math.round(lbs).toLocaleString('en-US')} lb`;
}

export function formatSet(weight: number, reps: number): string {
  return weight > 0 ? `${formatWeight(weight)} lb × ${reps}` : `${reps} reps`;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayShort(day: number): string {
  return WEEKDAY_SHORT[((day % 7) + 7) % 7] ?? '';
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateLong(ts: number): string {
  const d = new Date(ts);
  return `${formatDate(ts)}, ${d.getFullYear()}`;
}

export function formatMonth(ts: number): string {
  const d = new Date(ts);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatTimeOfDay(hour: number, minute: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Start of the (Monday-based) week containing ts, local time. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}
