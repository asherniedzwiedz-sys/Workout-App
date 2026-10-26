import Foundation

/// Core ML input layout shared with ml/motion_data.py: 2.5 s windows (125 samples @ 50 Hz), 50% overlap,
/// 12 channels, channel-major [1, 12, 125] Float32. Yaw is relative to the window's first sample because
/// absolute yaw only reflects which way you happened to face when the session started.
public enum ClassifierInput {
    public static let windowSize = 125
    public static let hop = 62
    public static let channelCount = 12

    public static func windows(_ samples: [MotionSample]) -> [[Float]] {
        guard samples.count >= windowSize else { return [] }
        return stride(from: 0, through: samples.count - windowSize, by: hop).map { window(samples[$0..<($0 + windowSize)]) }
    }

    public static func window(_ w: ArraySlice<MotionSample>) -> [Float] {
        let yaw0 = w.first?.yaw ?? 0
        var out = [Float](repeating: 0, count: channelCount * windowSize)
        for (t, s) in w.enumerated() where t < windowSize {
            var ch = s.channels
            ch[11] = wrapAngle(s.yaw - yaw0)
            for c in 0..<channelCount { out[c * windowSize + t] = Float(ch[c]) }
        }
        return out
    }

    public static func wrapAngle(_ a: Double) -> Double { atan2(sin(a), cos(a)) }
}

public struct LabelProbability: Equatable, Sendable {
    public var label: String
    public var p: Double
    public init(label: String, p: Double) { self.label = label; self.p = p }
}

public enum PredictionMath {
    /// The classifier's "Other / Rest" class (walking, re-racking, adjusting the bench).
    public static let otherLabel = "other"
    /// Below this the watch shows "Not sure — pick exercise" instead of a guess.
    public static let notSureBelow = 0.65
    /// Confidence is shown on the confirm screen below this.
    public static let showConfidenceBelow = 0.90

    /// Averages per-window class probabilities across the set, keeps only `allowed` labels (+ Other/Rest),
    /// renormalizes, and returns best first. `allowed == nil` means freestyle (every label the model knows).
    public static func combine(_ windows: [[String: Double]], allowed: Set<String>?) -> [LabelProbability] {
        var sum: [String: Double] = [:]
        for w in windows { for (label, p) in w { sum[label, default: 0] += p } }
        let kept = sum.filter { allowed?.contains($0.key) ?? true || $0.key == otherLabel }
        let total = kept.values.reduce(0, +)
        guard total > 0 else { return [] }
        return kept
            .map { LabelProbability(label: $0.key, p: $0.value / total) }
            .sorted { $0.p != $1.p ? $0.p > $1.p : $0.label < $1.label }
    }

    public static func isNotSure(_ ranked: [LabelProbability]) -> Bool { (ranked.first?.p ?? 0) < notSureBelow }
}
