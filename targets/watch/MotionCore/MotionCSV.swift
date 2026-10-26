import Foundation

/// A labeled recording. Metadata rides in the file name so the phone can list files without reading them.
/// Keep `fileName` in sync with recordingName() in src/logic/recording.ts.
public struct RecordingMeta: Equatable, Sendable {
    public enum Kind: String, Sendable { case collect, calibration, correction }
    public var kind: Kind
    public var exerciseId: String
    public var wrist: String
    public var dominantHand: String
    public var actualReps: Int
    public var countedReps: Int
    /// Unix ms.
    public var startedAt: Int64

    public init(kind: Kind, exerciseId: String, wrist: String, dominantHand: String, actualReps: Int, countedReps: Int, startedAt: Int64) {
        self.kind = kind; self.exerciseId = exerciseId; self.wrist = wrist; self.dominantHand = dominantHand
        self.actualReps = actualReps; self.countedReps = countedReps; self.startedAt = startedAt
    }

    public var fileName: String {
        "\(kind.rawValue)__\(exerciseId)__\(wrist)-\(dominantHand)__a\(actualReps)__c\(countedReps)__\(startedAt).csv"
    }
}

public enum MotionCSV {
    /// Same column order as CSV_HEADER in src/logic/recording.ts and ml/motion_data.py.
    public static let header = "session_id,exercise_id,kind,wrist,dominant_hand,actual_reps,counted_reps,t,ax,ay,az,rx,ry,rz,gx,gy,gz,roll,pitch,yaw"

    public static func encode(_ samples: [MotionSample], meta: RecordingMeta, sessionId: String) -> String {
        let t0 = samples.first?.t ?? 0
        let prefix = "\(sessionId),\(meta.exerciseId),\(meta.kind.rawValue),\(meta.wrist),\(meta.dominantHand),\(meta.actualReps),\(meta.countedReps),"
        var out = header + "\n"
        out.reserveCapacity(samples.count * 150)
        for s in samples {
            let values = [s.t - t0, s.ax, s.ay, s.az, s.rx, s.ry, s.rz, s.gx, s.gy, s.gz, s.roll, s.pitch, s.yaw]
            out += prefix + values.map { String(format: "%.5f", $0) }.joined(separator: ",") + "\n"
        }
        return out
    }

    public struct Session: Sendable {
        public var id: String
        public var exerciseId: String
        public var kind: String
        public var wrist: String
        public var actualReps: Int
        public var countedReps: Int
        public var samples: [MotionSample]
    }

    /// Parses a phone export (many sessions) or a single watch file. Malformed rows are skipped.
    public static func decode(_ text: String) -> [Session] {
        var sessions: [Session] = []
        var index: [String: Int] = [:]
        for line in text.split(whereSeparator: \.isNewline) {
            let f = line.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
            guard f.count == 20, f[0] != "session_id" else { continue }
            let v = f[7...].compactMap { Double($0) }
            guard v.count == 13 else { continue }
            let sample = MotionSample(t: v[0], ax: v[1], ay: v[2], az: v[3], rx: v[4], ry: v[5], rz: v[6],
                                      gx: v[7], gy: v[8], gz: v[9], roll: v[10], pitch: v[11], yaw: v[12])
            if let i = index[f[0]] {
                sessions[i].samples.append(sample)
            } else {
                index[f[0]] = sessions.count
                sessions.append(Session(id: f[0], exerciseId: f[1], kind: f[2], wrist: f[3],
                                        actualReps: Int(f[5]) ?? 0, countedReps: Int(f[6]) ?? 0, samples: [sample]))
            }
        }
        return sessions
    }
}
