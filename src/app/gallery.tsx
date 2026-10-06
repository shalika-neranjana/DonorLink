import { useState } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { MedicalDisclaimer } from '@/components/common/InfoRow';
import {
  AvailabilityBadge,
  DonationStatusBadge,
  MatchQualityBadge,
  RequestStatusBadge,
  ResponseStatusBadge,
  StockBadge,
  UrgencyBadge,
  VerificationBadge,
} from '@/components/common/StatusBadges';
import { InventoryCard } from '@/components/inventory/InventoryCard';
import { DonorCard } from '@/components/matching/DonorCard';
import { MatchScoreCard } from '@/components/matching/MatchScoreCard';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { EmergencyRequestCard } from '@/components/requests/EmergencyRequestCard';
import { RequestTimeline } from '@/components/requests/RequestTimeline';
import { DonorLinkAvatar } from '@/components/ui/DonorLinkAvatar';
import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { BloodGroupPicker, DonorLinkChip, DonorLinkRadioCards, DonorLinkSegmentedControl, DonorLinkSelect, DonorLinkStepper } from '@/components/ui/DonorLinkPickers';
import { DonorLinkCardSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { REQUEST_STATUSES, buildTimeline, type BloodGroup } from '@/domain';
import type { AppNotification, BloodRequest, MatchedDonor } from '@/types/entities';

/**
 * Development-only component gallery: every shared component in its states, so
 * visual consistency (spacing, contrast, light/dark) can be reviewed in one
 * place. It contains no backend data and is unreachable in production builds.
 */
const NOW = new Date().toISOString();
const base = { $id: 'x', $createdAt: NOW, $updatedAt: NOW, $permissions: [] };

const request: BloodRequest = {
  ...base,
  requesterId: 'u1',
  requesterName: 'Ravi Perera',
  bloodGroup: 'O-',
  units: 3,
  unitsAccepted: 1,
  unitsCompleted: 0,
  contactedCount: 5,
  urgency: 'critical',
  status: 'partially_fulfilled',
  verificationStatus: 'verified',
  hospitalName: 'National Hospital of Sri Lanka',
  district: 'Colombo',
  requiredBy: new Date(Date.now() + 3 * 3600_000).toISOString(),
};

const donor: MatchedDonor = {
  donorId: 'd1',
  displayName: 'Kasun P.',
  bloodGroup: 'O-',
  exactGroup: true,
  distanceKm: 2.4,
  availability: 'available',
  availableUntil: null,
  verificationStatus: 'verified',
  recentlyDonated: false,
  donationCount: 3,
  score: 92,
  quality: 'excellent',
  reasons: ['Exact blood group (O-)', 'Available now', 'About 2.4 km away', 'Verified donor'],
  responseStatus: null,
};

const notification: AppNotification = {
  ...base,
  userId: 'u1',
  type: 'emergency_request',
  category: 'emergency',
  title: 'Critical: O- blood needed',
  body: '3 units at National Hospital of Sri Lanka · 2.4 km away.',
  route: '/',
  actionLabel: 'Review request',
  read: false,
};

export default function GalleryScreen() {
  const toast = useToast();
  const [group, setGroup] = useState<BloodGroup | null>('O+');
  const [units, setUnits] = useState(2);
  const [segment, setSegment] = useState<'a' | 'b'>('a');
  const [urgency, setUrgency] = useState<'critical' | 'urgent' | 'standard'>('critical');
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sw, setSw] = useState(true);
  const [city, setCity] = useState<string | null>(null);

  return (
    <DonorLinkScreen header={{ title: 'Design gallery', subtitle: 'Development only', onBack: false }}>
      <DonorLinkSection title="Typography">
        <DonorLinkCard className="gap-1">
          <DonorLinkText variant="display">Display 30</DonorLinkText>
          <DonorLinkText variant="heading">Heading 22</DonorLinkText>
          <DonorLinkText variant="title">Title 17</DonorLinkText>
          <DonorLinkText variant="body">Body 15. Find compatible donors quickly.</DonorLinkText>
          <DonorLinkText variant="bodySmall" tone="secondary">Body small 13, secondary</DonorLinkText>
          <DonorLinkText variant="label" tone="muted">Label 13, muted</DonorLinkText>
          <DonorLinkText variant="caption" tone="muted">Caption 12</DonorLinkText>
          <DonorLinkText variant="overline" tone="primary">Overline</DonorLinkText>
        </DonorLinkCard>
      </DonorLinkSection>

      <DonorLinkSection title="Buttons">
        <View className="gap-2">
          <DonorLinkButton title="Primary" leftIcon="checkmark" fullWidth />
          <DonorLinkButton title="Emergency request" variant="emergency" leftIcon="water" fullWidth />
          <View className="flex-row gap-2">
            <View className="flex-1"><DonorLinkButton title="Decline" variant="outline" leftIcon="close" fullWidth /></View>
            <View className="flex-[1.4]"><DonorLinkButton title="Accept" variant="success" leftIcon="checkmark" fullWidth /></View>
          </View>
          <DonorLinkButton title="Secondary" variant="secondary" fullWidth />
          <DonorLinkButton title="Danger" variant="danger" leftIcon="trash-outline" fullWidth />
          <DonorLinkButton title="Ghost" variant="ghost" fullWidth />
          <DonorLinkButton title="Loading" loading fullWidth />
          <DonorLinkButton title="Disabled" disabled fullWidth />
        </View>
      </DonorLinkSection>

      <DonorLinkSection title="Badges">
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-2">
            {(['A+', 'O-', 'AB+'] as BloodGroup[]).map((g) => <BloodGroupBadge key={g} group={g} />)}
            <BloodGroupBadge group="B+" size="sm" />
            <BloodGroupBadge group="O-" size="lg" solid />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <UrgencyBadge urgency="critical" /><UrgencyBadge urgency="urgent" /><UrgencyBadge urgency="standard" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <VerificationBadge status="verified" /><VerificationBadge status="pending" /><VerificationBadge status="needs_attention" /><VerificationBadge status="rejected" /><VerificationBadge status="not_submitted" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <AvailabilityBadge availability="available" /><AvailabilityBadge availability="unavailable" /><AvailabilityBadge availability="temporarily_unavailable" /><AvailabilityBadge availability="unknown" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {REQUEST_STATUSES.map((s) => <RequestStatusBadge key={s} status={s} size="sm" />)}
          </View>
          <View className="flex-row flex-wrap gap-2">
            <DonationStatusBadge status="scheduled" /><DonationStatusBadge status="completed" /><ResponseStatusBadge status="pending" /><ResponseStatusBadge status="accepted" /><StockBadge state="critical" /><StockBadge state="ok" /><MatchQualityBadge quality="excellent" /><MatchQualityBadge quality="fair" />
          </View>
        </View>
      </DonorLinkSection>

      <DonorLinkSection title="Cards">
        <EmergencyRequestCard request={request} showRequester onPress={() => toast.info('Card pressed')} footnote="2.4 km away" />
        <DonorCard donor={donor} onContact={() => toast.success('Donor notified')} />
        <MatchScoreCard donor={donor} />
        <InventoryCard bloodGroup="O-" component="whole_blood" unitsAvailable={4} unitsReserved={1} lowStockThreshold={6} updatedAt={NOW} />
        <InventoryCard bloodGroup="A+" component="platelets" unitsAvailable={40} unitsReserved={4} lowStockThreshold={6} updatedAt={NOW} />
        <NotificationCard notification={notification} onPress={() => undefined} />
        <NotificationCard notification={{ ...notification, read: true, category: 'donations', title: 'Donation confirmed', body: 'Thank you for helping.', actionLabel: 'View history' }} onPress={() => undefined} />
      </DonorLinkSection>

      <DonorLinkSection title="Request timeline">
        <DonorLinkCard>
          <RequestTimeline stages={buildTimeline('donors_contacted', [{ status: 'submitted', at: NOW }, { status: 'verified', at: NOW }, { status: 'donors_contacted', at: NOW }])} />
        </DonorLinkCard>
      </DonorLinkSection>

      <DonorLinkSection title="Forms">
        <DonorLinkInput label="Full name" required placeholder="e.g. Nimali Silva" helperText="As on your ID" leftIcon="person-outline" />
        <DonorLinkInput label="Email" error="Enter a valid email address." leftIcon="mail-outline" defaultValue="nope" />
        <DonorLinkInput label="Password" secureTextEntry defaultValue="secret123" leftIcon="lock-closed-outline" />
        <BloodGroupPicker required value={group} onChange={setGroup} />
        <DonorLinkStepper label="Units required" value={units} onChange={setUnits} unit="unit" />
        <DonorLinkSegmentedControl value={segment} onChange={setSegment} options={[{ value: 'a', label: 'Active' }, { value: 'b', label: 'Past', badge: 3 }]} />
        <DonorLinkRadioCards label="Urgency" value={urgency} onChange={setUrgency} options={[
          { value: 'critical', title: 'Critical', description: 'Within hours', icon: 'alert-circle', tone: 'emergency' },
          { value: 'urgent', title: 'Urgent', description: 'Within a day', icon: 'time', tone: 'warning' },
          { value: 'standard', title: 'Standard', description: 'A few days', icon: 'calendar-outline' },
        ]} />
        <DonorLinkSelect label="District" value={city} onChange={setCity} options={['Colombo', 'Kandy', 'Galle'].map((c) => ({ value: c, label: c }))} placeholder="Choose" />
        <View className="flex-row flex-wrap gap-2">
          <DonorLinkChip label="Selected" selected onPress={() => undefined} /><DonorLinkChip label="Idle" onPress={() => undefined} />
        </View>
        <DonorLinkCard><DonorLinkSwitchRow title="Emergency alerts" description="Be notified about matching requests" value={sw} onValueChange={setSw} accessibilityLabel="Emergency alerts" /></DonorLinkCard>
        <DonorLinkAvatar name="Kasun Perera" size="lg" />
      </DonorLinkSection>

      <DonorLinkSection title="Feedback & states">
        <DonorLinkBanner tone="info" title="Info" message="A neutral hint that stays in the flow." />
        <DonorLinkBanner tone="success" message="Saved successfully." />
        <DonorLinkBanner tone="warning" title="Heads up" message="Something needs attention." actionLabel="Fix it" onAction={() => undefined} />
        <DonorLinkBanner tone="error" title="Couldn't save" message="Check your connection and try again." />
        <DonorLinkBanner tone="emergency" title="Critical request" message="Blood is needed within hours." />
        <DonorLinkEmptyState compact icon="water-outline" title="No active blood requests" description="Create a request to get started." actionLabel="Request blood" onAction={() => undefined} />
        <DonorLinkErrorState compact message="We couldn't load this. Check your connection." onRetry={() => undefined} />
        <DonorLinkCardSkeleton />
        <View className="flex-row flex-wrap gap-2">
          <DonorLinkButton title="Success toast" size="sm" onPress={() => toast.success('Request submitted', "We're verifying it now.")} />
          <DonorLinkButton title="Error toast" size="sm" variant="outline" onPress={() => toast.error('Something failed', 'Please try again.')} />
          <DonorLinkButton title="Bottom sheet" size="sm" variant="outline" onPress={() => setSheet(true)} />
          <DonorLinkButton title="Dialog" size="sm" variant="outline" onPress={() => setDialog(true)} />
        </View>
      </DonorLinkSection>

      <MedicalDisclaimer />

      <DonorLinkBottomSheet visible={sheet} onClose={() => setSheet(false)} title="Bottom sheet" footer={<DonorLinkButton title="Done" onPress={() => setSheet(false)} />}>
        <DonorLinkText variant="body">Sheets keep context behind them and close with the handle, the backdrop or the back button.</DonorLinkText>
      </DonorLinkBottomSheet>
      <DonorLinkConfirmDialog visible={dialog} title="Cancel this request?" message="Donors who accepted will be told." confirmLabel="Yes, cancel" tone="danger" onCancel={() => setDialog(false)} onConfirm={() => setDialog(false)} />
    </DonorLinkScreen>
  );
}
