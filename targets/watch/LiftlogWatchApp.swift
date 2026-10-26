import SwiftUI

@main
struct LiftlogWatchApp: App {
    @StateObject private var model = WatchModel()

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(model)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        ZStack {
            NavigationStack {
                HomeView()
                    .navigationDestination(isPresented: $model.showWorkout) { WorkoutView() }
            }
            .fullScreenCover(isPresented: .constant(!model.pending.isEmpty)) {
                if let first = model.pending.first { ConfirmView(pending: first).environmentObject(model) }
            }
        }
        .fullScreenCover(isPresented: .constant(model.recording != nil)) { RecordingView().environmentObject(model) }
        .alert(model.errorMessage ?? "", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        }
    }
}

struct HomeView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        List {
            if let workout = model.workout {
                Button { model.showWorkout = true } label: {
                    VStack(alignment: .leading) {
                        Text(workout.name).font(.headline)
                        Text(model.tracking ? "Tracking on Watch" : "Tap to open").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .listItemTint(.green)
            } else {
                Section("Start workout") {
                    ForEach(model.context.routines ?? []) { routine in
                        Button { Task { await model.start(routine: routine) } } label: {
                            VStack(alignment: .leading) {
                                Text(routine.name)
                                Text("\(routine.exercises.count) exercises").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Button { Task { await model.start(routine: nil) } } label: { Label("Freestyle", systemImage: "figure.strengthtraining.traditional") }
                }
            }
            if model.devMode {
                NavigationLink { CollectView() } label: { Label("Collect Data", systemImage: "waveform") }
            }
            Section {
                Text(statusLine).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Liftlog")
    }

    private var statusLine: String {
        var parts = [model.phoneReachable ? "iPhone connected" : "iPhone not reachable"]
        if model.queuedForPhone > 0 { parts.append("\(model.queuedForPhone) waiting to sync") }
        parts.append("\(model.wrist) wrist")
        parts.append(model.autoDetect ? "auto-detect on" : "manual logging")
        if !model.classifier.isAvailable { parts.append("no exercise model yet") }
        return parts.joined(separator: " · ")
    }
}
