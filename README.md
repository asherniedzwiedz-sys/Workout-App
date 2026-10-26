# Liftlog

A workout tracker for iPhone + Apple Watch with Strong/Hevy-style logging, a Fitbod-style on-device routine builder,
Strava run import, reminders, Apple Health, and a native watchOS app that detects sets and counts reps from wrist motion.
Expo SDK 58 · React Native · TypeScript strict · expo-sqlite. Everything stays on your devices: no account, no backend.

| Phase | What | Runs in |
|---|---|---|
| 1 | Exercise library (73 lifts, muscle + equipment tags), active workout, set logging, rest timer | Expo Go |
| 2 | Routines: unlimited, default sets × reps × weight + rest per exercise | Expo Go |
| 3 | History, per-set detail, e1RM + top-set charts, automatic PRs | Expo Go |
| 4 | AI workout builder (on-device, no API key) | Expo Go |
| 5 | Strava OAuth + run import, Running tab, manual runs | Expo Go* |
| 6 | Reminders (local notifications per routine/day/time) | Expo Go |
| 7 | Apple Health workout sync, EAS development build | Dev build |
| 8 | Native SwiftUI watchOS app (manual logging, rest timer mirror, sync) | Dev build |
| 9 | Watch motion: set detection, rep counting, Core ML exercise classifier, predict-and-confirm | Dev build + real Watch |

\* Strava OAuth works in Expo Go only if Strava accepts your LAN IP as the callback domain. It's reliable in the dev build.

## Run it (Phases 1–6, Expo Go)

```bash
npm install
npm start            # = expo start --go ; scan the QR code with the Camera app
```

Checks: `npm run typecheck`, `npm test` (13 unit tests: PRs/e1RM, generator constraints, Strava mapping, accuracy math),
`npx eslint src`, `npx expo-doctor`.

### What to try in Expo Go

1. **Workout tab → Start Empty Workout → Add Exercise.** Type weight/reps (pre-filled from last time). Tap ✓: the row turns
   green and the rest timer starts at the bottom. Let it run out with the phone locked: it beeps and vibrates (in the
   foreground) or fires a notification (when locked). Tap the timer chip on an exercise to change its rest. Use ⋯ to swap or skip it.
2. **New routine**: add exercises, set sets × reps × weight (0 = use last weight) and rest. Start it with ▶.
3. **Finish** → workout detail with duration, volume, sets and 🏆 PRs. **Exercises tab →** any lift → e1RM and top-set charts.
4. **AI Workout Builder**: goal, days, equipment, length → Generate. Tap an exercise to swap it, Regenerate, Save.
5. **Running tab**: Log a Run (distance + time). **Settings → Strava**: see below.
6. **Settings → Reminders**: pick routine, days and time, toggle per reminder. Tapping the notification starts that routine.

### Strava

1. Create an app at <https://www.strava.com/settings/api>.
2. Set **Authorization Callback Domain** to the value shown in Settings → Strava: `localhost` in the dev build, or your
   computer's LAN IP in Expo Go.
3. Paste the client ID and secret (stored in the iOS Keychain), then tap **Connect Strava**. Running → **Import from Strava**
   pulls runs (Run / Trail Run / Virtual Run) with distance, moving time, pace and date. Re-imports are incremental and idempotent.

## Phases 7–9: EAS development build + Apple Watch

HealthKit, WatchConnectivity and the watch app are native, so they don't exist in Expo Go.

1. Edit `app.json`: set `ios.bundleIdentifier` to an id you own, and add `"appleTeamId": "XXXXXXXXXX"` under `ios`.
   The watch app gets `<bundleId>.watchkitapp`.
2. Register your iPhone: `npx eas-cli@latest device:create`.
3. Build: `npx eas-cli@latest build --profile development --platform ios`. EAS signs both the app and the watch
   target and adds HealthKit capabilities.
4. Install it on the iPhone. The watch app installs from the iPhone **Watch** app → Available Apps (or automatically).
5. Run `npm run start:dev` and open Liftlog on the phone.

On a Mac you can instead run `npx expo prebuild -p ios --clean && xed ios` and build the `LiftlogWatch` scheme.
Watch code lives in `targets/watch/` (outside `ios/`, so prebuild never overwrites it).

### Phase 8: watch app basics

The Watch shows your routines and the phone's active workout. Tap an exercise to log it with **Confirm**
(reps ±, weight with the Digital Crown in 2.5 lb steps, ± buttons, or dictation). Confirm starts the same per-exercise rest
timer on both devices. **End Workout** finishes it on the phone (Apple Health save included).

## Phase 9: motion detection, how it works

```
Watch: HKWorkoutSession ─► CMMotionManager 50 Hz ─► SetSegmenter ─► RepCounter (live) ─► Core ML windows
                                                     │ set ended
                                                     ▼
                              Confirm screen: exercise · reps ± · weight (Crown) ─► Confirm (1 tap)
                                                     │ outbox: sendMessage / transferUserInfo
iPhone: logWatchSet() ─► the same workouts / workout_exercises / sets rows a phone-logged set uses
                         + motion_predictions (predicted vs confirmed) for the Accuracy Report
```

**Hard constraints, and where they're enforced:**

* **Weight is never sensed.** `PendingSet.weight` comes from the last set this session, else the phone's planned/last weight
  (`WatchModel.weight(for:)`), and is always shown for confirmation.
* **Nothing is silently logged.** The pipeline only produces `PendingSet`s. Only `WatchModel.confirm` sends a set.
  Detections shorter than 4 s or with 0 reps are dropped, not logged.
* **Classification is routine-constrained.** `PredictionMath.combine(_, allowed:)` keeps only the active routine's
  exercises + Other/Rest and renormalizes. Freestyle (no routine) uses every label. Below 65% confidence the Watch shows
  **Not sure — pick exercise**.

Code map:

* `targets/watch/MotionCore/`: pure Swift (segmenter, rep counter, windows, CSV), also built as a SwiftPM package
  (`targets/Package.swift`) for tests and replay on a Mac.
* `targets/watch/*.swift`: the app (recorder, pipeline, WatchConnectivity outbox, Core ML wrapper, SwiftUI views).
* `src/watch.ts`, `src/db.ts` `logWatchSet`: the phone side.
* `src/app/motion/*`: Settings → Apple Watch → Motion Detection (setup, Calibrate, Accuracy Report, hidden Collect Data).
* `ml/`: training notebook + data module ([ml/README.md](ml/README.md)).

### How the rule-based defaults were chosen (9B)

The thresholds in `SegmenterConfig` / `RepCounterConfig` were tuned numerically on synthetic, physically modeled sets:
minimum-jerk strokes, lockout pauses, sensor noise, curls (gravity rotation) and presses (linear acceleration),
1–15 reps at 1.2–5 s per rep, plus fidgety rest as a negative case. On that data, curls and presses counted
exactly, and getting into position before a press costs at most ±1 rep. Synthetic data proves the logic, not your
gym: **real accuracy only comes from replaying your own CSVs**. The numpy reference used for tuning is in
[tools/motion-prototype/](tools/motion-prototype/).

```bash
cd targets                                   # needs Swift 5.9+ (Xcode, or the swift.org toolchain on Linux/WSL)
swift test                                   # MotionCore unit tests (segmenter, rep counter, windows, CSV, constraint math)
swift run motion-replay ~/Downloads/liftlog-motion-….csv   # counted vs actual reps per set + per-exercise accuracy
```

## What to test on a real Apple Watch + iPhone

Do these in order and don't move on until each works. **Phase 9 isn't done until you've confirmed that rep counting
and predict-and-confirm work on your own Watch for at least curls, dumbbell press and rows.** The Accuracy Report's
Phase 9 checklist tracks exactly that.

### 9A: motion pipeline + data collection
- [ ] Settings → Apple Watch → Motion Detection: set your wrist and dominant hand.
- [ ] Tap the "Motion detection v1" footer 5× → **Collect Data** appears on the phone and on the Watch.
- [ ] Phone Collect Data: pick Dumbbell Curl → Start Set → do 10 reps **with the Watch screen off** → End Set. The Watch shows
      live reps, then asks for actual reps → Save. Within a few seconds the recording appears in the phone list.
- [ ] Repeat from the Watch's own Collect Data screen.
- [ ] Record a few **Other / Rest** sets (walk around, re-rack).
- [ ] Export (CSV) → Share Sheet → AirDrop to the Mac. Open it: 20 columns, ~50 rows per second.
- [ ] Exercise pages for squat/deadlift/leg press/hip thrust/leg curl/leg extension say **MANUAL ONLY** with the reason.

### 9B: segmentation + rep counting (no ML)
- [ ] Start a routine on the Watch with auto-detect on. Stand still 3 s, do a set: "SET IN PROGRESS" + live count appears
      within ~1 s. Stop for 3 s: the Watch taps and the confirm screen appears.
- [ ] Rest with normal fidgeting: no false sets (or rarely, and **Not a set** dismisses it).
- [ ] Collect 6+ labeled sets each of curls, dumbbell press and rows. Then run `swift run motion-replay export.csv` and check
      the Accuracy Report → Rep counting. Target before 9C: **±1 rep on ≥ 90% of sets** for curls, presses and rows.
- [ ] If not: tune `SegmenterConfig` / `RepCounterConfig` against the replay output, rebuild, re-test.

### 9C: classifier
- [ ] Train with `ml/train.ipynb` (15+ sets per exercise + Other/Rest), copy `ExerciseClassifier.mlmodel` to `targets/watch/`, rebuild.
- [ ] Watch home no longer says "no exercise model yet".
- [ ] Airplane mode on both devices: detection still works (on-device only).
- [ ] An ambiguous set shows **Not sure — pick exercise** instead of a guess.

### 9D: predict-and-confirm
- [ ] After a set: vibration, predicted exercise, reps ±, pre-filled weight, and "NN% sure" when below 90%.
- [ ] Crown changes weight by 2.5 lb. ± buttons and dictation (🎤) work.
- [ ] **Confirm** = 1 tap: the set appears on the phone's workout screen (⌚︎ in history) and the rest timer starts on both.
- [ ] **Wrong exercise** in a routine lists the routine's exercises first. Picking one corrects the log, and a
      `correction` recording shows up in Collect Data.
- [ ] Settings → Motion Detection → **Accuracy Report** shows predicted vs confirmed and counted vs confirmed reps.

### 9E: personal calibration
- [ ] Settings → Motion Detection → **Calibrate**: pick exercises → 2 guided sets × 8–10 reps each, auto-labeled.
- [ ] Export → retrain on the Mac (personal sets weighted 3× + fine-tune) → rebuild → accuracy for those lifts improves.

### 9F: phone sync
- [ ] Confirm a set with the phone in another room / Bluetooth off: Watch home shows "1 waiting to sync".
      Bring it back: the set lands in the phone workout once, never duplicated.
- [ ] Force-quit the phone app, confirm sets on the Watch, reopen: the sets arrive (transferUserInfo).
- [ ] Watch-confirmed sets fill the next planned set of that exercise, exactly like tapping ✓ on the phone.

## Known limitations

* **Weight cannot be sensed.** There's no load sensor in a watch. Weight is always pre-filled and confirmed by you.
* **Leg exercises are manual only.** In squats, deadlifts, leg press, hip thrusts and leg curls/extensions your wrist barely
  moves (or holds a bar), so motion can't reliably see reps or tell these lifts apart. Log them by tapping the exercise.
* **Accuracy depends on the same wrist and consistent form.** The model learns how *your* wrist moves. Changing grip, tempo,
  range of motion or equipment, or recording on a different arm, lowers accuracy. Calibrate again when you change things.
* **The left/right wrist setting matters.** Motion on the other arm is mirrored, so a model trained on left-wrist data is
  wrong on the right wrist. Set it before recording, and train per wrist (`WRIST` in the notebook).
* Similar movements get confused (dumbbell vs hammer curl, flat vs incline press). Routine-constrained mode helps a lot.
* Getting into or out of position (unracking, kicking dumbbells up) can add or drop one rep. Reps are always editable.
* Training happens on a Mac. The Watch never retrains itself: calibration only collects data.
* Synthetic tuning isn't real-world validation; see "How the rule-based defaults were chosen".
* Apple Health: the phone writes the workout (type, start, end). Heart rate/calories from the Watch session aren't
  saved, to avoid duplicate workouts.
