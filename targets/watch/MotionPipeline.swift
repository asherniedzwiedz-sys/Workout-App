import Foundation

/// Lives on MotionRecorder.queue only. Turns the 50 Hz stream into set events (9B segmenter + live reps)
/// and sliding-window classifier predictions during the set (9C). Never logs anything itself: a finished
/// set is handed to WatchModel, which asks the user to confirm.
final class MotionPipeline {
    struct WindowPrediction { let end: Double; let probabilities: [String: Double] }
    struct SetCapture {
        let start: Double
        let end: Double
        let samples: [MotionSample]
        let reps: Int
        let windows: [[String: Double]]
    }
    enum Event {
        case setStarted
        case live(reps: Int, guess: String?)
        case setEnded(SetCapture)
        case recordingLive(reps: Int)
    }

    var emit: ((Event) -> Void)?
    var autoDetect = false
    var allowed: Set<String>?

    private let classifier: MotionClassifier
    private var segmenter = SetSegmenter()
    private var recent: [MotionSample] = []          // ~3 s pre-roll
    private var current: [MotionSample]?             // auto-detected set in progress
    private var windows: [WindowPrediction] = []
    private var classified = 0
    private var manual: [MotionSample]?              // Collect Data / Calibrate recording
    private var lastLive = -1.0

    init(classifier: MotionClassifier) { self.classifier = classifier }

    func push(_ s: MotionSample) {
        recent.append(s)
        if recent.count > 150 { recent.removeFirst(recent.count - 150) }

        if manual != nil {
            manual?.append(s)
            if let m = manual, s.t - lastLive >= 0.5 {
                lastLive = s.t
                emit?(.recordingLive(reps: RepCounter.count(m).reps))
            }
            return // segmentation is suspended while a labeled recording runs
        }
        guard autoDetect else { return }

        current?.append(s)
        switch segmenter.push(s) {
        case let .started(at)?:
            current = recent.filter { $0.t >= at - 0.5 }
            windows = []
            classified = 0
            lastLive = -1
            emit?(.setStarted)
        case let .ended(start, end)?:
            finish(start: start, end: end)
        case nil:
            break
        }

        guard let set = current else { return }
        classifyNewWindows(set)
        if s.t - lastLive >= 0.5 {
            lastLive = s.t
            let guess = PredictionMath.combine(windows.map { $0.probabilities }, allowed: allowed).first?.label
            emit?(.live(reps: RepCounter.count(set).reps, guess: guess))
        }
    }

    /// Sliding 2.5 s windows with 50% overlap, classified as soon as each one fills.
    private func classifyNewWindows(_ set: [MotionSample]) {
        guard classifier.isAvailable else { return }
        while classified + ClassifierInput.windowSize <= set.count {
            let slice = set[classified..<(classified + ClassifierInput.windowSize)]
            if let p = classifier.predict(ClassifierInput.window(slice)), let last = slice.last {
                windows.append(WindowPrediction(end: last.t, probabilities: p))
            }
            classified += ClassifierInput.hop
        }
    }

    private func finish(start: Double, end: Double) {
        let samples = (current ?? []).filter { $0.t >= start - 0.5 && $0.t <= end + 0.5 }
        current = nil
        // Windows that ran into the trailing stillness would dilute the average with Other/Rest.
        let inSet = windows.filter { $0.end <= end + 0.25 }.map { $0.probabilities }
        emit?(.setEnded(SetCapture(start: start, end: end, samples: samples, reps: RepCounter.count(samples).reps, windows: inSet)))
    }

    /// User tapped End Set before the 3 s of stillness.
    func endSetNow() {
        guard let t = current?.last?.t, case let .ended(start, end)? = segmenter.forceEnd(at: t) else { return }
        finish(start: start, end: end)
    }

    func beginRecording() {
        manual = recent // keep the ~3 s of pre-roll so offline replay can see the stillness before the set
        current = nil
        lastLive = -1
    }

    func endRecording() -> [MotionSample] {
        let samples = manual ?? []
        manual = nil
        segmenter.reset()
        return samples
    }

    func reset() {
        segmenter.reset()
        current = nil
        manual = nil
        windows = []
    }
}
