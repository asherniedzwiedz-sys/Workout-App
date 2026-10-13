import Foundation

// Mirrors src/domain/watch.ts (WatchState). The phone sends it as a JSON string.

struct WatchSet: Codable, Identifiable, Hashable {
  let id: String
  let label: String
  let type: String
  var weight: Double?
  var reps: Int?
  var done: Bool
}

struct WatchExercise: Codable, Identifiable, Hashable {
  let key: String
  let name: String
  let restSec: Int
  let skipped: Bool
  var sets: [WatchSet]

  var id: String { key }
}

struct WatchCursor: Codable, Hashable {
  let exerciseKey: String
  let setId: String
}

struct WatchRoutine: Codable, Identifiable, Hashable {
  let id: Int
  let name: String
  let exerciseCount: Int
}

struct WatchState: Codable {
  let v: Int
  let active: Bool
  let workoutName: String
  /// Epoch milliseconds.
  let startedAt: Double
  /// Epoch milliseconds, or nil when not resting.
  var restEndsAt: Double?
  let restDuration: Int
  var exercises: [WatchExercise]
  var current: WatchCursor?
  let routines: [WatchRoutine]
  let sentAt: Double

  var startDate: Date { Date(timeIntervalSince1970: startedAt / 1000) }

  var restEndDate: Date? { restEndsAt.map { Date(timeIntervalSince1970: $0 / 1000) } }

  var completedSets: Int {
    exercises.reduce(0) { total, exercise in total + exercise.sets.filter(\.done).count }
  }

  func exercise(_ key: String) -> WatchExercise? {
    exercises.first { $0.key == key }
  }

  /// First unfinished set of the first unfinished, non-skipped exercise (matches the phone).
  func nextPending() -> WatchCursor? {
    for exercise in exercises where !exercise.skipped {
      if let set = exercise.sets.first(where: { !$0.done }) {
        return WatchCursor(exerciseKey: exercise.key, setId: set.id)
      }
    }
    return nil
  }
}

enum Format {
  static func weight(_ value: Double?) -> String {
    guard let value, value > 0 else { return "BW" }
    if value.rounded() == value { return "\(Int(value)) lb" }
    return String(format: "%.1f lb", value)
  }
}
