import Foundation
import WatchKit

/// A detected (or manually started) set waiting for the user. Nothing reaches the phone until Confirm.
struct PendingSet: Identifiable {
    let id = UUID()
    let uid = UUID().uuidString
    var exerciseId: String?          // nil = "Not sure — pick exercise"
    var ranked: [LabelProbability]   // routine-constrained top 3, best first
    var notSure: Bool
    var looksLikeRest: Bool
    var repsCounted: Int?
    var reps: Int
    var weight: Double               // never sensed: pre-filled, user-confirmed
    let startedAt: Date
    let endedAt: Date
    let samples: [MotionSample]
    let mode: String                 // "routine" | "freestyle" | "manual"
    var corrected = false
}

struct LocalWorkout: Equatable {
    var name: String
    var routineId: Int?
    var startedAt: Date
    var exercises: [PlanExercise]
    var phoneWorkoutId: Int?
}

struct RecordingState: Equatable {
    enum Phase: Equatable { case recording, review(counted: Int) }
    var exerciseId: String
    var kind: RecordingMeta.Kind
    var startedAt: Date
    var phase: Phase = .recording
    var liveReps = 0
}

@MainActor
final class WatchModel: ObservableObject {
    @Published private(set) var context = PhoneContext()
    @Published private(set) var workout: LocalWorkout?
    @Published private(set) var tracking = false
    @Published var showWorkout = false
    @Published private(set) var pending: [PendingSet] = []
    @Published private(set) var liveReps: Int?
    @Published private(set) var liveGuess: String?
    @Published var restEndsAt: Date? { didSet { scheduleRestAlert() } }
    @Published private(set) var recording: RecordingState?
    @Published private(set) var phoneReachable = false
    @Published private(set) var queuedForPhone = 0
    @Published var errorMessage: String?
    var collectScreenOpen = false

    let classifier: MotionClassifier
    private let link = PhoneLink()
    private let recorder = MotionRecorder()
    private let pipeline: MotionPipeline
    private var sessionWeights: [String: Double] = [:]
    private var lastPhoneWorkoutId: Int?
    private var recordedSamples: [MotionSample] = []
    private var restAlert: Task<Void, Never>?
    private var idleStop: Task<Void, Never>?
    private var lastSetEnd: Date?

    init() {
        let classifier = MotionClassifier()
        self.classifier = classifier
        pipeline = MotionPipeline(classifier: classifier)
        Self.connect(recorder, pipeline, self)
        link.onContext = { [weak self] in self?.apply($0) }
        link.onCommand = { [weak self] in await self?.handle(command: $0) ?? ["ok": false] }
        link.onStatus = { [weak self] reachable, queued in
            self?.phoneReachable = reachable
            self?.queuedForPhone = queued
        }
        link.activate()
    }

    /// Wired outside the main actor: these closures run on the motion queue.
    nonisolated private static func connect(_ recorder: MotionRecorder, _ pipeline: MotionPipeline, _ model: WatchModel) {
        recorder.onSample = { pipeline.push($0) }
        pipeline.emit = { [weak model] event in Task { @MainActor in model?.handle(event) } }
    }

    // MARK: Settings from the phone

    var autoDetect: Bool { context.settings?.autoDetect ?? true }
    var devMode: Bool { context.settings?.devMode ?? false }
    var wrist: String { context.settings?.wrist ?? "left" }
    var dominantHand: String { context.settings?.dominantHand ?? "right" }
    var mode: String { workout?.routineId != nil ? "routine" : "freestyle" }

    /// Hard constraint 3: with a routine active, only its exercises (+ Other/Rest) are candidates. Freestyle = all.
    var allowedLabels: Set<String>? {
        guard let w = workout, w.routineId != nil else { return nil }
        return Set(w.exercises.map(\.id))
    }

    /// Auto-detect is pointless for a routine with only manual-only (lower-body) lifts.
    var detectable: Bool { allowedLabels.map { !$0.isDisjoint(with: Seed.ids) } ?? true }
    var listening: Bool { tracking && autoDetect && detectable && recording == nil }

    func name(_ id: String) -> String { Seed.name(id, in: workout?.exercises ?? []) }

    // MARK: Workout lifecycle

    private func apply(_ c: PhoneContext) {
        context = c
        if let ms = c.restEndsAt, Date(timeIntervalSince1970: ms / 1000) > Date() {
            restEndsAt = Date(timeIntervalSince1970: ms / 1000)
        }
        if let a = c.active {
            if workout == nil || workout?.phoneWorkoutId == nil || workout?.phoneWorkoutId == a.workoutId {
                workout = LocalWorkout(name: a.name, routineId: a.routineId, startedAt: Date(timeIntervalSince1970: a.startedAt / 1000),
                                       exercises: a.exercises, phoneWorkoutId: a.workoutId)
            }
            lastPhoneWorkoutId = a.workoutId
        } else if let last = lastPhoneWorkoutId, workout?.phoneWorkoutId == last {
            endLocal() // finished or discarded on the phone
        }
        configurePipeline()
    }

    func start(routine: RoutineContext?) async {
        let now = Date()
        workout = LocalWorkout(name: routine?.name ?? "Workout", routineId: routine?.id, startedAt: now, exercises: routine?.exercises ?? [], phoneWorkoutId: nil)
        var ping: [String: Any] = ["type": "start", "at": unixMs(now)]
        if let id = routine?.id { ping["routineId"] = id }
        link.sendIfReachable(ping) // the first confirmed set creates the phone workout anyway
        showWorkout = true
        await startTracking()
    }

    func startTracking() async {
        do {
            try await recorder.start()
            tracking = true
            idleStop?.cancel()
        } catch {
            errorMessage = error.localizedDescription
        }
        configurePipeline()
    }

    func finishWorkout() {
        let uid = UUID().uuidString
        link.enqueue(uid: uid, payload: ["type": "finish", "uid": uid, "at": unixMs(Date())])
        endLocal()
    }

    private func endLocal() {
        workout = nil
        lastPhoneWorkoutId = nil
        pending = []
        liveReps = nil
        restEndsAt = nil
        showWorkout = false
        if recording == nil && !collectScreenOpen { stopTracking() }
        configurePipeline()
    }

    private func stopTracking() {
        recorder.stop()
        tracking = false
        let p = pipeline
        recorder.queue.async { p.reset() }
    }

    private func configurePipeline() {
        let detect = listening && workout != nil
        let allowed = allowedLabels
        let p = pipeline
        recorder.queue.async {
            p.autoDetect = detect
            p.allowed = allowed
        }
    }

    // MARK: Motion events → predict-and-confirm (9D)

    private func handle(_ event: MotionPipeline.Event) {
        switch event {
        case .setStarted:
            liveReps = 0
            liveGuess = nil
            WKInterfaceDevice.current().play(.start)
        case let .live(reps, guess):
            guard liveReps != nil else { return }
            liveReps = reps
            liveGuess = guess
        case let .setEnded(capture):
            liveReps = nil
            liveGuess = nil
            propose(capture)
        case let .recordingLive(reps):
            recording?.liveReps = reps
            link.sendIfReachable(["type": "collect", "counted": reps])
        }
    }

    func endSetNow() {
        let p = pipeline
        recorder.queue.async { p.endSetNow() }
    }

    private func propose(_ capture: MotionPipeline.SetCapture) {
        // Too short / no reps: it wasn't a set. Nothing is logged either way.
        guard capture.end - capture.start >= 4, capture.reps >= 1 else { return }
        let ranked = Array(PredictionMath.combine(capture.windows, allowed: allowedLabels).prefix(3))
        let notSure = ranked.isEmpty || PredictionMath.isNotSure(ranked)
        let top = notSure ? nil : ranked.first?.label
        let rest = top == PredictionMath.otherLabel
        let exerciseId = rest ? nil : top
        pending.append(PendingSet(exerciseId: exerciseId, ranked: ranked, notSure: notSure, looksLikeRest: rest,
                                  repsCounted: capture.reps, reps: capture.reps, weight: exerciseId.map(weight(for:)) ?? 0,
                                  startedAt: recorder.date(at: capture.start), endedAt: recorder.date(at: capture.end),
                                  samples: capture.samples, mode: mode))
        WKInterfaceDevice.current().play(.notification)
    }

    /// Manual logging (auto-detect off, manual-only lifts, or a missed set): same confirm screen, no prediction.
    func logManually(_ exerciseId: String) {
        let plan = workout?.exercises.first(where: { $0.id == exerciseId })
        pending.append(PendingSet(exerciseId: exerciseId, ranked: [], notSure: false, looksLikeRest: false, repsCounted: nil,
                                  reps: plan?.reps ?? 10, weight: weight(for: exerciseId), startedAt: lastSetEnd ?? Date(),
                                  endedAt: Date(), samples: [], mode: "manual"))
    }

    /// Hard constraint 1: weight is never sensed — last set this session, else the phone's plan / last workout.
    func weight(for id: String) -> Double {
        sessionWeights[id] ?? workout?.exercises.first(where: { $0.id == id })?.weight ?? context.lastWeights?[id] ?? 0
    }

    func update(_ id: PendingSet.ID, _ change: (inout PendingSet) -> Void) {
        guard let i = pending.firstIndex(where: { $0.id == id }) else { return }
        change(&pending[i])
    }

    /// One tap: logs the set, mirrors it to the phone, starts the rest timer.
    func confirm(_ id: PendingSet.ID) {
        guard let p = pending.first(where: { $0.id == id }), let exerciseId = p.exerciseId else { return }
        let manual = p.mode == "manual"
        let payload = SetPayload(uid: p.uid, exerciseId: exerciseId, reps: p.reps, weightLbs: p.weight,
                                 startedAt: unixMs(p.startedAt), endedAt: unixMs(p.endedAt), routineId: workout?.routineId,
                                 predictedExerciseId: manual || p.notSure ? nil : p.ranked.first?.label,
                                 confidence: manual ? nil : p.ranked.first?.p, repsCounted: p.repsCounted,
                                 top3: manual ? nil : p.ranked.map { .init(id: $0.label, p: $0.p) }, mode: manual ? nil : p.mode)
        link.enqueue(uid: p.uid, payload: payload.dictionary)
        sessionWeights[exerciseId] = p.weight
        lastSetEnd = p.endedAt
        if let i = workout?.exercises.firstIndex(where: { $0.id == exerciseId }) {
            workout?.exercises[i].done = (workout?.exercises[i].done ?? 0) + 1
            workout?.exercises[i].weight = p.weight
            workout?.exercises[i].reps = p.reps
        } else {
            workout?.exercises.append(PlanExercise(id: exerciseId, name: name(exerciseId), motion: Seed.ids.contains(exerciseId) ? "wrist" : nil,
                                                   restSec: 90, sets: 1, done: 1, reps: p.reps, weight: p.weight))
        }
        pending.removeAll { $0.id == id }
        startRest(seconds: workout?.exercises.first(where: { $0.id == exerciseId })?.restSec ?? 90)
        WKInterfaceDevice.current().play(.success)
    }

    func dismiss(_ id: PendingSet.ID) {
        pending.removeAll { $0.id == id }
    }

    /// "Wrong exercise" / "Not sure" pick: corrects the pending log and saves this set's motion as labeled training data.
    func correct(_ id: PendingSet.ID, to exerciseId: String) {
        guard let p = pending.first(where: { $0.id == id }) else { return }
        update(id) {
            $0.exerciseId = exerciseId
            $0.corrected = true
            $0.looksLikeRest = false
            $0.weight = weight(for: exerciseId)
        }
        guard !p.samples.isEmpty else { return }
        save(samples: p.samples, meta: RecordingMeta(kind: .correction, exerciseId: exerciseId, wrist: wrist, dominantHand: dominantHand,
                                                     actualReps: p.reps, countedReps: p.repsCounted ?? 0, startedAt: Int64(unixMs(p.startedAt))))
    }

    // MARK: Rest timer (same per-exercise rest seconds as the phone; the phone mirrors it back)

    func startRest(seconds: Int) {
        restEndsAt = seconds > 0 ? Date().addingTimeInterval(TimeInterval(seconds)) : nil
    }

    func extendRest(by seconds: Int) {
        if let end = restEndsAt { restEndsAt = end.addingTimeInterval(TimeInterval(seconds)) }
    }

    private func scheduleRestAlert() {
        restAlert?.cancel()
        guard let end = restEndsAt else { return }
        restAlert = Task { [weak self] in
            let wait = end.timeIntervalSinceNow
            if wait > 0 { try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000)) }
            guard !Task.isCancelled, let self, self.restEndsAt == end else { return }
            WKInterfaceDevice.current().play(.notification)
            self.restEndsAt = nil
        }
    }

    // MARK: Labeled recordings: Collect Data (9A) and Calibrate (9E)

    private func handle(command m: [String: Any]) async -> [String: Any] {
        switch m["cmd"] as? String {
        case "record":
            guard let id = m["exerciseId"] as? String, let kind = (m["kind"] as? String).flatMap(RecordingMeta.Kind.init(rawValue:)) else {
                return ["ok": false, "error": "bad record command"]
            }
            return await beginRecording(id, kind: kind) ? ["ok": true] : ["ok": false, "error": errorMessage ?? "could not start motion"]
        case "stop":
            guard let counted = await stopRecording() else { return ["ok": false, "error": "not recording"] }
            return ["ok": true, "counted": counted]
        case "save":
            guard let actual = m["actualReps"] as? Int, saveRecording(actualReps: actual) else { return ["ok": false, "error": "nothing to save"] }
            return ["ok": true]
        case "discard":
            discardRecording()
            return ["ok": true]
        default:
            return ["ok": false, "error": "unknown command"]
        }
    }

    func beginRecording(_ exerciseId: String, kind: RecordingMeta.Kind) async -> Bool {
        if !tracking { await startTracking() }
        guard tracking else { return false }
        let p = pipeline
        recorder.queue.async { p.beginRecording() }
        recording = RecordingState(exerciseId: exerciseId, kind: kind, startedAt: Date())
        configurePipeline()
        WKInterfaceDevice.current().play(.start)
        return true
    }

    func stopRecording() async -> Int? {
        guard var r = recording, r.phase == .recording else { return nil }
        let p = pipeline
        let samples = await withCheckedContinuation { continuation in
            recorder.queue.async { continuation.resume(returning: p.endRecording()) }
        }
        let counted = RepCounter.count(samples).reps
        recordedSamples = samples
        r.phase = .review(counted: counted)
        recording = r
        WKInterfaceDevice.current().play(.stop)
        return counted
    }

    @discardableResult
    func saveRecording(actualReps: Int) -> Bool {
        guard let r = recording, case let .review(counted) = r.phase else { return false }
        save(samples: recordedSamples, meta: RecordingMeta(kind: r.kind, exerciseId: r.exerciseId, wrist: wrist, dominantHand: dominantHand,
                                                           actualReps: actualReps, countedReps: counted, startedAt: Int64(unixMs(r.startedAt))))
        finishRecording()
        return true
    }

    func discardRecording() {
        let p = pipeline
        if recording?.phase == .recording { recorder.queue.async { _ = p.endRecording() } }
        finishRecording()
    }

    private func finishRecording() {
        recording = nil
        recordedSamples = []
        configurePipeline()
        scheduleIdleStop()
    }

    /// Keeps motion warm between calibration sets, then stops it to save battery.
    func scheduleIdleStop() {
        idleStop?.cancel()
        idleStop = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 180 * 1_000_000_000)
            guard !Task.isCancelled, let self, self.workout == nil, self.recording == nil, !self.collectScreenOpen else { return }
            self.stopTracking()
        }
    }

    /// Writes the CSV to Documents/recordings and hands it to WCSession; the phone keeps it in Documents/FilesReceived.
    private func save(samples: [MotionSample], meta: RecordingMeta) {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("recordings", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let url = dir.appendingPathComponent(meta.fileName)
            try MotionCSV.encode(samples, meta: meta, sessionId: UUID().uuidString).write(to: url, atomically: true, encoding: .utf8)
            link.transferRecording(url, metadata: ["fileName": meta.fileName])
        } catch {
            errorMessage = "Couldn't save recording: \(error.localizedDescription)"
        }
    }
}
