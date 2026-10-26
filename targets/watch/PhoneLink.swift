import Foundation
import WatchConnectivity

/// Watch side of WatchConnectivity (9F). Confirmed sets go into a persistent outbox: sent with sendMessage
/// while the iPhone is reachable, otherwise with transferUserInfo (OS-queued, survives disconnects/relaunch).
/// An item leaves the outbox only when the phone acks it (message reply, or `acks` in its app context),
/// and the phone ignores duplicate uids, so resending after a lost ack is safe.
@MainActor
final class PhoneLink: NSObject {
    var onContext: (@MainActor (PhoneContext) -> Void)?
    var onCommand: (@MainActor ([String: Any]) async -> [String: Any])?
    var onStatus: (@MainActor (_ reachable: Bool, _ queued: Int) -> Void)?

    private struct Item: Codable {
        var uid: String
        var json: Data
        var viaUserInfo = false
    }

    private var outbox: [Item] = []
    private var inFlight = Set<String>()
    private let session = WCSession.default
    private let outboxURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("outbox.json")

    func activate() {
        outbox = (try? JSONDecoder().decode([Item].self, from: Data(contentsOf: outboxURL))) ?? []
        session.delegate = self
        session.activate()
        status()
    }

    func enqueue(uid: String, payload: [String: Any]) {
        guard let json = try? JSONSerialization.data(withJSONObject: payload) else { return }
        outbox.append(Item(uid: uid, json: json))
        save()
        flush()
    }

    /// Not queued: a convenience ping (e.g. "start") that only matters if the phone is listening right now.
    func sendIfReachable(_ payload: [String: Any]) {
        guard session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(payload, replyHandler: { @Sendable _ in }, errorHandler: { @Sendable _ in })
    }

    func flush() {
        guard session.activationState == .activated else { return }
        for item in outbox where !inFlight.contains(item.uid) {
            guard let payload = (try? JSONSerialization.jsonObject(with: item.json)) as? [String: Any] else { continue }
            guard session.isReachable else {
                queueViaUserInfo(item.uid)
                continue
            }
            let uid = item.uid
            inFlight.insert(uid)
            session.sendMessage(payload, replyHandler: { @Sendable reply in
                let ok = reply["ok"] as? Bool == true
                Task { @MainActor in
                    self.inFlight.remove(uid)
                    if ok { self.acknowledge([uid]) }
                }
            }, errorHandler: { @Sendable _ in
                Task { @MainActor in
                    self.inFlight.remove(uid)
                    self.queueViaUserInfo(uid)
                }
            })
        }
    }

    /// Labeled motion CSV → phone Documents/FilesReceived. The file is deleted once the transfer finishes.
    func transferRecording(_ url: URL, metadata: [String: Any]) {
        session.transferFile(url, metadata: metadata)
    }

    private func queueViaUserInfo(_ uid: String) {
        guard let i = outbox.firstIndex(where: { $0.uid == uid }), !outbox[i].viaUserInfo,
              session.activationState == .activated,
              let payload = (try? JSONSerialization.jsonObject(with: outbox[i].json)) as? [String: Any] else { return }
        session.transferUserInfo(payload)
        outbox[i].viaUserInfo = true
        save()
    }

    private func acknowledge(_ uids: [String]) {
        guard !uids.isEmpty else { return }
        let done = Set(uids)
        outbox.removeAll { done.contains($0.uid) }
        save()
    }

    private func save() {
        try? JSONEncoder().encode(outbox).write(to: outboxURL, options: .atomic)
        status()
    }

    private func status() {
        onStatus?(session.activationState == .activated && session.isReachable, outbox.count)
    }

    fileprivate func received(_ dictionary: [String: Any]) {
        guard let context = PhoneContext(dictionary: dictionary) else { return }
        acknowledge(context.acks ?? [])
        onContext?(context)
    }

    fileprivate func connectionChanged() {
        status()
        flush()
    }
}

extension PhoneLink: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let context = session.receivedApplicationContext
        Task { @MainActor in
            self.received(context)
            self.connectionChanged()
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in self.connectionChanged() }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.received(applicationContext) }
    }

    /// Commands from the phone's Collect Data / Calibrate screens.
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            let reply = await self.onCommand?(message) ?? ["ok": false, "error": "watch app not ready"]
            replyHandler(reply)
        }
    }

    nonisolated func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
        if error == nil { try? FileManager.default.removeItem(at: fileTransfer.file.fileURL) }
    }
}
