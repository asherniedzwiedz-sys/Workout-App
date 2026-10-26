"""Writes a phone-format export (20 columns) of synthetic labeled sets, for smoke-testing motion-replay."""
import sys
from swift_mirror import Synth

HEADER = 'session_id,exercise_id,kind,wrist,dominant_hand,actual_reps,counted_reps,t,ax,ay,az,rx,ry,rz,gx,gy,gz,roll,pitch,yaw'
rows = [HEADER]
seed = 900
for exercise, kind in [('dumbbell-curl', 'curl'), ('dumbbell-shoulder-press', 'press')]:
    for reps, period in [(6, 1.8), (8, 2.5), (10, 2.0), (12, 3.0), (8, 4.0), (5, 1.5)]:
        s = Synth(seed); seed += 1
        g = (0, 0, -1) if kind == 'curl' else Synth.PRESS_G
        s.still(4, g); s.reps(kind, reps, period); s.still(4, g)
        t0 = s.rows[0][0]
        for t, ax, ay, az, gx, gy, gz in s.rows:
            rows.append(f's{seed},{exercise},collect,left,right,{reps},0,{t - t0:.5f},{ax:.5f},{ay:.5f},{az:.5f},0,0,0,{gx:.5f},{gy:.5f},{gz:.5f},0,0,0')
open(sys.argv[1], 'w').write('\n'.join(rows) + '\n')
print('wrote', len(rows) - 1, 'samples')
