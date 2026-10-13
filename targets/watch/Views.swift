import SwiftUI
import WatchKit

// MARK: - No active workout

struct StartView: View {
  @EnvironmentObject private var phone: PhoneSession
  let routines: [WatchRoutine]
  let reachable: Bool

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Image(systemName: "dumbbell.fill")
            .foregroundStyle(.tint)
          Text("No workout in progress")
            .font(.headline)
          Text(reachable ? "Start a routine here or on your iPhone." : "Open IronLog on your iPhone to connect.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
      }
      if !routines.isEmpty {
        Section("Routines") {
          ForEach(routines) { routine in
            Button {
              phone.startRoutine(id: routine.id)
            } label: {
              VStack(alignment: .leading, spacing: 2) {
                Text(routine.name).font(.headline)
                Text("\(routine.exerciseCount) exercises")
                  .font(.footnote)
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
      }
    }
    .navigationTitle("IronLog")
  }
}

// MARK: - Active workout

struct WorkoutView: View {
  @EnvironmentObject private var phone: PhoneSession
  let state: WatchState

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let restEnd = state.restEndDate
      let resting = restEnd.map { $0 > context.date } ?? false
      Group {
        if resting, let restEnd {
          RestView(end: restEnd, duration: state.restDuration, nextUp: nextUpText)
        } else if let cursor = state.current,
                  let exercise = state.exercise(cursor.exerciseKey),
                  let set = exercise.sets.first(where: { $0.id == cursor.setId }) {
          SetView(exercise: exercise, set: set, startDate: state.startDate, canFinish: state.completedSets > 0)
        } else {
          AllDoneView(startDate: state.startDate, canFinish: state.completedSets > 0)
        }
      }
      .modifier(RestEndHaptic(resting: resting, restEnd: restEnd, now: context.date))
    }
    .navigationTitle(state.workoutName)
  }

  private var nextUpText: String? {
    guard let cursor = state.current,
          let exercise = state.exercise(cursor.exerciseKey),
          let set = exercise.sets.first(where: { $0.id == cursor.setId })
    else { return nil }
    let reps = set.reps.map { " × \($0)" } ?? ""
    return "Next: \(exercise.name) · \(Format.weight(set.weight))\(reps)"
  }
}

/// Taps the wrist once when a rest runs out (not when it's skipped).
private struct RestEndHaptic: ViewModifier {
  let resting: Bool
  let restEnd: Date?
  let now: Date

  func body(content: Content) -> some View {
    content.onChange(of: resting) { wasResting, isResting in
      if wasResting, !isResting, let restEnd, now >= restEnd.addingTimeInterval(-1) {
        WKInterfaceDevice.current().play(.notification)
      }
    }
  }
}

struct SetView: View {
  @EnvironmentObject private var phone: PhoneSession
  let exercise: WatchExercise
  let set: WatchSet
  let startDate: Date
  let canFinish: Bool

  @State private var weight: Double = 0
  @State private var reps: Int = 0
  @State private var confirmFinish = false

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Text(startDate, style: .timer)
          .font(.footnote.monospacedDigit())
          .foregroundStyle(.secondary)
        Text(exercise.name)
          .font(.headline)
          .multilineTextAlignment(.center)
          .lineLimit(3)
        Text(setTitle)
          .font(.footnote)
          .foregroundStyle(.secondary)

        AdjustRow(
          value: Format.weight(weight),
          decrement: { weight = max(0, weight - 5) },
          increment: { weight += 5 }
        )
        AdjustRow(
          value: "\(reps) reps",
          decrement: { reps = max(1, reps - 1) },
          increment: { reps += 1 }
        )

        Button {
          phone.completeSet(exerciseKey: exercise.key, setId: set.id, weight: weight, reps: reps)
          WKInterfaceDevice.current().play(.success)
        } label: {
          Label("Done", systemImage: "checkmark")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(.green)
        .disabled(reps < 1)

        NavigationLink {
          ExerciseListView()
        } label: {
          Label("All exercises", systemImage: "list.bullet")
        }

        if canFinish {
          Button("Finish workout", role: .destructive) { confirmFinish = true }
        }
      }
    }
    .onAppear(perform: loadValues)
    .onChange(of: set.id) { _, _ in loadValues() }
    .confirmationDialog("Finish and save this workout?", isPresented: $confirmFinish, titleVisibility: .visible) {
      Button("Finish") { phone.finishWorkout() }
      Button("Cancel", role: .cancel) {}
    }
  }

  private var setTitle: String {
    let index = (exercise.sets.firstIndex(where: { $0.id == set.id }) ?? 0) + 1
    let kind = set.type == "warmup" ? "Warm-up" : set.type == "drop" ? "Drop set" : "Set"
    return "\(kind) \(index) of \(exercise.sets.count)"
  }

  private func loadValues() {
    weight = set.weight ?? 0
    reps = set.reps ?? 0
  }
}

private struct AdjustRow: View {
  let value: String
  let decrement: () -> Void
  let increment: () -> Void

  var body: some View {
    HStack(spacing: 6) {
      Button(action: decrement) {
        Image(systemName: "minus")
      }
      .frame(width: 44)
      Text(value)
        .font(.title3.monospacedDigit().bold())
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .frame(maxWidth: .infinity)
      Button(action: increment) {
        Image(systemName: "plus")
      }
      .frame(width: 44)
    }
  }
}

struct RestView: View {
  @EnvironmentObject private var phone: PhoneSession
  let end: Date
  let duration: Int
  let nextUp: String?

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Text("Rest")
          .font(.footnote)
          .foregroundStyle(.secondary)
        // Ranges must never be inverted, even on the last frame before the view goes away.
        Text(timerInterval: min(Date.now, end)...end, countsDown: true)
          .font(.system(size: 40, weight: .bold, design: .rounded))
          .monospacedDigit()
        ProgressView(timerInterval: end.addingTimeInterval(-Double(max(duration, 1)))...end, countsDown: true) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
        .tint(.blue)
        HStack {
          Button("−15") { phone.adjustRest(by: -15) }
          Button("+15") { phone.adjustRest(by: 15) }
        }
        Button {
          phone.skipRest()
        } label: {
          Label("Skip rest", systemImage: "forward.end.fill")
        }
        if let nextUp {
          Text(nextUp)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }
      }
    }
  }
}

struct AllDoneView: View {
  @EnvironmentObject private var phone: PhoneSession
  let startDate: Date
  let canFinish: Bool
  @State private var confirmFinish = false

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Image(systemName: "checkmark.seal.fill")
          .font(.largeTitle)
          .foregroundStyle(.green)
        Text("All sets done")
          .font(.headline)
        Text(startDate, style: .timer)
          .font(.footnote.monospacedDigit())
          .foregroundStyle(.secondary)
        if canFinish {
          Button("Finish workout") { confirmFinish = true }
            .buttonStyle(.borderedProminent)
        }
        NavigationLink {
          ExerciseListView()
        } label: {
          Label("All exercises", systemImage: "list.bullet")
        }
      }
    }
    .confirmationDialog("Finish and save this workout?", isPresented: $confirmFinish, titleVisibility: .visible) {
      Button("Finish") { phone.finishWorkout() }
      Button("Cancel", role: .cancel) {}
    }
  }
}

/// Every exercise and set; tap an open set to log it with its current values.
struct ExerciseListView: View {
  @EnvironmentObject private var phone: PhoneSession

  var body: some View {
    List {
      ForEach(phone.state?.exercises ?? []) { exercise in
        Section(exercise.skipped ? "\(exercise.name) (skipped)" : exercise.name) {
          ForEach(exercise.sets) { set in
            Button {
              guard !set.done else { return }
              phone.completeSet(exerciseKey: exercise.key, setId: set.id, weight: set.weight, reps: set.reps)
              WKInterfaceDevice.current().play(.success)
            } label: {
              HStack {
                Text(set.label)
                  .font(.footnote.bold())
                  .frame(width: 22, alignment: .leading)
                Text("\(Format.weight(set.weight)) × \(set.reps.map(String.init) ?? "–")")
                Spacer()
                Image(systemName: set.done ? "checkmark.circle.fill" : "circle")
                  .foregroundStyle(set.done ? .green : .secondary)
              }
            }
            .disabled(set.done || set.reps == nil)
          }
        }
      }
    }
    .navigationTitle("Exercises")
  }
}
