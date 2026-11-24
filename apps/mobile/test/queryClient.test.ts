/**
 * The kiosk's "Get My Ticket" spun forever while the device was wrongly marked
 * offline: React Query paused the walk-in instead of sending it. These pin the
 * app's client (src/lib/queryClient.ts) to always making the first attempt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MutationObserver, QueryClient, onlineManager } from '@tanstack/react-query';
import { createQueryClient } from '../src/lib/queryClient';

const tick = () => new Promise((r) => setImmediate(r));

test.afterEach(() => onlineManager.setOnline(true));

test('a mutation is sent even while the device is marked offline', async () => {
  onlineManager.setOnline(false);
  const client = createQueryClient();
  let sent = 0;
  const observer = new MutationObserver(client, {
    mutationFn: async () => { sent++; return { ticket_number: 'A-1' }; },
  });
  const result = await observer.mutate();
  assert.equal(sent, 1, 'the request went out');
  assert.deepEqual(result, { ticket_number: 'A-1' });
  assert.equal(observer.getCurrentResult().isPending, false, 'nothing is left spinning');
});

test('a failed mutation while marked offline reports its error instead of pausing', async () => {
  onlineManager.setOnline(false);
  const client = createQueryClient();
  const observer = new MutationObserver(client, {
    mutationFn: async () => { throw new Error('That took too long. Check your connection and try again.'); },
  });
  await assert.rejects(observer.mutate(), /took too long/);
  const state = observer.getCurrentResult();
  assert.equal(state.isPending, false);
  assert.equal(state.isPaused, false);
  assert.match(String(state.error), /took too long/);
});

test('a query is fetched even while the device is marked offline', async () => {
  onlineManager.setOnline(false);
  const client = createQueryClient();
  const data = await client.fetchQuery({ queryKey: ['kiosk-services'], queryFn: async () => [{ id: 'svc' }] });
  assert.deepEqual(data, [{ id: 'svc' }]);
});

test('control: a default client pauses the same mutation, which is the spinner', async () => {
  onlineManager.setOnline(false);
  const client = new QueryClient();
  let sent = 0;
  const observer = new MutationObserver(client, { mutationFn: async () => { sent++; return null; } });
  void observer.mutate();
  await tick();
  const state = observer.getCurrentResult();
  assert.equal(sent, 0, 'never sent');
  assert.equal(state.isPending, true);
  assert.equal(state.isPaused, true);
  client.clear();
});
