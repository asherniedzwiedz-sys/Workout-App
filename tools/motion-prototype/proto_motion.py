"""Throwaway numeric prototype of the Swift MotionCore algorithms (segmenter + rep counter).
Mirrors the Swift step-for-step so the Swift test expectations are checked before porting."""
import numpy as np

HZ = 50.0

# ---------- synthetic signals ----------
def still(sec, rng, g=(0, 0, -1)):
    n = int(sec * HZ)
    ua = rng.normal(0, 0.006, (n, 3))
    grav = np.tile(g, (n, 1)) + rng.normal(0, 0.002, (n, 3))
    return ua, grav

def curl(reps, period, rng, amp_deg=125, ua_amp=0.18, jitter=0.12):
    """Forearm rotates ~125 deg about the watch x axis each rep; gravity vector swings, plus linear accel."""
    ua_all, g_all = [], []
    for _ in range(reps):
        p = period * (1 + rng.uniform(-jitter, jitter))
        n = int(p * HZ)
        ph = np.linspace(0, 2 * np.pi, n, endpoint=False)
        theta = np.deg2rad(amp_deg) * (1 - np.cos(ph)) / 2
        g = np.stack([np.zeros(n), -np.sin(theta), -np.cos(theta)], 1)
        a = ua_amp * np.stack([0.2 * np.sin(ph), np.cos(ph), 0.3 * np.sin(2 * ph)], 1)
        ua_all.append(a + rng.normal(0, 0.02, (n, 3)))
        g_all.append(g + rng.normal(0, 0.01, (n, 3)))
    return np.concatenate(ua_all), np.concatenate(g_all)

def press(reps, period, rng, ua_amp=0.22, jitter=0.12):
    """Vertical press: orientation ~constant, acceleration along gravity axis."""
    ua_all, g_all = [], []
    for _ in range(reps):
        p = period * (1 + rng.uniform(-jitter, jitter))
        n = int(p * HZ)
        ph = np.linspace(0, 2 * np.pi, n, endpoint=False)
        a = np.stack([0.15 * ua_amp * np.sin(ph), 0.1 * ua_amp * np.cos(ph), ua_amp * np.cos(ph)], 1)
        ua_all.append(a + rng.normal(0, 0.025, (n, 3)))
        g = np.tile((0.1, 0.2, -0.97), (n, 1)) + rng.normal(0, 0.01, (n, 3))
        g_all.append(g)
    return np.concatenate(ua_all), np.concatenate(g_all)

def session(parts):
    ua = np.concatenate([p[0] for p in parts])
    g = np.concatenate([p[1] for p in parts])
    t = np.arange(len(ua)) / HZ
    return t, ua, g

# ---------- segmenter (streaming, same as SetSegmenter.swift) ----------
CFG = dict(smooth=0.5, move=0.04, still=0.02, still_std=0.016, sustain=0.8, still_before=3.0, end_still=3.0, max_set=150.0, gap=0.4)

def segment(t, ua, cfg=CFG):
    mag = np.linalg.norm(ua, axis=1)
    ns, nv = int(cfg['smooth'] * HZ), int(1.0 * HZ)
    events, state, since, start, still_since = [], 'settling', None, None, None
    for i in range(len(t)):
        sm = mag[max(0, i - ns + 1): i + 1].mean()
        sd = mag[max(0, i - nv + 1): i + 1].std()
        is_still = sm < cfg['still'] and sd < cfg['still_std']
        moving = sm > cfg['move']
        still_since = (still_since if still_since is not None else t[i]) if is_still else None
        still_dur = t[i] - still_since if still_since is not None else 0
        if state == 'settling':
            if still_dur >= cfg['still_before']:
                state = 'armed'
        elif state == 'armed':
            if moving:
                state, since, last_move = 'candidate', t[i], t[i]
        elif state == 'candidate':
            if moving:
                last_move = t[i]
            if t[i] - last_move > cfg['gap']:
                state = 'armed'
            elif t[i] - since >= cfg['sustain']:
                start = max(0.0, since - cfg['smooth'] / 2)
                events.append(('start', start)); state = 'inset'
        elif state == 'inset':
            if still_dur >= cfg['end_still']:
                events.append(('end', start, max(start, still_since - 0.5))); state = 'armed'
            elif t[i] - start >= cfg['max_set']:
                events.append(('end', start, t[i])); state = 'settling'
    return events

# ---------- rep counter (same as RepCounter.swift) ----------
def mavg(x, w):
    """Centered moving average with shrinking edges, via prefix sums."""
    n, h = len(x), w // 2
    c = np.concatenate([[0.0], np.cumsum(x)])
    out = np.empty(n)
    for i in range(n):
        lo, hi = max(0, i - h), min(n, i + h + 1)
        out[i] = (c[hi] - c[lo]) / (hi - lo)
    return out

def count_reps(ua, g, lp=0.3, hpw=6.0, min_p=0.8, max_p=8.0, default_p=2.5, frac=0.35, min_amp=0.025, hi_ratio=1.6, lo_ratio=0.45):

    n = len(ua)
    if n < HZ:
        return 0, [], default_p
    acc = ua + g
    bp = np.stack([mavg(acc[:, k] - mavg(acc[:, k], int(hpw * HZ)), int(lp * HZ)) for k in range(3)], 1)
    cov = bp.T @ bp / n
    v = np.array([1.0, 1.0, 1.0])
    for _ in range(30):
        v = cov @ v; v /= np.linalg.norm(v) + 1e-12
    s = bp @ v
    # tempo
    best_lag, best_r = None, 0.3
    e0 = (s * s).sum()
    lo, hi = int(min_p * HZ), min(int(max_p * HZ), n // 2)
    rs = {}
    for lag in range(lo, hi + 1):
        a, b = s[:-lag], s[lag:]
        r = (a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-12)
        rs[lag] = r
    for lag in range(lo + 1, hi):
        if rs[lag] > best_r and rs[lag] >= rs[lag - 1] and rs[lag] >= rs[lag + 1]:
            best_r, best_lag = rs[lag], lag
            break  # first strong local max = fundamental period (later ones are multiples)
    period = best_lag / HZ if best_lag else default_p
    amp = np.percentile(np.abs(s), 90)
    if amp < min_amp:
        return 0, [], period
    h = max(frac * amp, 0.5 * min_amp)
    min_d = 0.5 * period * HZ
    def lobes(x):
        """Peaks above +h that have a trough below -h on BOTH sides = full rep cycles."""
        peaks, trough = [], False
        for i in range(1, n - 1):
            if x[i] < -h:
                trough = True
                if peaks: peaks[-1][2] = True
            if x[i] > h and x[i] >= x[i - 1] and x[i] > x[i + 1]:
                if peaks and (i - peaks[-1][0] < min_d or not trough):
                    if x[i] > x[peaks[-1][0]]:
                        peaks[-1][0] = i
                else:
                    peaks.append([i, trough, False]); trough = False
        return [p[0] for p in peaks if p[1] and p[2]]
    # Edge half-lobes (start/stop at rest) are flanked on one side only, so they never count.
    def trim(x, pk):
        # Getting into / out of position (unracking, kicking dumbbells up) makes an edge lobe that is
        # much bigger or smaller than the reps: drop first/last lobe when it's an amplitude outlier.
        if len(pk) < 4: return pk
        med = np.median([x[i] for i in pk[1:-1]])
        out = lambda i: x[i] > hi_ratio * med or x[i] < lo_ratio * med
        return pk[1 if out(pk[0]) else 0: len(pk) - 1 if out(pk[-1]) else len(pk)]
    a, b = trim(s, lobes(s)), trim(-s, lobes(-s))
    peaks = a if len(a) >= len(b) else b
    return len(peaks), [p / HZ for p in peaks], period

if __name__ == '__main__':
    rng = np.random.default_rng(7)
    fails = 0
    for kind, gen in [('curl', curl), ('press', press)]:
        for reps in [3, 5, 8, 10, 12, 15]:
            for period in [1.2, 1.8, 2.5, 3.5, 5.0]:
                t, ua, g = session([still(5, rng), gen(reps, period, rng), still(5, rng)])
                ev = segment(t, ua)
                starts = [e for e in ev if e[0] == 'start']; ends = [e for e in ev if e[0] == 'end']
                seg_ok = len(starts) == 1 and len(ends) == 1 and abs(ends[0][1] - 5) < 0.6 and abs(ends[0][2] - (len(t) / HZ - 5)) < 0.6
                lo, hi = (int((ends[0][1] - 0.5) * HZ), int((ends[0][2] + 0.5) * HZ)) if ends else (int(5 * HZ), len(t) - int(5 * HZ))
                c, _, p = count_reps(ua[lo:hi], g[lo:hi])
                ok = c == reps and seg_ok
                fails += not ok
                if not ok:
                    print(f'{kind:5} reps={reps:2} period={period}: counted={c} period_est={p:.2f} seg={ev}')
    # negatives
    t, ua, g = session([still(20, rng)])
    print('still-only events:', segment(t, ua), 'reps:', count_reps(ua, g)[0])
    print('FAILS', fails)
