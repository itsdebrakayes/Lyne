import ActivityKit
import ExpoModulesCore

struct TicketAttributesRecord: Record {
  @Field var ticketNumber: String = ""
  @Field var businessName: String = ""
  @Field var branchName: String = ""
  @Field var serviceName: String = ""
  @Field var joinedAt: Double = 0 // ms since epoch
}

struct TicketStateRecord: Record {
  @Field var status: String = "waiting"
  @Field var ahead: Int = 0
  @Field var waitMinutes: Int = 0
  @Field var progress: Double = 0
  @Field var code: String? = nil
}

/// Starts, updates and ends the ticket Live Activity, and reports the push
/// token ActivityKit issues for it so the server can update it while the app
/// is closed. iOS 16.2+; below that every call is a harmless no-op.
public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")
    Events("onPushToken")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) { return ActivityAuthorizationInfo().areActivitiesEnabled }
      return false
    }

    AsyncFunction("start") { (attrs: TicketAttributesRecord, state: TicketStateRecord) -> String? in
      guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
      // One ticket, one activity: end any left over from an earlier ticket.
      for existing in Activity<LyneTicketAttributes>.activities where existing.attributes.ticketNumber != attrs.ticketNumber {
        await existing.end(nil, dismissalPolicy: .immediate)
      }
      if let same = Activity<LyneTicketAttributes>.activities.first(where: { $0.attributes.ticketNumber == attrs.ticketNumber }) {
        self.observeToken(same)
        return same.id
      }
      let attributes = LyneTicketAttributes(
        ticketNumber: attrs.ticketNumber, businessName: attrs.businessName,
        branchName: attrs.branchName, serviceName: attrs.serviceName,
        joinedAt: Date(timeIntervalSince1970: attrs.joinedAt / 1000)
      )
      let activity = try Activity.request(
        attributes: attributes,
        content: ActivityContent(state: Self.content(state), staleDate: Date().addingTimeInterval(20 * 60)),
        pushType: .token
      )
      self.observeToken(activity)
      return activity.id
    }

    AsyncFunction("update") { (state: TicketStateRecord) in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<LyneTicketAttributes>.activities {
        await activity.update(ActivityContent(state: Self.content(state), staleDate: Date().addingTimeInterval(20 * 60)))
      }
    }

    AsyncFunction("end") { (state: TicketStateRecord?, immediately: Bool) in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<LyneTicketAttributes>.activities {
        let final = state.map { ActivityContent(state: Self.content($0), staleDate: nil) }
        await activity.end(final, dismissalPolicy: immediately ? .immediate : .after(Date().addingTimeInterval(5 * 60)))
      }
    }
  }

  @available(iOS 16.2, *)
  private static func content(_ r: TicketStateRecord) -> LyneTicketAttributes.ContentState {
    LyneTicketAttributes.ContentState(status: r.status, ahead: r.ahead, waitMinutes: r.waitMinutes, progress: r.progress, code: r.code)
  }

  @available(iOS 16.2, *)
  private func observeToken(_ activity: Activity<LyneTicketAttributes>) {
    Task { [weak self] in
      for await data in activity.pushTokenUpdates {
        let token = data.map { String(format: "%02x", $0) }.joined()
        self?.sendEvent("onPushToken", ["activityId": activity.id, "token": token])
      }
    }
  }
}
