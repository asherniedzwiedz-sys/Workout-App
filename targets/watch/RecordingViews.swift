import SwiftUI

/// Hidden Collect Data screen (9A): pick a label, then Start/End a set. Unlocked from the phone.
struct CollectView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        List {
            Section("Pick label, then do one set") {
                ForEach(Seed.exercises + [Seed.other]) { e in
                    Button(e.name) { Task { _ = await model.beginRecording(e.id, kind: .collect) } }
                }
            }
        }
        .navigationTitle("Collect Data")
        .onAppear { model.collectScreenOpen = true }
        .onDisappear {
            model.collectScreenOpen = false
            model.scheduleIdleStop()
        }
    }
}

/// Shown for any labeled recording, whether started here or from the phone (Collect Data / Calibrate).
struct RecordingView: View {
    @EnvironmentObject var model: WatchModel
    @State private var actual = 0

    var body: some View {
        if let r = model.recording {
            VStack(spacing: 6) {
                Text(model.name(r.exerciseId)).font(.headline).lineLimit(2)
                Text(r.kind == .calibration ? "Calibration" : "Collect data").font(.caption2).foregroundStyle(.secondary)
                switch r.phase {
                case .recording:
                    Text("● REC").font(.caption.bold()).foregroundStyle(.red)
                    Text("\(r.liveReps)").font(.system(size: 50, weight: .heavy, design: .rounded)).monospacedDigit()
                    Button("End Set") { Task { _ = await model.stopRecording() } }.tint(.red)
                case let .review(counted):
                    Text("Counted \(counted). Actual reps?").font(.footnote)
                    Stepper(value: $actual, in: 0...100) { Text("\(actual)").font(.title2.bold()) }
                    Button("Save") { model.saveRecording(actualReps: actual) }.tint(.green)
                    Button("Discard", role: .destructive) { model.discardRecording() }
                }
            }
            .onAppear { syncActual(r.phase) }
            .onChange(of: r.phase) { syncActual(r.phase) }
        }
    }

    private func syncActual(_ phase: RecordingState.Phase) {
        if case let .review(counted) = phase { actual = counted }
    }
}
