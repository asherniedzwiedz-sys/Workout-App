// Replays exported motion CSVs offline through the same MotionCore code the watch runs (Phase 9B).
//   cd targets && swift run motion-replay ~/Downloads/liftlog-motion-2026-10-23-40sets.csv
// Prints counted vs actual reps per set and accuracy per exercise, so thresholds can be tuned before 9C.
import Foundation
import MotionCore

guard let path = CommandLine.arguments.dropFirst().first else {
    print("usage: motion-replay <export.csv>")
    exit(2)
}
guard let text = try? String(contentsOfFile: path, encoding: .utf8) else {
    print("cannot read \(path)")
    exit(1)
}

let sessions = MotionCSV.decode(text).filter { $0.exerciseId != PredictionMath.otherLabel && $0.actualReps > 0 }
if sessions.isEmpty {
    print("no labeled sets with actual reps in \(path)")
    exit(1)
}

func pad(_ s: String, _ n: Int) -> String { s.count >= n ? s : s + String(repeating: " ", count: n - s.count) }

print(pad("exercise", 26) + pad("kind", 12) + "actual  offline  watch  auto-sets")
var byExercise: [String: [(actual: Int, counted: Int)]] = [:]
for s in sessions {
    let counted = RepCounter.count(s.samples).reps
    var segmenter = SetSegmenter()
    var autoSets = 0
    for x in s.samples { if case .ended? = segmenter.push(x) { autoSets += 1 } }
    byExercise[s.exerciseId, default: []].append((s.actualReps, counted))
    let mark = counted == s.actualReps ? "" : abs(counted - s.actualReps) == 1 ? "  ±1" : "  ✗"
    print(pad(s.exerciseId, 26) + pad(s.kind, 12) + pad("\(s.actualReps)", 8) + pad("\(counted)", 9) + pad("\(s.countedReps)", 7) + "\(autoSets)\(mark)")
}

print("\n" + pad("exercise", 26) + "sets  exact   ±1     MAE   usable(±1 ≥ 90%, n ≥ 6)")
for (exercise, rows) in byExercise.sorted(by: { $0.key < $1.key }) {
    let n = Double(rows.count)
    let exact = Double(rows.filter { $0.actual == $0.counted }.count) / n
    let within1 = Double(rows.filter { abs($0.actual - $0.counted) <= 1 }.count) / n
    let mae = rows.map { Double(abs($0.actual - $0.counted)) }.reduce(0, +) / n
    let usable = rows.count >= 6 && within1 >= 0.9
    print(pad(exercise, 26) + pad("\(rows.count)", 6) + pad(String(format: "%.0f%%", exact * 100), 8)
        + pad(String(format: "%.0f%%", within1 * 100), 7) + pad(String(format: "%.2f", mae), 6) + (usable ? "✓" : "–"))
}
print("\n'auto-sets' = sets the rule-based segmenter found in that recording (needs ~3 s of stillness before the set).")
