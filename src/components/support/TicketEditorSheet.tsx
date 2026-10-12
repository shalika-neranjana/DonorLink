import { useState } from 'react';
import { View } from 'react-native';

import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { SUPPORT_CATEGORIES, validateSupportTicket, type SupportCategory, type SupportTicketInput } from '@/domain';
import { getErrorMessage } from '@/lib/appwrite/errors';
import type { SupportTicket } from '@/types/entities';

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = { account: 'Account', request: 'A request', donation: 'A donation', verification: 'Verification', other: 'Something else' };

interface TicketEditorSheetProps {
  ticket: SupportTicket | null;
  onClose: () => void;
  onSave: (ticketId: string, input: SupportTicketInput) => Promise<void>;
}

/** Edit a ticket that support has not picked up yet. */
export function TicketEditorSheet({ ticket, onClose, onSave }: TicketEditorSheetProps) {
  const [category, setCategory] = useState<SupportCategory>('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-seed the form whenever a different ticket is opened (state adjusted during render, not in an effect).
  const [seededFor, setSeededFor] = useState<SupportTicket | null>(null);
  if (ticket && ticket !== seededFor) {
    setSeededFor(ticket);
    setCategory(ticket.category);
    setSubject(ticket.subject);
    setMessage(ticket.message);
    setErrors({});
    setFormError(null);
  }

  async function save() {
    if (!ticket || saving) return;
    setFormError(null);
    const result = validateSupportTicket({ category, subject, message });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(ticket.$id, result.value);
    } catch (e) {
      setFormError(getErrorMessage(e, "We couldn't save your changes."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DonorLinkBottomSheet visible={!!ticket} onClose={onClose} title="Edit message" footer={<DonorLinkButton title="Save changes" loading={saving} onPress={() => void save()} />}>
      {formError ? <DonorLinkBanner tone="error" message={formError} /> : null}
      <View className="gap-2">
        <DonorLinkText variant="label" tone="secondary">
          What is it about?
        </DonorLinkText>
        <View className="flex-row flex-wrap gap-2">
          {SUPPORT_CATEGORIES.map((c) => (
            <DonorLinkChip key={c} label={SUPPORT_CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>
      <DonorLinkInput label="Subject" value={subject} onChangeText={setSubject} error={errors.subject} maxLength={100} />
      <DonorLinkInput label="Message" value={message} onChangeText={setMessage} error={errors.message} multiline maxLength={1000} />
    </DonorLinkBottomSheet>
  );
}
