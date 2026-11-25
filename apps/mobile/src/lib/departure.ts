/**
 * When the "Time to head out" reminder should fire, as the line moves.
 *
 * The drive to the branch is measured once, when the person joins (it needs
 * their location and a server call). What changes after that is the wait, and
 * the reminder has to follow it: a line that speeds up must bring the reminder
 * forward, or it fires after they were called.
 */

/** The trip measured at join, kept on the phone for the life of the ticket. */
export type DepartureTrip = {
  ticketId: string;
  branchName: string;
  travelMinutes: number;
  leadMinutes: number;
  /** When the scheduled reminder fires, in ms since the epoch. */
  leaveAt: number;
};

/** Never schedule closer than this: a reminder that fires as you look at the
 *  screen reads as a glitch, not a warning. */
const SOONEST_MS = 60_000;

/** Waits are estimates and move by a minute or so on every poll. Moving the
 *  reminder for less than this would reschedule it every few seconds. */
const MOVE_THRESHOLD_MS = 2 * 60_000;

export function leaveAtFor(trip: Pick<DepartureTrip, 'travelMinutes' | 'leadMinutes'>, waitMinutes: number, now: number): number {
  const minutesFromNow = waitMinutes - trip.travelMinutes - trip.leadMinutes;
  return Math.max(now + SOONEST_MS, now + minutesFromNow * 60_000);
}

/**
 * The new fire time when the reminder should move, or null to leave it.
 *
 * Once the reminder has fired it stays fired: the person has been told to go,
 * and a slower line later is not a reason to tell them again.
 */
export function movedLeaveAt(trip: DepartureTrip, waitMinutes: number | null | undefined, now: number): number | null {
  /* No estimate is not an estimate of zero: moving to "now" would tell
     somebody an hour away to leave this minute. */
  if (typeof waitMinutes !== 'number' || !Number.isFinite(waitMinutes)) return null;
  if (trip.leaveAt <= now) return null;
  const next = leaveAtFor(trip, waitMinutes, now);
  return Math.abs(next - trip.leaveAt) < MOVE_THRESHOLD_MS ? null : next;
}
