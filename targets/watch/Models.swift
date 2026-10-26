import Foundation

// MARK: Phone → watch application context (built by pushContext() in src/watch.ts)

struct PhoneContext: Codable {
    var settings: ContextSettings?
    var active: ActiveContext?
    var routines: [RoutineContext]?
    var lastWeights: [String: Double]?
    /// Unix ms; the phone's rest timer.
    var restEndsAt: Double?
    /// Uids of watch messages the phone has stored (clears them from the outbox).
    var acks: [String]?

    init() {}

    init?(dictionary: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(dictionary),
              let data = try? JSONSerialization.data(withJSONObject: dictionary),
              let decoded = try? JSONDecoder().decode(PhoneContext.self, from: data) else { return nil }
        self = decoded
    }
}

struct ContextSettings: Codable {
    var wrist: String?
    var dominantHand: String?
    var autoDetect: Bool?
    var devMode: Bool?
}

struct ActiveContext: Codable {
    var workoutId: Int
    var name: String
    var routineId: Int?
    var startedAt: Double
    var exercises: [PlanExercise]
}

struct RoutineContext: Codable, Identifiable, Hashable {
    var id: Int
    var name: String
    var exercises: [PlanExercise]
}

struct PlanExercise: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    /// "wrist" = watch can detect it, "manual" = lower-body lift, log by hand.
    var motion: String?
    var restSec: Int
    var sets: Int
    var done: Int?
    var reps: Int
    var weight: Double
}

// MARK: Watch → phone (handled by handle() in src/watch.ts, stored by logWatchSet() in src/db.ts)

struct SetPayload: Encodable {
    var type = "set"
    var uid: String
    var exerciseId: String
    var reps: Int
    var weightLbs: Double
    var startedAt: Double
    var endedAt: Double
    var routineId: Int?
    var predictedExerciseId: String?
    var confidence: Double?
    var repsCounted: Int?
    var top3: [Guess]?
    var mode: String?

    struct Guess: Encodable { var id: String; var p: Double }
}

extension Encodable {
    /// Property-list dictionary for WCSession (nil optionals are omitted).
    var dictionary: [String: Any] {
        guard let data = try? JSONEncoder().encode(self) else { return [:] }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }
}

func unixMs(_ date: Date) -> Double { (date.timeIntervalSince1970 * 1000).rounded() }

// MARK: v1 motion seed list — must match WRIST_SEED_IDS in src/logic/exercises.ts and the classifier labels.

struct SeedExercise: Identifiable, Hashable {
    let id: String
    let name: String
}

enum Seed {
    static let exercises: [SeedExercise] = [
        .init(id: "dumbbell-curl", name: "Dumbbell Curl"),
        .init(id: "hammer-curl", name: "Hammer Curl"),
        .init(id: "lateral-raise", name: "Lateral Raise"),
        .init(id: "front-raise", name: "Front Raise"),
        .init(id: "tricep-extension", name: "DB Tricep Extension"),
        .init(id: "dumbbell-shoulder-press", name: "DB Shoulder Press"),
        .init(id: "dumbbell-bench-press", name: "DB Bench Press"),
        .init(id: "barbell-bench-press", name: "Barbell Bench Press"),
        .init(id: "overhead-press", name: "Overhead Press"),
        .init(id: "barbell-row", name: "Barbell Row"),
        .init(id: "dumbbell-row", name: "Dumbbell Row"),
        .init(id: "push-up", name: "Push-Up"),
        .init(id: "chest-fly", name: "Chest Fly"),
    ]
    static let other = SeedExercise(id: "other", name: "Other / Rest")
    static let ids = Set(exercises.map(\.id))

    static func name(_ id: String, in workout: [PlanExercise] = []) -> String {
        workout.first(where: { $0.id == id })?.name ?? (exercises + [other]).first(where: { $0.id == id })?.name ?? id
    }
}
