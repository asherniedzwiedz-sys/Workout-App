import Foundation

public struct SegmenterConfig: Sendable {
    public var sampleRate = motionSampleRate
    /// Trailing moving average of |userAcceleration| (seconds).
    public var smoothing = 0.5
    /// g. A slow 2 s press peaks around 0.065 g, so this must stay well below that.
    public var moveThreshold = 0.04
    public var stillThreshold = 0.02
    /// g, std of |userAcceleration| over the last second ("low variance").
    public var stillStdThreshold = 0.016
    public var startSustain = 0.8
    /// Dips shorter than this (turnarounds, lockout pauses) don't break "sustained" movement.
    public var startGapTolerance = 0.4
    public var stillBeforeStart = 3.0
    public var stillToEnd = 3.0
    public var maxSetDuration = 150.0
    public init() {}
}

public enum SegmentEvent: Equatable, Sendable {
    case started(at: Double)
    case ended(start: Double, end: Double)
}

/// Streaming set detector (Phase 9B, rule-based). A set starts when |userAcceleration| stays above
/// threshold for >0.8 s after ≥3 s of stillness, and ends after >3 s of stillness / low variance.
public struct SetSegmenter: Sendable {
    public let config: SegmenterConfig
    private enum State: Sendable { case settling, armed, candidate(since: Double, lastMove: Double), inSet(start: Double) }
    private var state: State = .settling
    private var stillSince: Double?
    private var smooth: RollingStats
    private var spread: RollingStats

    public init(config: SegmenterConfig = .init()) {
        self.config = config
        smooth = RollingStats(capacity: Int(config.smoothing * config.sampleRate))
        spread = RollingStats(capacity: Int(config.sampleRate))
    }

    public var isInSet: Bool {
        if case .inSet = state { return true }
        return false
    }

    public mutating func push(_ s: MotionSample) -> SegmentEvent? {
        let m = s.userAccelerationMagnitude
        smooth.push(m)
        spread.push(m)
        let still = smooth.mean < config.stillThreshold && spread.std < config.stillStdThreshold
        let moving = smooth.mean > config.moveThreshold
        stillSince = still ? (stillSince ?? s.t) : nil
        let stillFor = stillSince.map { s.t - $0 } ?? 0

        switch state {
        case .settling:
            if stillFor >= config.stillBeforeStart { state = .armed }
        case .armed:
            if moving { state = .candidate(since: s.t, lastMove: s.t) }
        case let .candidate(since, lastMove):
            let last = moving ? s.t : lastMove
            if s.t - last > config.startGapTolerance {
                state = .armed
            } else if s.t - since >= config.startSustain {
                let start = max(0, since - config.smoothing / 2) // undo the moving-average lag
                state = .inSet(start: start)
                return .started(at: start)
            } else {
                state = .candidate(since: since, lastMove: last)
            }
        case let .inSet(start):
            if stillFor >= config.stillToEnd, let stillStart = stillSince {
                state = .armed
                // The 1 s variance window lags the real stop by about half its length.
                return .ended(start: start, end: max(start, stillStart - 0.5))
            }
            if s.t - start >= config.maxSetDuration {
                state = .settling
                return .ended(start: start, end: s.t)
            }
        }
        return nil
    }

    /// Ends an in-progress set now (user tapped End Set).
    public mutating func forceEnd(at t: Double) -> SegmentEvent? {
        guard case let .inSet(start) = state else { return nil }
        state = .settling
        return .ended(start: start, end: t)
    }

    public mutating func reset() {
        state = .settling
        stillSince = nil
    }
}
