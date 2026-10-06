import { useState } from 'react';
import { View } from 'react-native';

import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { BLOOD_GROUPS, URGENCY_LABELS, URGENCY_LEVELS, REQUEST_STATUS_LABELS, REQUEST_STATUSES, type BloodGroup, type RequestStatus, type Urgency } from '@/domain';
import type { BloodRequest } from '@/types/entities';

export interface RequestFilters {
  urgency: Urgency | null;
  bloodGroup: BloodGroup | null;
  status: RequestStatus | null;
  /** Created within the last N days. */
  days: number | null;
}

export const EMPTY_REQUEST_FILTERS: RequestFilters = { urgency: null, bloodGroup: null, status: null, days: null };

export const countActiveFilters = (f: RequestFilters) => Object.values(f).filter((v) => v !== null).length;

export function applyRequestFilters(requests: BloodRequest[], f: RequestFilters): BloodRequest[] {
  const cutoff = f.days ? Date.now() - f.days * 864e5 : null;
  return requests.filter(
    (r) =>
      (!f.urgency || r.urgency === f.urgency) &&
      (!f.bloodGroup || r.bloodGroup === f.bloodGroup) &&
      (!f.status || r.status === f.status) &&
      (cutoff === null || new Date(r.$createdAt).getTime() >= cutoff),
  );
}

const STATUS_OPTIONS = REQUEST_STATUSES.filter((s) => s !== 'draft');

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <DonorLinkText variant="label" tone="secondary">
        {title}
      </DonorLinkText>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

/** Request filters: urgency, status, blood group and date (Milestone brief §33). */
export function RequestFilterSheet({ visible, onClose, value, onApply }: { visible: boolean; onClose: () => void; value: RequestFilters; onApply: (f: RequestFilters) => void }) {
  const [draft, setDraft] = useState(value);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }
  const toggle = <K extends keyof RequestFilters>(key: K, next: RequestFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: d[key] === next ? null : next }));

  return (
    <DonorLinkBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter requests"
      footer={
        <>
          <DonorLinkButton
            title="Show results"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
          <DonorLinkButton title="Reset" variant="ghost" onPress={() => setDraft(EMPTY_REQUEST_FILTERS)} />
        </>
      }
    >
      <Group title="Urgency">
        {URGENCY_LEVELS.map((u) => (
          <DonorLinkChip key={u} label={URGENCY_LABELS[u]} selected={draft.urgency === u} onPress={() => toggle('urgency', u)} />
        ))}
      </Group>
      <Group title="Blood group">
        {BLOOD_GROUPS.map((g) => (
          <DonorLinkChip key={g} label={g} selected={draft.bloodGroup === g} onPress={() => toggle('bloodGroup', g)} />
        ))}
      </Group>
      <Group title="Status">
        {STATUS_OPTIONS.map((s) => (
          <DonorLinkChip key={s} label={REQUEST_STATUS_LABELS[s]} selected={draft.status === s} onPress={() => toggle('status', s)} />
        ))}
      </Group>
      <Group title="Created">
        {[
          { label: 'Last 24 hours', days: 1 },
          { label: 'Last 7 days', days: 7 },
          { label: 'Last 30 days', days: 30 },
        ].map((o) => (
          <DonorLinkChip key={o.days} label={o.label} selected={draft.days === o.days} onPress={() => toggle('days', o.days)} />
        ))}
      </Group>
    </DonorLinkBottomSheet>
  );
}
