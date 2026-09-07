// Simple app-level store (no external deps) + React hook wrapper.
import { useSyncExternalStore } from "react";

export type Stage =
  | "joined"
  | "almost_up"
  | "checked_in"
  | "called"
  | "in_service"
  | "completed"
  | "cancelled";

export type TicketInfo = {
  number: string;
  spot: number;
  ahead: number;
  etaMins: number;
  branch: string;
  service: string;
  agencyCode: string;
  agencyName: string;
  holder: string;
  code: string;
};

export type AppState = {
  onboardingComplete: boolean;
  isAuthed: boolean;
  activeTicketId: string | null;
  activeTicketStage: Stage;
  peopleAhead: number;
  etaMins: number;
  ticket: TicketInfo;
  savedBranchIds: string[];
};

const DEFAULT_TICKET: TicketInfo = {
  number: "MEM-003",
  spot: 2,
  ahead: 1,
  etaMins: 14,
  branch: "Montego Bay Member Centre",
  service: "Membership & Account Opening",
  agencyCode: "CFC",
  agencyName: "Community First Credit Union",
  holder: "Shanique Powell",
  code: "FHTDA9",
};

type Listener = () => void;
const listeners = new Set<Listener>();

let state: AppState = {
  onboardingComplete: false,
  isAuthed: false,
  activeTicketId: "t1",
  activeTicketStage: "joined",
  peopleAhead: 1,
  etaMins: 14,
  ticket: DEFAULT_TICKET,
  savedBranchIds: ["b1"],
};

export function getState(): AppState {
  return state;
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}
