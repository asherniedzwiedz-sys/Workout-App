import SwiftUI

@main
struct IronLogWatchApp: App {
  @StateObject private var phone = PhoneSession.shared

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(phone)
    }
  }
}

struct RootView: View {
  @EnvironmentObject private var phone: PhoneSession

  var body: some View {
    NavigationStack {
      if let state = phone.state, state.active {
        WorkoutView(state: state)
      } else {
        StartView(routines: phone.state?.routines ?? [], reachable: phone.reachable)
      }
    }
  }
}
