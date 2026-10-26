"""Mirror of targets/MotionCoreTests/MotionCoreTests.swift: same RNG stream, same generator, same assertions,
run through the Python reference implementation (proto_motion.py)."""
import math
import numpy as np
import proto_motion as m

HZ = 50.0
MASK = (1 << 64) - 1

class Synth:
    def __init__(self, seed):
        self.state = seed & MASK; self.rows = []; self.t = 0.0
    def uniform(self):
        self.state = (self.state + 0x9E3779B97F4A7C15) & MASK
        z = self.state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        return ((z ^ (z >> 31)) >> 11) / float(1 << 53)
    def normal(self, sd):
        u1 = max(self.uniform(), 1e-12); u2 = self.uniform()
        return sd * math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    def append(self, ua, g, un, gn):
        r = [self.t, ua[0] + self.normal(un), ua[1] + self.normal(un), ua[2] + self.normal(un),
             g[0] + self.normal(gn), g[1] + self.normal(gn), g[2] + self.normal(gn)]
        self.rows.append(r); self.t += 1 / HZ
    def still(self, sec, g=(0, 0, -1)):
        for _ in range(int(sec * HZ)): self.append((0, 0, 0), g, 0.006, 0.002)
    def fidgety(self, sec):
        n = int(sec * HZ); bursts = []; at = 0.0
        while True:
            at += 1.5 + 2.5 * self.uniform()
            if at >= sec - 1: break
            bursts.append((int(at * HZ), int((0.3 + 0.4 * self.uniform()) * HZ), 0.03 + 0.03 * self.uniform()))
        for i in range(n):
            sd = next((b[2] for b in bursts if b[0] <= i < b[0] + b[1]), 0.006)
            self.append((0, 0, 0), (0, 0, -1), sd, 0.002)
    @staticmethod
    def minjerk(n): return [10 * (i / n) ** 3 - 15 * (i / n) ** 4 + 6 * (i / n) ** 5 for i in range(n)]
    @staticmethod
    def grad(x):
        n = len(x)
        return [x[1] - x[0] if i == 0 else x[n - 1] - x[n - 2] if i == n - 1 else (x[i + 1] - x[i - 1]) / 2 for i in range(n)]
    PRESS_G = (0.1, 0.2, -0.97)
    def reps(self, kind, count, period):
        for _ in range(count):
            p = period * (1 + (self.uniform() * 0.3 - 0.15))
            up = self.minjerk(int(p * 0.4 * HZ)); down = [1 - v for v in self.minjerk(int(p * 0.6 * HZ))]
            pos = up + [1] * int(0.25 * HZ) + down + [0] * int(0.125 * HZ)
            acc = [a * HZ * HZ for a in self.grad(self.grad(pos))]
            for x, a in zip(pos, acc):
                if kind == 'curl':
                    th = 125 * math.pi / 180 * x
                    self.append((0.02 * a, 0.035 * a, 0.01 * a), (0, -math.sin(th), -math.cos(th)), 0.02, 0.01)
                else:
                    self.append((0.006 * a, 0.004 * a, 0.045 * a), self.PRESS_G, 0.02, 0.01)
    def transition(self, g0, g1, sec):
        w = self.minjerk(int(sec * HZ)); acc = [a * HZ * HZ for a in self.grad(self.grad(w))]
        for k, a in zip(w, acc):
            g = [g0[j] * (1 - k) + g1[j] * k for j in range(3)]; nrm = math.sqrt(sum(v * v for v in g)); g = [v / nrm for v in g]
            self.append((0.01 * a, 0.03 * a, 0.05 * a), g, 0.02, 0.01)
    def arrays(self):
        a = np.array(self.rows); return a[:, 0], a[:, 1:4], a[:, 4:7]

def detect(s):
    t, ua, g = s.arrays(); out = []
    for e in m.segment(t, ua):
        if e[0] == 'end':
            sel = (t >= e[1] - 0.5) & (t <= e[2] + 0.5)
            out.append((e[1], e[2], m.count_reps(ua[sel], g[sel])[0]))
    return out

if __name__ == '__main__':
    fails = 0
    def check(cond, msg):
        global fails
        if not cond: fails += 1; print('FAIL', msg)

    seed = 1
    for kind in ['curl', 'press']:
        for reps in [3, 5, 8, 12]:
            for period in [1.5, 2.5, 4.0]:
                s = Synth(seed); seed += 1
                g = (0, 0, -1) if kind == 'curl' else Synth.PRESS_G
                s.still(5, g); s.reps(kind, reps, period); set_end = s.rows[-1][0]; s.still(5, g)
                sets = detect(s)
                check(len(sets) == 1, f'{kind} {reps}@{period} sets={sets}')
                if sets:
                    check(sets[0][2] == reps, f'{kind} {reps}@{period} reps={sets[0][2]}')
                    check(abs(sets[0][0] - 5) <= 0.6, f'{kind} {reps}@{period} start={sets[0][0]:.2f}')
                    check(abs(sets[0][1] - set_end) <= 0.6, f'{kind} {reps}@{period} end={sets[0][1]:.2f} vs {set_end:.2f}')
    for i, reps in enumerate([5, 8, 10]):
        s = Synth(100 + i); s.still(5); s.transition((0, 0, -1), Synth.PRESS_G, 1.5); s.reps('press', reps, 2.5)
        s.transition(Synth.PRESS_G, (0, 0, -1), 1.5); s.still(5)
        sets = detect(s); check(len(sets) == 1 and abs(sets[0][2] - reps) <= 1, f'setup {reps}: {sets}')
    s = Synth(7); s.still(30); t, ua, g = s.arrays()
    check(detect(s) == [] and m.count_reps(ua, g)[0] == 0, 'stillness')
    false_sets = 0
    for i in range(10):
        s = Synth(500 + i); s.fidgety(90); false_sets += len(detect(s))
    check(false_sets <= 2, f'fidget false sets {false_sets}')
    s = Synth(9); s.still(4); s.reps('curl', 3, 2); t, ua, g = s.arrays()
    check(any(e[0] == 'start' for e in m.segment(t, ua)), 'manual: started')
    print('false sets in fidget test:', false_sets)
    print('FAILS', fails)
