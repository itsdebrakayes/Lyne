import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck,
  FileWarning, Plus, Save, Trash2,
} from 'lucide-react';
import api from '@/lib/apiClient';
import { Card, Pills, Stat, Status } from '@/design/ui';
import { useSectorTerms, lower } from '@/hooks/useSectorTerms';

export type ReadinessService = {
  id: string;
  name: string;
  description?: string | null;
  readiness_count?: number;
};

type ReadinessItem = {
  id?: string;
  kind: 'bring' | 'prepare';
  label: string;
  detail: string;
  is_mandatory: boolean;
  lead_minutes: number | null;
};

type ServiceDetail = ReadinessService & {
  readiness?: Array<Omit<ReadinessItem, 'detail'> & { detail?: string | null }>;
};

type ReadinessAnalytics = {
  period: string;
  summary: {
    served_visits: number;
    checklist_shown: number;
    assessed_visits: number;
    ready_visits: number;
    incomplete_visits: number;
    awaiting_outcome: number;
    /** null when no checklist was shown — a rate over an empty population
     *  is not 0%, it is undefined, and saying 0% reads as a failure. */
    assessed_rate: number | null;
    incomplete_rate: number;
  };
  services: Array<{
    service_id: string;
    service_name: string;
    checklist_items: number;
    checklist_shown: number;
    assessed_visits: number;
    ready_visits: number;
    incomplete_visits: number;
    incomplete_rate: number;
  }>;
  recent_incomplete: Array<{
    id: string;
    ticket_number: string;
    completed_at?: string | null;
    readiness_note?: string | null;
    service_name: string;
    branch_name: string;
    staff_name?: string | null;
  }>;
};

const blank = (kind: 'bring' | 'prepare'): ReadinessItem => ({
  kind,
  label: '',
  detail: '',
  is_mandatory: true,
  lead_minutes: null,
});

function ReadinessEditor({ services, initialServiceId }: {
  services: ReadinessService[];
  initialServiceId?: string;
}) {
  const terms = useSectorTerms();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(initialServiceId || services[0]?.id || '');
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const preferred = initialServiceId && services.some((service) => service.id === initialServiceId)
      ? initialServiceId
      : services[0]?.id;
    if (!services.some((service) => service.id === selectedId) && preferred) setSelectedId(preferred);
  }, [initialServiceId, selectedId, services]);

  const detail = useQuery({
    queryKey: ['readiness-service', selectedId],
    queryFn: () => api.get<ServiceDetail>(`/services/${selectedId}`, false),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (!detail.data) return;
    setItems((detail.data.readiness || []).map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      detail: item.detail || '',
      is_mandatory: Boolean(item.is_mandatory),
      lead_minutes: item.lead_minutes == null ? null : Number(item.lead_minutes),
    })));
    setDirty(false);
    setSaved(false);
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () => api.put<ReadinessItem[]>(`/services/${selectedId}/readiness`, {
      items: items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        kind: item.kind,
        label: item.label.trim(),
        detail: item.detail.trim() || null,
        is_mandatory: item.is_mandatory,
        lead_minutes: item.kind === 'prepare' ? item.lead_minutes : null,
      })),
    }),
    onSuccess: async () => {
      setSaved(true);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ['readiness-service', selectedId] });
      await qc.invalidateQueries({ queryKey: ['readiness-services'] });
      await qc.invalidateQueries({ queryKey: ['readiness-analytics'] });
      window.setTimeout(() => setSaved(false), 2600);
    },
  });

  const update = (index: number, patch: Partial<ReadinessItem>) => {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    setDirty(true);
    setSaved(false);
  };
  const remove = (index: number) => {
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
    setDirty(true);
  };
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    setItems(current => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setDirty(true);
  };

  const invalid = items.some(item => !item.label.trim());
  const service = services.find(option => option.id === selectedId) || detail.data;

  if (!services.length) {
    return <div className="qx-readyempty"><ClipboardCheck /><b>No service is assigned yet</b><span>Assign a service before building its {lower(terms.visitor.one)} checklist.</span></div>;
  }

  return (
    <div className="qx-readyeditor">
      <div className="qx-readytoolbar">
        <div>
          <b>{terms.visitor.one} checklist</b>
          <span>Published on the join screen as soon as you save.</span>
        </div>
        {services.length > 1 ? (
          <label className="qx-readyservice">
            <span>Service</span>
            <select value={selectedId} onChange={(event) => {
              if (dirty && !window.confirm('Discard unsaved checklist changes?')) return;
              setSelectedId(event.target.value);
            }}>
              {services.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
        ) : <span className="qx-readyservice-name">{service?.name}</span>}
      </div>

      {detail.isLoading ? <div className="qx-readyempty"><span>Loading checklist…</span></div> : null}
      {detail.error ? <div className="qx-note t-bad"><b>Checklist could not be loaded.</b> Try Update, or reopen this screen.</div> : null}

      {!detail.isLoading && !detail.error ? (
        <>
          <div className="qx-readyintro">
            <ClipboardCheck size={18} />
            <p><b>Keep it concrete.</b> “Bring two payslips” is useful; “bring all documents” is not. Ticks are a prompt only—staff still check at the desk.</p>
          </div>

          {!items.length ? (
            <div className="qx-readyempty">
              <ClipboardCheck />
              <b>No checklist items yet</b>
              <span>Add what a {lower(terms.visitor.one)} must bring or do before arriving.</span>
            </div>
          ) : (
            <div className="qx-readyitems">
              {items.map((item, index) => (
                <div className="qx-readyitem" key={item.id || `${item.kind}-${index}`}>
                  <div className="qx-readyorder">
                    <button type="button" aria-label="Move item up" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp /></button>
                    <button type="button" aria-label="Move item down" onClick={() => move(index, 1)} disabled={index === items.length - 1}><ArrowDown /></button>
                  </div>
                  <div className="qx-readyfields">
                    <div className="qx-readyrow">
                      <label><span>Type</span><select value={item.kind} onChange={(event) => update(index, { kind: event.target.value as ReadinessItem['kind'] })}>
                        <option value="bring">Bring</option><option value="prepare">Prepare</option>
                      </select></label>
                      <label className="grow"><span>Checklist label</span><input maxLength={140} value={item.label}
                        onChange={(event) => update(index, { label: event.target.value })}
                        placeholder={item.kind === 'bring' ? 'e.g. Two recent payslips' : 'e.g. Complete the loan application'} /></label>
                    </div>
                    <div className="qx-readyrow">
                      <label className="grow"><span>Helpful detail</span><input maxLength={400} value={item.detail}
                        onChange={(event) => update(index, { detail: event.target.value })}
                        placeholder="Examples, acceptable alternatives, or where to find it" /></label>
                      {item.kind === 'prepare' ? (
                        <label className="lead"><span>Minutes before</span><input type="number" min="0" max="10080" value={item.lead_minutes ?? ''}
                          onChange={(event) => update(index, { lead_minutes: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                      ) : null}
                    </div>
                    <label className="qx-readyrequired"><input type="checkbox" checked={item.is_mandatory}
                      onChange={(event) => update(index, { is_mandatory: event.target.checked })} />
                      <span><b>Required to proceed</b><small>Members must confirm this before joining.</small></span>
                    </label>
                  </div>
                  <button type="button" className="qx-readydelete" aria-label="Delete checklist item" onClick={() => remove(index)}><Trash2 /></button>
                </div>
              ))}
            </div>
          )}

          <div className="qx-readyfooter">
            <div className="qx-readyadd">
              <button type="button" className="qx-btn ghost" onClick={() => { setItems(current => [...current, blank('bring')]); setDirty(true); }}><Plus />Add something to bring</button>
              <button type="button" className="qx-btn ghost" onClick={() => { setItems(current => [...current, blank('prepare')]); setDirty(true); }}><Plus />Add preparation</button>
            </div>
            <div className="qx-readysave">
              {save.error ? <span className="bad">{save.error instanceof Error ? save.error.message : 'Could not save.'}</span> : null}
              {saved ? <span className="good"><CheckCircle2 />Published</span> : dirty ? <span>Unsaved changes</span> : <span>Up to date</span>}
              <button type="button" className="qx-btn primary" disabled={!dirty || invalid || save.isPending} onClick={() => save.mutate()}>
                <Save />{save.isPending ? 'Saving…' : 'Save checklist'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function StaffReadinessWorkspace({ service }: { service: ReadinessService | null }) {
  const terms = useSectorTerms();
  return (
    <div className="qx-grid">
      <Card span={12} title={`What ${lower(terms.visitor.many)} need before they arrive`} cap={`Your assigned service · ${lower(terms.visitor.one)}-facing wording`}>
        <ReadinessEditor services={service ? [service] : []} initialServiceId={service?.id} />
      </Card>
    </div>
  );
}

export function ManagerReadinessWorkspace({ businessId, branchId, services }: {
  businessId?: string;
  branchId?: string;
  services: ReadinessService[];
}) {
  const terms = useSectorTerms();
  const [period, setPeriod] = useState('this_week');
  const params = useMemo(() => {
    const query = new URLSearchParams({ business_id: businessId || '', period });
    if (branchId) query.set('branch_id', branchId);
    return query.toString();
  }, [branchId, businessId, period]);
  const analytics = useQuery({
    queryKey: ['readiness-analytics', businessId, branchId, period],
    queryFn: () => api.get<ReadinessAnalytics>(`/analytics/readiness?${params}`),
    enabled: Boolean(businessId),
    refetchInterval: 30_000,
  });
  const data = analytics.data;
  const summary = data?.summary;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={ClipboardCheck} label="Checklist Shown" value={summary?.checklist_shown || 0}
        foot={`Tickets created after the ${lower(terms.visitor.one)} prompt`} />
      <Stat span={3} icon={CheckCircle2} label="Ready At The Desk" value={summary?.ready_visits || 0}
        foot="Staff-confirmed complete visits" />
      <Stat span={3} icon={FileWarning} tone={(summary?.incomplete_visits || 0) ? 'bad' : 'primary'} label="Incomplete Visits"
        value={summary?.incomplete_visits || 0} unit={`${summary?.incomplete_rate || 0}%`}
        foot="Of visits assessed by staff" />
      <Stat span={3} icon={AlertTriangle} tone={(summary?.awaiting_outcome || 0) ? 'warn' : 'primary'} label="Not Recorded"
        value={summary?.awaiting_outcome || 0}
        foot={summary?.assessed_rate == null
          ? 'No checklist was shown in this period'
          : `${summary.assessed_rate}% of shown checklists assessed`} />

      <Card span={12} title="Readiness outcomes" cap={`Staff assessment at the desk—not ${lower(terms.visitor.one)} self-report`}
        tools={<Pills value={period} onChange={setPeriod} options={[["today", "Today"], ["this_week", "This Week"], ["last_week", "Last Week"], ["month", "This Month"]]} />}>
        {analytics.isLoading ? <div className="qx-readyempty"><span>Loading outcomes…</span></div> : null}
        {analytics.error ? <div className="qx-note t-bad"><b>Readiness outcomes could not be loaded.</b></div> : null}
        {data && !data.services.some(service => service.assessed_visits) ? (
          <div className="qx-readyempty"><ClipboardCheck /><b>No assessed visits in this period</b><span>Outcomes appear once staff complete a checklist-backed visit.</span></div>
        ) : null}
        {data?.services.some(service => service.assessed_visits) ? (
          <div className="qx-readyoutcomes">
            <div className="qx-readyoutcome head"><span>Service</span><span>Shown</span><span>Assessed</span><span>Incomplete</span><span>Rate</span></div>
            {data.services.filter(service => service.checklist_items || service.assessed_visits).map(service => (
              <div className="qx-readyoutcome" key={service.service_id}>
                <span><b>{service.service_name}</b><small>{service.checklist_items} checklist item{service.checklist_items === 1 ? '' : 's'}</small></span>
                <span>{service.checklist_shown}</span><span>{service.assessed_visits}</span><span>{service.incomplete_visits}</span>
                <span><Status kind={service.incomplete_rate > 15 ? 'busy' : service.incomplete_rate > 0 ? 'soon' : 'open'}>{service.incomplete_rate}%</Status></span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card span={12} title={<>Incomplete visit notes<span className="qx-count">{data?.recent_incomplete.length || 0}</span></>}
        cap={`The practical reasons ${lower(terms.visitor.many)} could not finish—most recent first`}>
        {data?.recent_incomplete.length ? (
          <div className="qx-readyincidents">
            {data.recent_incomplete.map(visit => (
              <div key={visit.id} className="qx-readyincident">
                <span className="ticket">{visit.ticket_number}</span>
                <div><b>{visit.readiness_note || 'No note recorded'}</b><small>{visit.service_name} · {visit.staff_name || 'Staff member'}</small></div>
                <time>{visit.completed_at ? new Date(visit.completed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</time>
              </div>
            ))}
          </div>
        ) : <div className="qx-readyempty"><CheckCircle2 /><b>No incomplete visits here</b><span>That is good news. Change the period above to review earlier outcomes.</span></div>}
      </Card>

      <Card span={12} title={`Author the ${lower(terms.visitor.one)} checklist`} cap="One approved checklist per service · shared by every branch">
        <ReadinessEditor services={services} />
      </Card>
    </div>
  );
}

