import CoreMotion
import Foundation
import HealthKit

/// Phase 9A motion pipeline input. An HKWorkoutSession (.traditionalStrengthTraining) keeps the app — and
/// Core Motion — running with the screen off; CMMotionManager streams deviceMotion at 50 Hz on `queue`.
/// No HKLiveWorkoutBuilder: the phone writes the finished workout to Apple Health, so nothing is duplicated.
final class MotionRecorder: NSObject {
    /// Every sample is delivered on this serial queue; MotionPipeline lives on it.
    let queue = DispatchQueue(label: "liftlog.motion", qos: .userInitiated)
    var onSample: ((MotionSample) -> Void)?

    private let healthStore = HKHealthStore()
    private let motion = CMMotionManager()
    private let operations = OperationQueue()
    private var session: HKWorkoutSession?
    private var bootReference: TimeInterval?
    private var wallStart = Date()

    var isRunning: Bool { session != nil }

    @MainActor
    func start() async throws {
        guard session == nil else { return }
        guard HKHealthStore.isHealthDataAvailable(), motion.isDeviceMotionAvailable else { throw RecorderError.unavailable }
        try await healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        let workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
        workoutSession.delegate = self
        workoutSession.startActivity(with: Date())
        session = workoutSession
        startMotion()
    }

    private func startMotion() {
        guard !motion.isDeviceMotionActive else { return }
        operations.maxConcurrentOperationCount = 1
        operations.underlyingQueue = queue
        motion.deviceMotionUpdateInterval = 1 / motionSampleRate
        bootReference = nil
        motion.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: operations) { [weak self] dm, _ in
            guard let self, let dm else { return }
            if self.bootReference == nil {
                self.bootReference = dm.timestamp
                self.wallStart = Date()
            }
            let a = dm.userAcceleration, r = dm.rotationRate, g = dm.gravity, att = dm.attitude
            self.onSample?(MotionSample(t: dm.timestamp - (self.bootReference ?? dm.timestamp),
                                        ax: a.x, ay: a.y, az: a.z, rx: r.x, ry: r.y, rz: r.z,
                                        gx: g.x, gy: g.y, gz: g.z, roll: att.roll, pitch: att.pitch, yaw: att.yaw))
        }
    }

    func stop() {
        motion.stopDeviceMotionUpdates()
        session?.end()
        session = nil
    }

    /// Wall-clock time of a sample timestamp.
    func date(at t: Double) -> Date { wallStart.addingTimeInterval(t) }
}

enum RecorderError: LocalizedError {
    case unavailable
    var errorDescription: String? { "Motion or Health data isn't available on this Watch." }
}

extension MotionRecorder: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async { self.stop() }
    }
}
