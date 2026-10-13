import ExpoModulesCore
import WatchConnectivity

// Bridges WatchConnectivity to JavaScript.
// - JS calls updateState(json) whenever the active workout changes; the snapshot goes out
//   as application context (delivered even if the watch app is closed) and, when the
//   watch is reachable, as a live message too.
// - Messages and queued user-info transfers from the watch are emitted as "onMessage".
public class WatchBridgeModule: Module {
  private let connector = WatchConnector()

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onMessage", "onStatusChange")

    OnCreate {
      // sendEvent takes [String: Any?]; widen explicitly rather than rely on implicit conversion.
      self.connector.onMessage = { [weak self] message in
        self?.sendEvent("onMessage", message.mapValues { value -> Any? in value })
      }
      self.connector.onStatusChange = { [weak self] status in
        self?.sendEvent("onStatusChange", status.mapValues { value -> Any? in value })
      }
      self.connector.activate()
    }

    Function("getStatus") { () -> [String: Any] in
      return self.connector.status()
    }

    Function("updateState") { (json: String) in
      self.connector.update(json: json)
    }
  }
}

final class WatchConnector: NSObject, WCSessionDelegate {
  var onMessage: (([String: Any]) -> Void)?
  var onStatusChange: (([String: Any]) -> Void)?

  private let lock = NSLock()
  private var pendingJSON: String?

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func status() -> [String: Any] {
    guard WCSession.isSupported() else {
      return ["supported": false, "paired": false, "watchAppInstalled": false, "reachable": false]
    }
    let session = WCSession.default
    let activated = session.activationState == .activated
    return [
      "supported": true,
      "paired": activated && session.isPaired,
      "watchAppInstalled": activated && session.isWatchAppInstalled,
      "reachable": activated && session.isReachable,
    ]
  }

  func update(json: String) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else {
      // Sent once activation completes.
      lock.lock()
      pendingJSON = json
      lock.unlock()
      return
    }
    guard session.isPaired, session.isWatchAppInstalled else { return }
    let payload: [String: Any] = ["state": json]
    do {
      try session.updateApplicationContext(payload)
    } catch {
      NSLog("[WatchBridge] updateApplicationContext failed: \(error.localizedDescription)")
    }
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil, errorHandler: { error in
        NSLog("[WatchBridge] sendMessage failed: \(error.localizedDescription)")
      })
    }
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if let error = error {
      NSLog("[WatchBridge] activation failed: \(error.localizedDescription)")
    }
    lock.lock()
    let json = pendingJSON
    pendingJSON = nil
    lock.unlock()
    if activationState == .activated, let json = json {
      update(json: json)
    }
    onStatusChange?(status())
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // The user switched to a different watch; reactivate for the new one.
    WCSession.default.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    onStatusChange?(status())
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    onStatusChange?(status())
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    onMessage?(message)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    onMessage?(message)
    replyHandler(["ok": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    onMessage?(userInfo)
  }
}
