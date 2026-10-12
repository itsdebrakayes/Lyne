import ActivityKit
import Foundation

/// Keep identical to modules/live-activity/ios/LyneTicketAttributes.swift.
/// ActivityKit matches the app and the widget by this type's name and shape.
/// ContentState's field names are also what the server sends
/// (apps/backend/src/utils/liveUpdates.js buildContentState).
struct LyneTicketAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// "waiting", "called", "in_service" or "ended"
    var status: String
    var ahead: Int
    var waitMinutes: Int
    /// 0...1, position-based: it only ever moves forward.
    var progress: Double
    /// The verification code, present once called.
    var code: String?
  }

  var ticketNumber: String
  var businessName: String
  var branchName: String
  var serviceName: String
  var joinedAt: Date
}
