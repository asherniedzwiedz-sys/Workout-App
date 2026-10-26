import SwiftUI

/// Phase 9D predict-and-confirm. The watch never logs on its own: Confirm is the one tap that logs the set.
struct ConfirmView: View {
    @EnvironmentObject var model: WatchModel
    let pending: PendingSet
    @State private var picking = false
    @State private var editingReps = false

    var body: some View {
        if pending.exerciseId == nil && !pending.looksLikeRest {
            ExercisePickList(title: "Not sure — pick exercise", guesses: pending.ranked) { id in
                if let id { model.correct(pending.id, to: id) } else { model.dismiss(pending.id) }
            }
        } else if pending.exerciseId == nil {
            VStack(spacing: 8) {
                Text("Looks like rest").font(.headline)
                Text("\(pending.repsCounted ?? 0) movements detected").font(.caption2).foregroundStyle(.secondary)
                Button("Pick exercise") { picking = true }
                Button("Not a set", role: .destructive) { model.dismiss(pending.id) }
            }
            .sheet(isPresented: $picking) { picker.environmentObject(model) }
        } else {
            confirmForm
        }
    }

    private var confirmForm: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text(model.name(pending.exerciseId ?? "")).font(.headline).multilineTextAlignment(.center)
                if !pending.corrected, pending.mode != "manual", let top = pending.ranked.first, top.p < PredictionMath.showConfidenceBelow {
                    Text("\(Int((top.p * 100).rounded()))% sure").font(.caption2).foregroundStyle(.orange)
                }
                HStack {
                    Button { model.update(pending.id) { $0.reps = max(0, $0.reps - 1) } } label: { Image(systemName: "minus") }
                        .accessibilityLabel("One less rep")
                    Text("\(pending.reps) reps").font(.title3.bold()).monospacedDigit().frame(minWidth: 70)
                    Button { model.update(pending.id) { $0.reps += 1 } } label: { Image(systemName: "plus") }
                        .accessibilityLabel("One more rep")
                }
                WeightField(weight: Binding(get: { pending.weight }, set: { v in model.update(pending.id) { $0.weight = v } }))
                Button { model.confirm(pending.id) } label: { Text("Confirm").font(.headline).frame(maxWidth: .infinity) }
                    .tint(.green)
                HStack {
                    Button("Wrong exercise") { picking = true }.font(.caption)
                    Button("Edit reps") { editingReps = true }.font(.caption)
                }
                Button("Not a set", role: .destructive) { model.dismiss(pending.id) }.font(.caption2)
            }
        }
        .sheet(isPresented: $picking) { picker.environmentObject(model) }
        .sheet(isPresented: $editingReps) {
            RepsEditor(reps: Binding(get: { pending.reps }, set: { v in model.update(pending.id) { $0.reps = v } }))
        }
    }

    private var picker: some View {
        ExercisePickList(title: "Which exercise?", guesses: pending.ranked) { id in
            picking = false
            if let id { model.correct(pending.id, to: id) } else { model.dismiss(pending.id) }
        }
    }
}

/// Weight is always user-confirmed: Digital Crown ±2.5 lb, ± buttons, or dictation.
struct WeightField: View {
    @Binding var weight: Double
    @State private var spoken = ""

    var body: some View {
        VStack(spacing: 4) {
            Text("\(formatWeight(weight)) lb")
                .font(.title3.bold())
                .monospacedDigit()
                .focusable(true)
                .digitalCrownRotation($weight, from: 0, through: 1500, by: 2.5, sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true)
                .accessibilityLabel("Weight \(formatWeight(weight)) pounds, turn the Digital Crown to change")
            HStack {
                Button { weight = max(0, weight - 2.5) } label: { Image(systemName: "minus") }.accessibilityLabel("2.5 pounds less")
                TextField("🎤", text: $spoken)
                    .onSubmit {
                        if let v = Double(spoken.filter { "0123456789.".contains($0) }), v >= 0, v < 2000 { weight = (v / 2.5).rounded() * 2.5 }
                        spoken = ""
                    }
                    .accessibilityLabel("Say or type the weight")
                Button { weight += 2.5 } label: { Image(systemName: "plus") }.accessibilityLabel("2.5 pounds more")
            }
        }
    }
}

struct RepsEditor: View {
    @Binding var reps: Int
    @Environment(\.dismiss) private var dismiss
    @State private var crown = 0.0

    var body: some View {
        VStack {
            Text("\(reps)")
                .font(.system(size: 60, weight: .heavy, design: .rounded))
                .focusable(true)
                .digitalCrownRotation($crown, from: 0, through: 100, by: 1, sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
                .onChange(of: crown) { reps = Int(crown) }
            Text("reps").foregroundStyle(.secondary)
            Button("Done") { dismiss() }.tint(.green)
        }
        .onAppear { crown = Double(reps) }
    }
}

/// Routine exercises first (constraint 3), then the rest of the seed list; freestyle shows the full list.
/// Calls back with nil for "Not a set".
struct ExercisePickList: View {
    @EnvironmentObject var model: WatchModel
    let title: String
    let guesses: [LabelProbability]
    let onPick: (String?) -> Void

    var body: some View {
        let routine = model.workout?.routineId != nil ? (model.workout?.exercises ?? []) : []
        let others = Seed.exercises.filter { seed in !routine.contains { $0.id == seed.id } }
        List {
            Section(title) {
                ForEach(guesses.filter { $0.label != PredictionMath.otherLabel }, id: \.label) { g in
                    Button { onPick(g.label) } label: {
                        HStack { Text(model.name(g.label)); Spacer(); Text("\(Int((g.p * 100).rounded()))%").foregroundStyle(.secondary) }
                    }
                }
            }
            if !routine.isEmpty {
                Section("This routine") {
                    ForEach(routine) { e in Button(e.name) { onPick(e.id) } }
                }
            }
            Section(routine.isEmpty ? "Exercises" : "All exercises") {
                ForEach(others) { e in Button(e.name) { onPick(e.id) } }
            }
            Section {
                Button("Not a set", role: .destructive) { onPick(nil) }
            }
        }
    }
}
