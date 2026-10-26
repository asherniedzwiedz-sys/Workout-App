import Foundation

public struct RepCounterConfig: Sendable {
    public var sampleRate = motionSampleRate
    /// Centered moving-average low-pass (s): removes tremor/noise.
    public var lowpass = 0.3
    /// Centered moving-average trend removed (s): must be longer than the slowest rep or it eats the signal.
    public var highpass = 6.0
    public var minPeriod = 0.8
    public var maxPeriod = 8.0
    public var defaultPeriod = 2.5
    public var minAutocorrelation = 0.3
    /// Lobe threshold as a fraction of the 90th-percentile amplitude.
    public var peakFraction = 0.35
    /// g. Below this the "set" is noise: 0 reps.
    public var minAmplitude = 0.025
    /// First/last lobe dropped when its amplitude is outside [low, high] × the median rep (getting into position).
    public var edgeHighRatio = 1.6
    public var edgeLowRatio = 0.45
    public init() {}
}

public struct RepCount: Equatable, Sendable {
    public var reps: Int
    public var peakTimes: [Double]
    public var period: Double
}

/// Rule-based rep counter (Phase 9B, no ML). Band-pass total acceleration, project onto the dominant
/// axis (PCA), estimate tempo by autocorrelation, then count full cycles: a lobe only counts when an
/// opposite lobe flanks it on both sides (eccentric + concentric), with a tempo-based minimum spacing.
public enum RepCounter {
    public static func count(_ samples: [MotionSample], config c: RepCounterConfig = .init()) -> RepCount {
        let n = samples.count
        let hz = c.sampleRate
        guard Double(n) >= hz else { return RepCount(reps: 0, peakTimes: [], period: c.defaultPeriod) }

        // 1. Band-pass gravity + userAcceleration per axis (curls show up in gravity, presses in userAcceleration).
        let axes = [samples.map { $0.ax + $0.gx }, samples.map { $0.ay + $0.gy }, samples.map { $0.az + $0.gz }]
        let bp = axes.map { x -> [Double] in
            let trend = movingAverage(x, window: Int(c.highpass * hz))
            return movingAverage(zip(x, trend).map { $0 - $1 }, window: Int(c.lowpass * hz))
        }

        // 2. Dominant axis via power iteration on the 3×3 covariance.
        var cov = [[Double]](repeating: [0, 0, 0], count: 3)
        for i in 0..<3 {
            for j in 0..<3 {
                var sum = 0.0
                for k in 0..<n { sum += bp[i][k] * bp[j][k] }
                cov[i][j] = sum / Double(n)
            }
        }
        var v = [1.0, 1.0, 1.0]
        for _ in 0..<30 {
            let w = (0..<3).map { i in cov[i][0] * v[0] + cov[i][1] * v[1] + cov[i][2] * v[2] }
            let norm = (w[0] * w[0] + w[1] * w[1] + w[2] * w[2]).squareRoot() + 1e-12
            v = w.map { $0 / norm }
        }
        let s = (0..<n).map { k in bp[0][k] * v[0] + bp[1][k] * v[1] + bp[2][k] * v[2] }

        // 3. Tempo → minimum spacing between reps.
        let period = estimatePeriod(s, c)
        let amplitude = percentile(s.map(abs), 90)
        guard amplitude >= c.minAmplitude else { return RepCount(reps: 0, peakTimes: [], period: period) }
        let h = max(c.peakFraction * amplitude, 0.5 * c.minAmplitude)
        let minDistance = 0.5 * period * hz

        // 4. Full cycles in either polarity (PCA sign is arbitrary); the larger count wins.
        let negated = s.map { -$0 }
        let up = trimEdges(s, lobes(s, h, minDistance), c)
        let down = trimEdges(negated, lobes(negated, h, minDistance), c)
        let peaks = up.count >= down.count ? up : down
        return RepCount(reps: peaks.count, peakTimes: peaks.map { samples[$0].t }, period: period)
    }

    /// First local maximum of the normalized autocorrelation above the threshold = fundamental period.
    static func estimatePeriod(_ s: [Double], _ c: RepCounterConfig) -> Double {
        let n = s.count
        let lo = Int(c.minPeriod * c.sampleRate)
        let hi = min(Int(c.maxPeriod * c.sampleRate), n / 2)
        guard hi - lo >= 2 else { return c.defaultPeriod }
        var r = [Double](repeating: 0, count: hi + 1)
        for lag in lo...hi {
            var ab = 0.0, aa = 0.0, bb = 0.0
            for i in 0..<(n - lag) {
                let x = s[i], y = s[i + lag]
                ab += x * y
                aa += x * x
                bb += y * y
            }
            r[lag] = ab / ((aa * bb).squareRoot() + 1e-12)
        }
        for lag in (lo + 1)..<hi where r[lag] > c.minAutocorrelation && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1] {
            return Double(lag) / c.sampleRate
        }
        return c.defaultPeriod
    }

    /// Peaks above +h with a trough below −h on both sides. Edge half-lobes (start/stop at rest) never count.
    static func lobes(_ x: [Double], _ h: Double, _ minDistance: Double) -> [Int] {
        guard x.count >= 3 else { return [] }
        var peaks: [(i: Int, left: Bool, right: Bool)] = []
        var trough = false
        for i in 1..<(x.count - 1) {
            if x[i] < -h {
                trough = true
                if !peaks.isEmpty { peaks[peaks.count - 1].right = true }
            }
            guard x[i] > h, x[i] >= x[i - 1], x[i] > x[i + 1] else { continue }
            if let last = peaks.last, Double(i - last.i) < minDistance || !trough {
                if x[i] > x[last.i] { peaks[peaks.count - 1].i = i }
            } else {
                peaks.append((i, trough, false))
                trough = false
            }
        }
        return peaks.filter { $0.left && $0.right }.map { $0.i }
    }

    static func trimEdges(_ x: [Double], _ peaks: [Int], _ c: RepCounterConfig) -> [Int] {
        guard peaks.count >= 4 else { return peaks }
        let median = percentile(peaks[1..<(peaks.count - 1)].map { x[$0] }, 50)
        func outlier(_ i: Int) -> Bool { x[i] > c.edgeHighRatio * median || x[i] < c.edgeLowRatio * median }
        let lo = outlier(peaks[0]) ? 1 : 0
        let hi = outlier(peaks[peaks.count - 1]) ? peaks.count - 1 : peaks.count
        return Array(peaks[lo..<hi])
    }

    /// Centered moving average with shrinking windows at the edges (prefix sums, O(n)).
    static func movingAverage(_ x: [Double], window: Int) -> [Double] {
        let n = x.count
        let half = window / 2
        var prefix = [Double](repeating: 0, count: n + 1)
        for i in 0..<n { prefix[i + 1] = prefix[i] + x[i] }
        return (0..<n).map { i in
            let lo = max(0, i - half), hi = min(n, i + half + 1)
            return (prefix[hi] - prefix[lo]) / Double(hi - lo)
        }
    }

    /// Linear-interpolated percentile (same as numpy's default).
    static func percentile(_ x: [Double], _ p: Double) -> Double {
        guard !x.isEmpty else { return 0 }
        let sorted = x.sorted()
        let rank = p / 100 * Double(sorted.count - 1)
        let lo = Int(rank.rounded(.down))
        let hi = min(lo + 1, sorted.count - 1)
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - Double(lo))
    }
}
