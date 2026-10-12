import ActivityKit
import SwiftUI
import WidgetKit

// Lyne palette: navy ground, white type, the brand's light blue as the accent.
private let navy = Color(red: 0.043, green: 0.106, blue: 0.247)      // #0B1B3F
private let accent = Color(red: 0.361, green: 0.769, blue: 0.973)    // #5CC4F8
private let accentInk = Color(red: 0.031, green: 0.067, blue: 0.161) // text on accent
private let live = Color(red: 0.184, green: 0.749, blue: 0.443)      // #2FBF71
private let dim = Color.white.opacity(0.62)

private func isCalled(_ s: LyneTicketAttributes.ContentState) -> Bool { s.status == "called" }

/// The brand mark, small: the L on a rounded square.
private struct Mark: View {
  var inverted = false
  var body: some View {
    Text("L")
      .font(.system(size: 13, weight: .heavy, design: .rounded))
      .foregroundColor(inverted ? accent : navy)
      .frame(width: 22, height: 22)
      .background(RoundedRectangle(cornerRadius: 6).fill(inverted ? navy : Color.white))
  }
}

private struct ProgressBar: View {
  var value: Double
  var tint: Color
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.white.opacity(0.18))
        Capsule().fill(tint).frame(width: max(6, geo.size.width * CGFloat(min(max(value, 0), 1))))
      }
    }
    .frame(height: 5)
  }
}

private struct LockScreenView: View {
  let context: ActivityViewContext<LyneTicketAttributes>

  var body: some View {
    let s = context.state
    let a = context.attributes
    let called = isCalled(s)
    let ink: Color = called ? accentInk : .white
    let sub: Color = called ? accentInk.opacity(0.7) : dim

    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        Mark(inverted: called)
        VStack(alignment: .leading, spacing: 1) {
          Text(called ? "It's your turn: head to the counter" : a.businessName)
            .font(.system(size: 14, weight: .semibold)).foregroundColor(ink).lineLimit(1)
          Text("\(a.branchName) · \(a.serviceName)")
            .font(.system(size: 12)).foregroundColor(sub).lineLimit(1)
        }
        Spacer(minLength: 4)
        HStack(spacing: 4) {
          Circle().fill(called ? accentInk : live).frame(width: 6, height: 6)
          Text(called ? "NOW" : "LIVE").font(.system(size: 11, weight: .bold)).foregroundColor(ink)
        }
      }

      HStack(alignment: .firstTextBaseline) {
        VStack(alignment: .leading, spacing: 0) {
          Text(a.ticketNumber).font(.system(size: 28, weight: .bold, design: .rounded)).foregroundColor(ink)
          Text(called ? "Show this ticket" : "Your ticket").font(.system(size: 12)).foregroundColor(sub)
        }
        Spacer()
        if called, let code = s.code {
          VStack(alignment: .trailing, spacing: 0) {
            Text(code).font(.system(size: 24, weight: .bold, design: .monospaced)).foregroundColor(ink)
            Text("Verify at the counter").font(.system(size: 12)).foregroundColor(sub)
          }
        } else if s.status == "in_service" {
          Text("Being served").font(.system(size: 17, weight: .semibold)).foregroundColor(ink)
        } else {
          VStack(alignment: .trailing, spacing: 0) {
            Text("\(s.ahead)").font(.system(size: 28, weight: .bold, design: .rounded)).foregroundColor(accent)
            Text(s.ahead == 1 ? "Ahead of you" : "Ahead of you").font(.system(size: 12)).foregroundColor(sub)
          }
        }
      }

      if !called && s.status != "in_service" {
        ProgressBar(value: s.progress, tint: accent)
        HStack {
          Text(s.waitMinutes > 0 ? "About \(s.waitMinutes) min" : "You're next").font(.system(size: 12, weight: .medium)).foregroundColor(dim)
          Spacer()
          Text("Joined \(a.joinedAt, style: .time)").font(.system(size: 12)).foregroundColor(dim)
        }
      }
    }
    .padding(16)
    .activityBackgroundTint(called ? accent : navy)
    .activitySystemActionForegroundColor(ink)
  }
}

struct LyneLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LyneTicketAttributes.self) { context in
      LockScreenView(context: context)
    } dynamicIsland: { context in
      let s = context.state
      let called = isCalled(s)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 6) {
            Mark()
            Text(context.attributes.ticketNumber).font(.system(size: 15, weight: .bold, design: .rounded))
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(called ? "Your turn" : s.status == "in_service" ? "Being served" : "\(s.ahead) ahead")
            .font(.system(size: 15, weight: .semibold)).foregroundColor(accent)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            Text("\(context.attributes.businessName) · \(context.attributes.branchName)")
              .font(.system(size: 12)).foregroundColor(dim).lineLimit(1)
            if called, let code = s.code {
              Text("Show code \(code) at the counter").font(.system(size: 13, weight: .semibold))
            } else if s.status == "waiting" {
              ProgressBar(value: s.progress, tint: accent)
              Text(s.waitMinutes > 0 ? "About \(s.waitMinutes) min" : "You're next").font(.system(size: 12)).foregroundColor(dim)
            }
          }
        }
      } compactLeading: {
        Mark()
      } compactTrailing: {
        Text(called ? "Your turn" : s.status == "in_service" ? "Serving" : "\(s.ahead) ahead")
          .font(.system(size: 13, weight: .semibold)).foregroundColor(accent)
      } minimal: {
        Text(called ? "!" : "\(s.ahead)").font(.system(size: 13, weight: .bold)).foregroundColor(accent)
      }
      .keylineTint(accent)
    }
  }
}
