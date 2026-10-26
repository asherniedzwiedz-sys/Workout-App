import XCTest
@testable import MotionCore

/// Deterministic synthetic sessions: minimum-jerk strokes with lockout pauses and sensor noise — the same
/// model the default thresholds were tuned on. Synthetic data only proves the logic; real accuracy comes
/// from replaying your own exported CSVs with `swift run motion-replay`.
struct Synth {
    enum Kind { case curl, press }
    private var state: UInt64
    private(set) var samples: [MotionSample] = []
    private var t = 0.0
    let hz = motionSampleRate

    init(seed: UInt64) { state = seed }

    mutating func uniform() -> Double {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return Double((z ^ (z >> 31)) >> 11) / Double(UInt64(1) << 53)
    }

    mutating func normal(_ sd: Double) -> Double {
        let u1 = max(uniform(), 1e-12), u2 = uniform()
        return sd * (-2 * log(u1)).squareRoot() * cos(2 * .pi * u2)
    }

    private mutating func append(ua: (Double, Double, Double), g: (Double, Double, Double), uaNoise: Double, gNoise: Double) {
        samples.append(MotionSample(t: t, ax: ua.0 + normal(uaNoise), ay: ua.1 + normal(uaNoise), az: ua.2 + normal(uaNoise),
                                    gx: g.0 + normal(gNoise), gy: g.1 + normal(gNoise), gz: g.2 + normal(gNoise)))
        t += 1 / hz
    }

    mutating func still(_ seconds: Double, g: (Double, Double, Double) = (0, 0, -1)) {
        for _ in 0..<Int(seconds * hz) { append(ua: (0, 0, 0), g: g, uaNoise: 0.006, gNoise: 0.002) }
    }

    /// Small hand movements while resting (0.03–0.06 g for 0.3–0.7 s every 1.5–4 s).
    mutating func fidgetyRest(_ seconds: Double) {
        let n = Int(seconds * hz)
        var bursts: [(Int, Int, Double)] = []
        var at = 0.0
        while true {
            at += 1.5 + 2.5 * uniform()
            if at >= seconds - 1 { break }
            bursts.append((Int(at * hz), Int((0.3 + 0.4 * uniform()) * hz), 0.03 + 0.03 * uniform()))
        }
        for i in 0..<n {
            let sd = bursts.first { i >= $0.0 && i < $0.0 + $0.1 }?.2 ?? 0.006
            append(ua: (0, 0, 0), g: (0, 0, -1), uaNoise: sd, gNoise: 0.002)
        }
    }

    static func minJerk(_ n: Int) -> [Double] {
        (0..<n).map { i in let x = Double(i) / Double(n); return 10 * pow(x, 3) - 15 * pow(x, 4) + 6 * pow(x, 5) }
    }

    /// numpy.gradient: central differences inside, one-sided at the ends.
    static func gradient(_ x: [Double]) -> [Double] {
        let n = x.count
        guard n > 1 else { return [0] }
        return (0..<n).map { i in i == 0 ? x[1] - x[0] : i == n - 1 ? x[n - 1] - x[n - 2] : (x[i + 1] - x[i - 1]) / 2 }
    }

    mutating func reps(_ kind: Kind, count: Int, period: Double) {
        for _ in 0..<count {
            let p = period * (1 + (uniform() * 0.3 - 0.15))
            let up = Synth.minJerk(Int(p * 0.4 * hz))
            let down = Synth.minJerk(Int(p * 0.6 * hz)).map { 1 - $0 }
            let pos = up + Array(repeating: 1, count: Int(0.25 * hz)) + down + Array(repeating: 0, count: Int(0.125 * hz))
            let acc = Synth.gradient(Synth.gradient(pos)).map { $0 * hz * hz }
            for (x, a) in zip(pos, acc) {
                switch kind {
                case .curl:
                    let theta = 125 * Double.pi / 180 * x
                    append(ua: (0.02 * a, 0.035 * a, 0.01 * a), g: (0, -sin(theta), -cos(theta)), uaNoise: 0.02, gNoise: 0.01)
                case .press:
                    append(ua: (0.006 * a, 0.004 * a, 0.045 * a), g: Synth.pressGravity, uaNoise: 0.02, gNoise: 0.01)
                }
            }
        }
    }

    /// Carrying the weights into / out of the start position (orientation change + some linear acceleration).
    mutating func transition(from g0: (Double, Double, Double), to g1: (Double, Double, Double), seconds: Double) {
        let w = Synth.minJerk(Int(seconds * hz))
        let acc = Synth.gradient(Synth.gradient(w)).map { $0 * hz * hz }
        for (k, a) in zip(w, acc) {
            var g = (g0.0 * (1 - k) + g1.0 * k, g0.1 * (1 - k) + g1.1 * k, g0.2 * (1 - k) + g1.2 * k)
            let norm = (g.0 * g.0 + g.1 * g.1 + g.2 * g.2).squareRoot()
            g = (g.0 / norm, g.1 / norm, g.2 / norm)
            append(ua: (0.01 * a, 0.03 * a, 0.05 * a), g: g, uaNoise: 0.02, gNoise: 0.01)
        }
    }

    static let pressGravity = (0.1, 0.2, -0.97)
}

/// Runs the streaming segmenter, then counts reps in each detected set (±0.5 s padding, as the watch does).
func detectSets(_ samples: [MotionSample]) -> [(start: Double, end: Double, reps: Int)] {
    var segmenter = SetSegmenter()
    var sets: [(Double, Double, Int)] = []
    for s in samples {
        if case let .ended(start, end)? = segmenter.push(s) {
            let window = samples.filter { $0.t >= start - 0.5 && $0.t <= end + 0.5 }
            sets.append((start, end, RepCounter.count(window).reps))
        }
    }
    return sets
}

final class MotionCoreTests: XCTestCase {
    func testCountsRealisticCurlsAndPressesExactly() {
        var seed: UInt64 = 1
        for kind in [Synth.Kind.curl, .press] {
            for reps in [3, 5, 8, 12] {
                for period in [1.5, 2.5, 4.0] {
                    var s = Synth(seed: seed)
                    seed += 1
                    let g = kind == .curl ? (0.0, 0.0, -1.0) : Synth.pressGravity
                    s.still(5, g: g)
                    s.reps(kind, count: reps, period: period)
                    let setEnd = s.samples.last!.t
                    s.still(5, g: g)
                    let sets = detectSets(s.samples)
                    XCTAssertEqual(sets.count, 1, "\(kind) \(reps)@\(period)s: expected one set")
                    guard let set = sets.first else { continue }
                    XCTAssertEqual(set.reps, reps, "\(kind) \(reps)@\(period)s")
                    XCTAssertEqual(set.start, 5, accuracy: 0.6, "start time")
                    XCTAssertEqual(set.end, setEnd, accuracy: 0.6, "end time")
                }
            }
        }
    }

    func testGettingIntoPositionCostsAtMostOneRep() {
        for (i, reps) in [5, 8, 10].enumerated() {
            var s = Synth(seed: 100 + UInt64(i))
            s.still(5)
            s.transition(from: (0, 0, -1), to: Synth.pressGravity, seconds: 1.5)
            s.reps(.press, count: reps, period: 2.5)
            s.transition(from: Synth.pressGravity, to: (0, 0, -1), seconds: 1.5)
            s.still(5)
            let sets = detectSets(s.samples)
            XCTAssertEqual(sets.count, 1)
            XCTAssertLessThanOrEqual(abs((sets.first?.reps ?? -9) - reps), 1)
        }
    }

    func testStillnessIsNeitherASetNorReps() {
        var s = Synth(seed: 7)
        s.still(30)
        XCTAssertTrue(detectSets(s.samples).isEmpty)
        XCTAssertEqual(RepCounter.count(s.samples).reps, 0)
    }

    func testFidgetingWhileRestingRarelyLooksLikeASet() {
        var falseSets = 0
        for i in 0..<10 {
            var s = Synth(seed: 500 + UInt64(i))
            s.fidgetyRest(90)
            falseSets += detectSets(s.samples).count
        }
        XCTAssertLessThanOrEqual(falseSets, 2, "15 min of fidgety rest") // predict-and-confirm still guards the rest
    }

    func testManualEndAndShortInput() {
        var seg = SetSegmenter()
        var s = Synth(seed: 9)
        s.still(4)
        s.reps(.curl, count: 3, period: 2)
        var started = false
        for x in s.samples { if case .started? = seg.push(x) { started = true } }
        XCTAssertTrue(started)
        XCTAssertNotNil(seg.forceEnd(at: s.samples.last!.t))
        XCTAssertNil(seg.forceEnd(at: 99))
        XCTAssertEqual(RepCounter.count(Array(s.samples.prefix(10))).reps, 0)
    }

    func testClassifierWindowsAndRelativeYaw() {
        let samples = (0..<300).map { i in
            MotionSample(t: Double(i) / 50, ax: Double(i), ay: 0, az: 0, gx: 0, gy: 0, gz: -1, yaw: i == 0 ? 3.1 : -3.1)
        }
        let windows = ClassifierInput.windows(samples)
        XCTAssertEqual(windows.count, 3) // (300 - 125) / 62 + 1
        XCTAssertEqual(windows[0].count, 12 * 125)
        XCTAssertEqual(windows[1][0], 62, "channel-major: ax of the 2nd window starts at sample 62")
        XCTAssertEqual(windows[0][11 * 125], 0, "yaw is relative to the window's first sample")
        XCTAssertEqual(Double(windows[0][11 * 125 + 1]), 2 * .pi - 6.2, accuracy: 1e-4, "wrapped across ±π")
    }

    func testRoutineConstraintAndConfidence() {
        let windows = [["dumbbell-curl": 0.5, "hammer-curl": 0.3, "other": 0.1, "dumbbell-row": 0.1]]
        let routine = PredictionMath.combine(windows, allowed: ["dumbbell-curl", "dumbbell-row"])
        XCTAssertEqual(routine.map(\.label), ["dumbbell-curl", "dumbbell-row", "other"])
        XCTAssertEqual(routine[0].p, 0.5 / 0.7, accuracy: 1e-9)
        XCTAssertFalse(PredictionMath.isNotSure(routine))
        let freestyle = PredictionMath.combine(windows + [["hammer-curl": 0.9, "dumbbell-curl": 0.1]], allowed: nil)
        XCTAssertEqual(freestyle.first?.label, "hammer-curl")
        XCTAssertTrue(PredictionMath.isNotSure(freestyle)) // 0.6 < 0.65
        XCTAssertTrue(PredictionMath.combine([], allowed: nil).isEmpty)
    }

    func testCSVRoundTripAndFileName() {
        var s = Synth(seed: 3)
        s.still(1)
        s.reps(.curl, count: 1, period: 2)
        let meta = RecordingMeta(kind: .calibration, exerciseId: "dumbbell-curl", wrist: "left", dominantHand: "right", actualReps: 9, countedReps: 8, startedAt: 1_761_170_000_000)
        XCTAssertEqual(meta.fileName, "calibration__dumbbell-curl__left-right__a9__c8__1761170000000.csv")
        let decoded = MotionCSV.decode(MotionCSV.encode(s.samples, meta: meta, sessionId: "abc"))
        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded[0].exerciseId, "dumbbell-curl")
        XCTAssertEqual(decoded[0].actualReps, 9)
        XCTAssertEqual(decoded[0].samples.count, s.samples.count)
        XCTAssertEqual(decoded[0].samples[10].gz, s.samples[10].gz, accuracy: 1e-5)
    }
}
