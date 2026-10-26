import Foundation

/// Sample rate of CMMotionManager.deviceMotion used everywhere (recording, tests, training script).
public let motionSampleRate = 50.0

/// One CMDeviceMotion reading. Accelerations in g, rotation in rad/s, attitude in rad, `t` in seconds.
public struct MotionSample: Equatable, Sendable {
    public var t: Double
    public var ax: Double, ay: Double, az: Double // userAcceleration (gravity removed)
    public var rx: Double, ry: Double, rz: Double // rotationRate
    public var gx: Double, gy: Double, gz: Double // gravity
    public var roll: Double, pitch: Double, yaw: Double // attitude

    public init(t: Double, ax: Double, ay: Double, az: Double, rx: Double = 0, ry: Double = 0, rz: Double = 0,
                gx: Double, gy: Double, gz: Double, roll: Double = 0, pitch: Double = 0, yaw: Double = 0) {
        self.t = t
        self.ax = ax; self.ay = ay; self.az = az
        self.rx = rx; self.ry = ry; self.rz = rz
        self.gx = gx; self.gy = gy; self.gz = gz
        self.roll = roll; self.pitch = pitch; self.yaw = yaw
    }

    public var userAccelerationMagnitude: Double { (ax * ax + ay * ay + az * az).squareRoot() }

    /// Classifier channel order; must match CHANNELS in ml/motion_data.py.
    public var channels: [Double] { [ax, ay, az, rx, ry, rz, gx, gy, gz, roll, pitch, yaw] }
}

/// Trailing-window mean/std in O(1) per sample.
struct RollingStats: Sendable {
    private var buffer: [Double]
    private var index = 0
    private var count = 0
    private var sum = 0.0
    private var sumSquares = 0.0

    init(capacity: Int) { buffer = Array(repeating: 0, count: max(1, capacity)) }

    mutating func push(_ x: Double) {
        if count == buffer.count {
            let old = buffer[index]
            sum -= old
            sumSquares -= old * old
        } else {
            count += 1
        }
        buffer[index] = x
        sum += x
        sumSquares += x * x
        index = (index + 1) % buffer.count
    }

    var mean: Double { count == 0 ? 0 : sum / Double(count) }
    var std: Double { count == 0 ? 0 : max(0, sumSquares / Double(count) - mean * mean).squareRoot() }
}
