import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { SUPPORT_CATEGORIES, validateSupportTicket, type SupportCategory } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatRelativeTime } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { FAQ, supportService } from '@/services/supportService';

const CATEGORY_LABEL: Record<SupportCategory, string> = { account: 'Account', request: 'A request', donation: 'A donation', verification: 'Verification', other: 'Something else' };

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Animated.View layout={LinearTransition.duration(180)}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={question} className="min-h-[52px] flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-subtle">
        <DonorLinkText variant="bodyStrong" className="flex-1">
          {question}
        </DonorLinkText>
        <DonorLinkIcon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="fgMuted" />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(150)} className="border-b border-border bg-subtle px-4 py-3">
          <DonorLinkText variant="body" tone="secondary">
            {answer}
          </DonorLinkText>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Lightweight support: FAQ, a contact form and the status of your tickets. */
export default function SupportScreen() {
  const toast = useToast();
  const { user } = useAuth();
  const tickets = useResource(() => supportService.listMine(user!.$id), [user?.$id], { enabled: !!user, reloadOnFocus: true });
  const [category, setCategory] = useState<SupportCategory>('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if (sending) return;
    setFormError(null);
    const result = validateSupportTicket({ category, subject, message });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      await supportService.createTicket(result.value);
      setSubject('');
      setMessage('');
      toast.success('Message sent', "We'll reply in the app.");
      await tickets.reload();
    } catch (e) {
      setFormError(getErrorMessage(e, "We couldn't send your message."));
    } finally {
      setSending(false);
    }
  }

  return (
    <DonorLinkScreen header={{ title: 'Support & FAQ' }}>
      <DonorLinkSection title="Frequently asked">
        <DonorLinkCard padded={false} className="overflow-hidden">
          {FAQ.map((item) => (
            <FaqItem key={item.question} {...item} />
          ))}
        </DonorLinkCard>
      </DonorLinkSection>

      <DonorLinkSection title="Contact support" description="For emergencies, contact the hospital directly. DonorLink support cannot give medical advice.">
        <DonorLinkCard className="gap-4">
          {formError ? <DonorLinkBanner tone="error" message={formError} /> : null}
          <View className="gap-2">
            <DonorLinkText variant="label" tone="secondary">
              What is it about?
            </DonorLinkText>
            <View className="flex-row flex-wrap gap-2">
              {SUPPORT_CATEGORIES.map((c) => (
                <DonorLinkChip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
          </View>
          <DonorLinkInput label="Subject" value={subject} onChangeText={setSubject} error={errors.subject} maxLength={100} />
          <DonorLinkInput label="Message" value={message} onChangeText={setMessage} error={errors.message} multiline maxLength={1000} />
          <DonorLinkButton title="Send message" leftIcon="send" loading={sending} onPress={() => void send()} />
        </DonorLinkCard>
      </DonorLinkSection>

      {(tickets.data ?? []).length > 0 ? (
        <DonorLinkSection title="Your messages">
          {tickets.data!.map((t) => (
            <DonorLinkCard key={t.$id} className="gap-2">
              <View className="flex-row items-center justify-between gap-2">
                <DonorLinkText variant="bodyStrong" className="flex-1" numberOfLines={1}>
                  {t.subject}
                </DonorLinkText>
                <DonorLinkBadge label={t.status === 'open' ? 'Open' : t.status === 'in_progress' ? 'In progress' : 'Answered'} tone={t.status === 'resolved' ? 'success' : 'warning'} size="sm" icon={t.status === 'resolved' ? 'checkmark-circle' : 'hourglass-outline'} />
              </View>
              <DonorLinkText variant="caption" tone="muted">
                {formatRelativeTime(t.$createdAt)}
              </DonorLinkText>
              {t.reply ? (
                <View className="rounded-md bg-primary-soft p-3">
                  <DonorLinkText variant="label" tone="primary">
                    DonorLink support
                  </DonorLinkText>
                  <DonorLinkText variant="body">{t.reply}</DonorLinkText>
                </View>
              ) : null}
            </DonorLinkCard>
          ))}
        </DonorLinkSection>
      ) : null}
    </DonorLinkScreen>
  );
}
