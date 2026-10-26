import SwiftUI

struct WorkoutView: View {
    @EnvironmentObject var model: WatchModel
    @State private var confirmEnd = false
    @State private var pickingOther = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let end = model.restEndsAt { RestCard(endsAt: end) }

                if !model.tracking {
                    Button { Task { await model.startTracking() } } label: {
                        Label("Track on Watch", systemImage: "waveform.path.ecg")
                    }
                    .tint(.green)
                } else if let reps = model.liveReps {
                    LiveSetCard(reps: reps, guess: model.liveGuess.map(model.name))
                } else if model.listening {
                    Label("Listening — start your set", systemImage: "ear").font(.footnote).foregroundStyle(.secondary)
                } else if model.autoDetect && !model.detectable {
                    Text("No Watch-detectable lifts in this routine — tap an exercise to log it.").font(.footnote).foregroundStyle(.secondary)
                }

                ForEach(model.workout?.exercises ?? []) { exercise in
                    Button { model.logManually(exercise.id) } label: { ExerciseRow(exercise: exercise) }
                }
                Button { pickingOther = true } label: { Label("Log other exercise", systemImage: "plus") }
                Button(role: .destructive) { confirmEnd = true } label: { Text("End Workout") }
            }
        }
        .navigationTitle(model.workout?.name ?? "Workout")
        .confirmationDialog("End workout?", isPresented: $confirmEnd) {
            Button("End & save on iPhone", role: .destructive) { model.finishWorkout() }
            Button("Keep going", role: .cancel) {}
        }
        .sheet(isPresented: $pickingOther) {
            ExercisePickList(title: "Log exercise", guesses: []) { id in
                pickingOther = false
                if let id { model.logManually(id) }
            }
            .environmentObject(model)
        }
    }
}

struct ExerciseRow: View {
    let exercise: PlanExercise

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name).font(.footnote.bold()).lineLimit(2)
                Text("\(exercise.done ?? 0)/\(exercise.sets) sets · \(formatWeight(exercise.weight)) lb").font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: exercise.motion == "wrist" ? "applewatch.radiowaves.left.and.right" : "hand.tap")
                .foregroundStyle(exercise.motion == "wrist" ? .green : .orange)
                .accessibilityLabel(exercise.motion == "wrist" ? "Watch can detect" : "Manual only")
        }
    }
}

struct LiveSetCard: View {
    @EnvironmentObject var model: WatchModel
    let reps: Int
    let guess: String?

    var body: some View {
        VStack(spacing: 2) {
            Text("SET IN PROGRESS").font(.caption2.bold()).foregroundStyle(.green)
            Text("\(reps)").font(.system(size: 56, weight: .heavy, design: .rounded)).monospacedDigit()
            if let guess { Text(guess).font(.caption).foregroundStyle(.secondary) }
            Button("End Set") { model.endSetNow() }.tint(.red)
        }
    }
}

struct RestCard: View {
    @EnvironmentObject var model: WatchModel
    let endsAt: Date

    var body: some View {
        VStack(spacing: 4) {
            Text("REST").font(.caption2.bold()).foregroundStyle(.blue)
            Text(timerInterval: Date.now...max(endsAt, Date.now), countsDown: true)
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .monospacedDigit()
            HStack {
                Button("+15") { model.extendRest(by: 15) }
                Button("Skip") { model.restEndsAt = nil }
            }
        }
    }
}

func formatWeight(_ lbs: Double) -> String {
    lbs.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(lbs)) : String(format: "%.1f", lbs)
}
