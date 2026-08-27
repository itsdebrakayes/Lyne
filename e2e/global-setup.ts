import { execSync } from 'child_process';

/**
 * Give every run the same starting line.
 *
 * These tests spend tickets: the desk loop calls somebody, serves them and
 * completes the visit, which is the point. Run twice in a row and the second
 * pass finds an empty queue and skips itself — a suite that quietly stops
 * testing anything is worse than one that fails, because it keeps reporting
 * green.
 *
 * So the demo day is rebuilt before the run. It is the same refresh the demo
 * box performs at 00:05, and it is safe here because this suite only ever
 * points at the demo database.
 */
export default async function globalSetup() {
  try {
    execSync('docker exec lyne_api node scripts/refresh-demo-data.js', { stdio: 'pipe', timeout: 120_000 });
    console.log('  [setup] demo day rebuilt — the queues have people in them again');
  } catch (err) {
    console.warn('  [setup] could not rebuild the demo day; tests may skip for want of a queue');
  }
}
