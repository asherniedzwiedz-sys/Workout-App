# Motion prototype (numpy)

The Python reference for `targets/watch/MotionCore`, used to tune the default thresholds before any Swift existed.
Synthetic data only. Real tuning uses your exported CSVs with `cd targets && swift run motion-replay export.csv`.

```bash
pip install numpy
python proto_motion.py        # crude sine-wave sets; 1 known miss (3 presses at 1.2 s/rep), see FAILS
python swift_mirror.py        # same streams + assertions as targets/MotionCoreTests (expects FAILS 0)
python make_replay_csv.py sample.csv   # phone-format export of synthetic sets, for trying motion-replay
```

If you change the algorithm, change `RepCounter.swift` / `SetSegmenter.swift` and `proto_motion.py` together.
