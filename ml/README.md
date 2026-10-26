# Exercise classifier (Phase 9C / 9E)

Training happens **on your Mac**. The Watch never trains anything: it only runs the exported
`ExerciseClassifier.mlmodel` offline. Calibrating or correcting sets just collects more labeled data;
you get a better model only after you rebuild it here and rebuild the watch app.

## 1. Get data

On the iPhone, under Settings → Apple Watch → Motion Detection:

* **Collect Data**: hidden. Tap the "Motion detection v1" footer 5 times to unlock it. Use it to record
  generic sets, including some **Other / Rest** sets (walking between machines, re-racking, sitting).
* **Calibrate**: 2 sets × 8–10 reps of each exercise you pick. Saved as your personal dataset (`kind = calibration`).
* **Wrong exercise** picks on the Watch are saved automatically (`kind = correction`).
* **Export (CSV)**: the Share Sheet gives you one merged CSV. AirDrop it to the Mac and put it in `ml/data/`.

Aim for 15–20 sets per exercise to start. Five exercises with lots of data beat thirteen with a few sets each.

## 2. Train

```bash
cd ml
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python motion_data.py --self-test     # windowing must match the watch
jupyter notebook train.ipynb          # Run All
```

In the first cell, set `WRIST` to the wrist you wear the Watch on. The notebook:

1. Loads every CSV, filters to that wrist, and prints sets per exercise (generic vs personal).
2. Holds out whole sets for testing (a set's overlapping windows never leak into training).
3. Trains a small 1D CNN on 2.5 s / 50% overlap windows of the 12 motion channels.
4. **Personal data first**: calibration and correction windows count `PERSONAL_WEIGHT` (3×) in the loss.
   It then fine-tunes `FINETUNE_EPOCHS` more epochs on personal data alone, biasing the model toward how *you* move.
5. Reports set-level accuracy the way the watch computes it (average of the window probabilities),
   the "not sure" rate (top < 0.65), and a confusion matrix.
6. Exports `ExerciseClassifier.mlmodel`: input `motion` = MLMultiArray `[1, 12, 125]`, plus class probabilities.

## 3. Ship it to the Watch

```bash
cp ExerciseClassifier.mlmodel ../targets/watch/
cd .. && npx expo prebuild -p ios --clean && eas build --profile development --platform ios
```

Xcode compiles it into `ExerciseClassifier.mlmodelc` in the watch bundle. `MotionClassifier.swift` loads it by name.
Without a model, the watch still detects sets and counts reps, but always asks you to pick the exercise.

## Rebuilding with more personal data

Calibrate (or keep correcting on the Watch), export again, drop the new CSV into `ml/data/` next to the old ones
(duplicate sessions are merged by `session_id`), Run All, copy the model, rebuild. That's the whole loop.

## Contract with the watch (don't change one side only)

| | Watch (`MotionCore/Classification.swift`) | Here (`motion_data.py`) |
|---|---|---|
| Window | 125 samples, hop 62 | `WINDOW = 125`, `HOP = 62` |
| Channels | ax ay az rx ry rz gx gy gz roll pitch yaw | `CHANNELS` |
| Layout | channel-major `[12 × 125]` | `w.T` |
| Yaw | relative to window start, wrapped | same |
| Other/Rest label | `"other"` | `"other"` |
| Labels | exercise ids from `src/logic/exercises.ts` | from the CSV `exercise_id` |
