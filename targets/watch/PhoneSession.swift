import Foundation
import WatchConnectivity

/// Talks to the iPhone app over WatchConnectivity. The phone owns the workout; the
/// watch shows its latest snapshot and sends small action messages back.
final class PhoneSession: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = PhoneSession()

  @Published private(set) var state: WatchState?
  @Published private(set) var reachable = false

  private let decoder = JSONDecoder()

  private override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  // MARK: - Actions (call from the main thread)

  func completeSet(exerciseKey: String, setId: String, weight: Double?, reps: Int?) {
    var message: [String: Any] = ["action": "completeSet", "exerciseKey": exerciseKey, "setId": setId]
    if let weight { message["weight"] = weight }
    if let reps { message["reps"] = reps }
    send(message)
    // Show it as done right away; the phone's next snapshot confirms it.
    mutate { state in
      for e in state.exercises.indices {
        for s in state.exercises[e].sets.indices where state.exercises[e].sets[s].id == setId {
          state.exercises[e].sets[s].done = true
          state.exercises[e].sets[s].weight = weight
          state.exercises[e].sets[s].reps = reps
        }
      }
      state.current = state.nextPending()
    }
  }

  func adjustRest(by seconds: Int) {
    send(["action": "adjustRest", "delta": seconds])
    mutate { state in
      if let end = state.restEndsAt { state.restEndsAt = end + Double(seconds * 1000) }
    }
  }

  func skipRest() {
    send(["action": "skipRest"])
    mutate { $0.restEndsAt = nil }
  }

  func startRoutine(id: Int) {
    send(["action": "startRoutine", "routineId": id])
  }

  func finishWorkout() {
    send(["action": "finishWorkout"])
  }

  private func mutate(_ change: (inout WatchState) -> Void) {
    guard var current = state else { return }
    change(&current)
    state = current
  }

  private func send(_ message: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil, errorHandler: { error in
        NSLog("[IronLogWatch] sendMessage failed: \(error.localizedDescription)")
      })
    } else {
      // Queued and delivered when the iPhone app can receive it.
      session.transferUserInfo(message)
    }
  }

  // MARK: - Receiving

  private func receive(_ payload: [String: Any]) {
    guard let json = payload["state"] as? String,
          let data = json.data(using: .utf8),
          let decoded = try? decoder.decode(WatchState.self, from: data)
    else { return }
    DispatchQueue.main.async {
      if let existing = self.state, existing.sentAt > decoded.sentAt { return }
      self.state = decoded
    }
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if let error {
      NSLog("[IronLogWatch] activation failed: \(error.localizedDescription)")
    }
    let isReachable = session.isReachable
    receive(session.receivedApplicationContext)
    DispatchQueue.main.async { self.reachable = isReachable }
    if activationState == .activated {
      send(["action": "requestState"])
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    let isReachable = session.isReachable
    DispatchQueue.main.async { self.reachable = isReachable }
    if isReachable {
      send(["action": "requestState"])
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    receive(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    receive(message)
  }
}
