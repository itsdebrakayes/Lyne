/**
 * The bell, for every dashboard.
 *
 * Previously the bell rendered an unread count and had no click handler at all
 * — on all four roles. This turns it into a real control: it reads the signed-in
 * person's notifications, marks them read, and hands Shell the shape its
 * popover expects.
 *
 * Notifications are per USER (notifications.user_id), so a staff member sees
 * what was addressed to them — including anything a manager sends a supervisor.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/apiClient';
import type { QxNotify, QxNotifyItem } from '@/design/ui';

type Row = {
  id: string;
  notification_type?: string | null;
  message?: string | null;
  is_read?: boolean | number;
  sent_at?: string | null;
  ticket_number?: string | null;
  sent_by_name?: string | null;
};

/** "12 min ago" / "3 hr ago" / "Tue" — short enough for the right edge of a row. */
function ago(iso?: string | null) {
  if (!iso) return '';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/** The stored type is a slug; give it a human title. */
const TITLES: Record<string, string> = {
  queue_joined: 'Someone joined the line',
  your_turn: 'A customer was called',
  almost_your_turn: 'A customer is nearly up',
  no_show: 'Marked as a no-show',
  assignment_request: 'Counter assignment requested',
  staffing_alert: 'A line needs more staff',
  target_missed: 'A branch is over its target',
  staff_message: 'A message for you',
  staff_reply: 'A reply to your message',
};

/** Which ones deserve to look louder than the rest. */
const KINDS: Record<string, QxNotifyItem['kind']> = {
  assignment_request: 'warn',
  staffing_alert: 'warn',
  target_missed: 'urgent',
  no_show: 'warn',
};

function titleFor(row: Row) {
  const slug = String(row.notification_type || '');
  return TITLES[slug]
    || slug.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
    || 'Notification';
}

/* The two types a person can answer. Anything else is the system telling you
   something and has nobody to reply to. */
const REPLYABLE = new Set(['staff_message', 'staff_reply']);

export function useNotifications(): QxNotify & {
  unread: number;
  /** The message the viewer has chosen to reply to, if any. */
  replyTo: { id: string; from: string; quoted: string } | null;
  closeReply: () => void;
} {
  const qc = useQueryClient();
  const [replyTo, setReplyTo] = useState<{ id: string; from: string; quoted: string } | null>(null);

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Row[]>('/notifications'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const readOne = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows = list.data ?? [];
  const items: QxNotifyItem[] = rows.map((r) => ({
    id: String(r.id),
    title: titleFor(r),
    body: [
      r.sent_by_name ? `From ${r.sent_by_name}` : null,
      r.message,
      r.ticket_number ? `Ticket ${r.ticket_number}` : null,
    ].filter(Boolean).join(' · ') || undefined,
    when: ago(r.sent_at),
    read: Boolean(Number(r.is_read)),
    kind: KINDS[String(r.notification_type || '')] ?? 'info',
    /* A message from a person opens a reply box. Without this the bell was a
       read-only list: a manager could be told "approved for October" and have
       no way to answer from the place they read it. */
    onOpen: REPLYABLE.has(String(r.notification_type || '')) && r.sent_by_name
      ? () => setReplyTo({
          id: String(r.id),
          from: String(r.sent_by_name),
          quoted: String(r.message || ''),
        })
      : undefined,
  }));

  const onRead = useCallback((id: string) => {
    const row = rows.find((r) => String(r.id) === id);
    if (row && !Number(row.is_read)) readOne.mutate(id);
  }, [rows, readOne]);

  return {
    items,
    loading: list.isLoading,
    onRead,
    onReadAll: () => readAll.mutate(),
    unread: items.filter((n) => !n.read).length,
    replyTo,
    closeReply: () => setReplyTo(null),
  };
}
