import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { BloodGroup, Urgency } from '@/domain';
import { useAuth } from '@/providers/AuthProvider';
import { requestService } from '@/services/requestService';

export interface RequestDraft {
  bloodGroup: BloodGroup | null;
  units: number;
  urgency: Urgency | null;
  hospitalId: string | null;
  hospitalName: string;
  district: string;
  wardUnit: string;
  requiredBy: string | null;
  relationship: string;
  notes: string;
}

export const EMPTY_DRAFT: RequestDraft = {
  bloodGroup: null,
  units: 1,
  urgency: null,
  hospitalId: null,
  hospitalName: '',
  district: '',
  wardUnit: '',
  requiredBy: null,
  relationship: '',
  notes: '',
};

interface RequestDraftContextValue {
  draft: RequestDraft;
  setDraft: (draft: RequestDraft) => void;
  /** Stable id for this submission: retries and double taps reuse it server-side. */
  clientId: string;
  reset: () => void;
}

const RequestDraftContext = createContext<RequestDraftContextValue | null>(null);

/** Keeps the Create -> Review hand-off in memory so Back from Review never loses input. */
export function RequestDraftProvider({ children }: { children: ReactNode }) {
  const userId = useAuth().user?.$id ?? null;
  const [owner, setOwner] = useState(userId);
  const [draft, setDraftState] = useState<RequestDraft>(EMPTY_DRAFT);
  const [clientId, setClientId] = useState(() => requestService.newClientId());

  // A draft (patient's blood group, hospital, ward, notes) belongs to the account
  // that typed it; never hand it, or its submission id, to the next account on
  // a shared device.
  if (owner !== userId) {
    setOwner(userId);
    setDraftState(EMPTY_DRAFT);
    setClientId(requestService.newClientId());
  }

  const reset = useCallback(() => {
    setDraftState(EMPTY_DRAFT);
    setClientId(requestService.newClientId());
  }, []);

  const value = useMemo(() => ({ draft, setDraft: setDraftState, clientId, reset }), [draft, clientId, reset]);
  return <RequestDraftContext.Provider value={value}>{children}</RequestDraftContext.Provider>;
}

export function useRequestDraft(): RequestDraftContextValue {
  const ctx = useContext(RequestDraftContext);
  if (!ctx) throw new Error('useRequestDraft must be used inside the app layout.');
  return ctx;
}
