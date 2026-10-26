"""Loads Liftlog motion exports and turns them into classifier windows.

Must match the watch exactly (targets/watch/MotionCore/Classification.swift):
  * 50 Hz, windows of 125 samples (2.5 s) with hop 62 (50% overlap)
  * 12 channels in CHANNELS order, channel-major [12, 125] float32
  * yaw made relative to the window's first sample and wrapped to [-pi, pi]

Self-check (numpy only):  python motion_data.py --self-test
"""
import csv
import glob
import sys
from collections import Counter, defaultdict

import numpy as np

CHANNELS = ['ax', 'ay', 'az', 'rx', 'ry', 'rz', 'gx', 'gy', 'gz', 'roll', 'pitch', 'yaw']
WINDOW, HOP, HZ = 125, 62, 50
PERSONAL_KINDS = {'calibration', 'correction'}  # recorded by you on your watch: weighted up in training


def load_sessions(paths):
    """Reads one or more exported CSVs (phone export or single watch files) into per-session dicts."""
    sessions = {}
    files = [p for pattern in paths for p in sorted(glob.glob(pattern))]
    for path in files:
        with open(path, newline='') as f:
            for row in csv.DictReader(f):
                try:
                    values = [float(row[c]) for c in CHANNELS]
                except (KeyError, TypeError, ValueError):
                    continue  # malformed row
                s = sessions.setdefault(row['session_id'], {
                    'id': row['session_id'], 'exercise_id': row['exercise_id'], 'kind': row['kind'],
                    'wrist': row['wrist'], 'dominant_hand': row['dominant_hand'],
                    'actual_reps': int(row['actual_reps'] or 0), 'rows': [],
                })
                s['rows'].append(values)
    out = []
    for s in sessions.values():
        s['data'] = np.asarray(s.pop('rows'), dtype=np.float64)
        out.append(s)
    return out, files


def windows(data):
    """[T, 12] samples -> [N, 12, 125] float32 windows (same as ClassifierInput.windows in Swift)."""
    if len(data) < WINDOW:
        return np.zeros((0, len(CHANNELS), WINDOW), dtype=np.float32)
    out = []
    for start in range(0, len(data) - WINDOW + 1, HOP):
        w = data[start:start + WINDOW].copy()
        d = w[:, 11] - w[0, 11]
        w[:, 11] = np.arctan2(np.sin(d), np.cos(d))
        out.append(w.T.astype(np.float32))
    return np.stack(out)


def summarize(sessions):
    by = Counter((s['exercise_id'], 'personal' if s['kind'] in PERSONAL_KINDS else 'generic') for s in sessions)
    wrists = Counter(s['wrist'] for s in sessions)
    labels = sorted({s['exercise_id'] for s in sessions})
    print(f'{len(sessions)} sets, wrists: {dict(wrists)}')
    for label in labels:
        print(f"  {label:26} generic {by[(label, 'generic')]:3}  personal {by[(label, 'personal')]:3}")
    if len(wrists) > 1:
        print('WARNING: mixed wrists. Wrist motion is mirrored on the other arm; set WRIST to train for the one you wear.')
    return labels


def build_dataset(sessions, labels, personal_weight=3.0):
    """Windows + labels + per-window weights + session ids (split by session to avoid overlap leakage)."""
    X, y, w, groups = [], [], [], []
    index = {label: i for i, label in enumerate(labels)}
    for s in sessions:
        if s['exercise_id'] not in index:
            continue
        win = windows(s['data'])
        X.append(win)
        y += [index[s['exercise_id']]] * len(win)
        w += [personal_weight if s['kind'] in PERSONAL_KINDS else 1.0] * len(win)
        groups += [s['id']] * len(win)
    if not X:
        raise ValueError('no windows: record more data (each set needs >= 2.5 s)')
    return np.concatenate(X), np.asarray(y), np.asarray(w, dtype=np.float32), np.asarray(groups)


def split_by_session(sessions, test_fraction=0.2, seed=0):
    """Holds out whole sets per exercise, preferring personal sets for the test split (that's what you'll use)."""
    rng = np.random.default_rng(seed)
    by_label = defaultdict(list)
    for s in sessions:
        by_label[s['exercise_id']].append(s)
    train, test = [], []
    for group in by_label.values():
        rng.shuffle(group)
        group.sort(key=lambda s: s['kind'] not in PERSONAL_KINDS)
        k = max(1, round(len(group) * test_fraction)) if len(group) >= 3 else 0
        test += group[:k]
        train += group[k:]
    return train, test


def _self_test():
    data = np.zeros((300, 12))
    data[:, 0] = np.arange(300)
    data[:, 11] = -3.1
    data[0, 11] = 3.1
    w = windows(data)
    assert w.shape == (3, 12, 125), w.shape                      # (300 - 125) // 62 + 1
    assert w[1, 0, 0] == 62, 'channel-major, 2nd window starts at sample 62'
    assert w[0, 11, 0] == 0, 'yaw relative to window start'
    assert abs(w[0, 11, 1] - (2 * np.pi - 6.2)) < 1e-4, 'yaw wrapped across +-pi'
    assert windows(data[:100]).shape[0] == 0
    sessions = [{'id': f's{i}', 'exercise_id': ['dumbbell-curl', 'dumbbell-row'][i % 2], 'kind': ['collect', 'calibration'][i % 3 == 0],
                 'wrist': 'left', 'dominant_hand': 'right', 'actual_reps': 8, 'data': np.random.default_rng(i).normal(size=(400, 12))} for i in range(10)]
    train, test = split_by_session(sessions)
    assert not {s['id'] for s in train} & {s['id'] for s in test}, 'no session in both splits'
    X, y, wts, groups = build_dataset(train, ['dumbbell-curl', 'dumbbell-row'])
    assert X.shape[1:] == (12, 125) and len(X) == len(y) == len(wts) == len(groups)
    assert set(np.unique(wts)) <= {1.0, 3.0}
    print('motion_data self-test OK')


if __name__ == '__main__' and '--self-test' in sys.argv:
    _self_test()
