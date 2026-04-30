import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import { toast } from 'sonner';
import { LogOut, Users, Clock, CheckCircle, XCircle, SkipForward, PhoneCall, ChevronUp, ChevronDown } from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number: string;
  position: number;
  status: string;
  estimated_wait_minutes: number;
  joined_at: string;
  user_full_name?: string;
  service_name?: string;
  intake_data?: Record<string, unknown>;
}

interface Queue {
  id: string;
  service_id: string;
  service_name: string;
  waiting_count: number;
  called_count: number;
}

export default function StaffDashboard() {
  const { admin, logout } = useAdminAuth();
  const qc = useQueryClient();
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  // Fetch today's queues for this branch
  const { data: queues = [] } = useQuery({
    queryKey: ['staff-queues', admin?.staffRecord.branch_id],
    queryFn: () => api.get<Queue[]>(`/queues?branch_id=${admin!.staffRecord.branch_id}`),
    enabled: !!admin?.staffRecord.branch_id,
    refetchInterval: 15_000,
  });

  // Fetch tickets for the active queue
  const { data: tickets = [] } = useQuery({
    queryKey: ['queue-tickets', activeQueueId],
    queryFn: () => api.get<Ticket[]>(`/tickets/queue/${activeQueueId}`),
    enabled: !!activeQueueId,
    refetchInterval: 8_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/tickets/${id}/status`, { new_status: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue-tickets', activeQueueId] });
      qc.invalidateQueries({ queryKey: ['staff-queues', admin?.staffRecord.branch_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const waiting  = tickets.filter(t => t.status === 'waiting');
  const called   = tickets.filter(t => t.status === 'called');
  const served   = tickets.filter(t => t.status === 'completed');

  const statusColor: Record<string, string> = {
    waiting:   'bg-blue-500/20 text-blue-400',
    called:    'bg-amber-500/20 text-amber-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
    no_show:   'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="font-bold text-lg">Q ME NOW</h1>
          <p className="text-white/50 text-xs">{admin?.staffRecord.branch_name || 'Staff Dashboard'} — {admin?.staffRecord.role_label}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/60">{admin?.name}</span>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — queue selector */}
        <aside className="w-64 border-r border-white/10 p-4 space-y-2 overflow-y-auto">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Today's Queues</p>
          {queues.length === 0 && (
            <p className="text-white/30 text-sm">No queues open today.</p>
          )}
          {queues.map(q => (
            <button
              key={q.id}
              onClick={() => setActiveQueueId(q.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                activeQueueId === q.id ? 'bg-white/15' : 'hover:bg-white/5'
              }`}
            >
              <p className="font-medium text-sm">{q.service_name}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-blue-400">{q.waiting_count} waiting</span>
                <span className="text-xs text-amber-400">{q.called_count} called</span>
              </div>
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {!activeQueueId ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <Users className="w-12 h-12 mb-3" />
              <p>Select a queue to manage</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Waiting',   value: waiting.length,  icon: Clock,        color: 'text-blue-400' },
                  { label: 'Called',    value: called.length,   icon: PhoneCall,    color: 'text-amber-400' },
                  { label: 'Served',    value: served.length,   icon: CheckCircle,  color: 'text-emerald-400' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
                    <s.icon className={`w-8 h-8 ${s.color}`} />
                    <div>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-white/50">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ticket list */}
              <div>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">Queue</h2>
                <div className="space-y-2">
                  {tickets.filter(t => ['waiting', 'called'].includes(t.status)).length === 0 && (
                    <p className="text-white/30 text-sm">No active tickets.</p>
                  )}
                  {tickets
                    .filter(t => ['waiting', 'called'].includes(t.status))
                    .sort((a, b) => a.position - b.position)
                    .map(ticket => (
                      <div key={ticket.id} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center font-bold text-sm">
                          {ticket.ticket_number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{ticket.user_full_name || 'Customer'}</p>
                          <p className="text-xs text-white/50">{ticket.service_name} · ~{ticket.estimated_wait_minutes} min</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColor[ticket.status] || ''}`}>
                          {ticket.status}
                        </span>
                        {/* Action buttons */}
                        <div className="flex gap-1">
                          {ticket.status === 'waiting' && (
                            <button
                              onClick={() => updateStatus.mutate({ id: ticket.id, status: 'called' })}
                              className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
                              title="Call next"
                            >
                              <PhoneCall className="w-4 h-4" />
                            </button>
                          )}
                          {ticket.status === 'called' && (
                            <>
                              <button
                                onClick={() => updateStatus.mutate({ id: ticket.id, status: 'completed' })}
                                className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                                title="Mark served"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: ticket.id, status: 'no_show' })}
                                className="p-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 transition-colors"
                                title="No show"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => updateStatus.mutate({ id: ticket.id, status: 'cancelled' })}
                            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                            title="Remove"
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
