import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { AvailabilityHero } from '@/components/donors/AvailabilityHero';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { EmergencyRequestCard } from '@/components/requests/EmergencyRequestCard';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { DonationStatusBadge } from '@/components/common/StatusBadges';
import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { formatDistance } from '@/domain';
import { useHomeData } from '@/hooks/useHomeData';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/NotificationsProvider';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_ACTIONS: { icon: IconName; label: string; href: Href }[] = [
  { icon: 'list', label: 'My requests', href: '/requests' },
  { icon: 'time', label: 'History', href: '/history' },
  { icon: 'medkit', label: 'Hospitals', href: '/hospitals' },
  { icon: 'help-buoy', label: 'Support', href: '/support' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, donorProfile, isAdmin, isOrganizationMember } = useAuth();
  const { open } = useNotifications();
  const { data, error, loading, refreshing, reload } = useHomeData();
  const firstName = (profile?.displayName ?? user?.name ?? '').split(' ')[0];
  const isDonor = !!profile?.isDonor;

  return (
    <DonorLinkScreen
      inTabs
      refreshing={refreshing}
      onRefresh={() => void reload()}
      header={{ title: `${greeting()}${firstName ? `, ${firstName}` : ''}`, subtitle: profile?.district ? `${profile.city ? `${profile.city}, ` : ''}${profile.district}` : undefined, onBack: false, size: 'large' }}
    >
      {/* Emergency action: always first, always the same place. */}
      <DonorLinkCard variant="emergency" className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-emergency">
            <DonorLinkIcon name="water" size={22} color="emergencyForeground" />
          </View>
          <View className="flex-1">
            <DonorLinkText variant="title">Need blood urgently?</DonorLinkText>
            <DonorLinkText variant="bodySmall" tone="secondary">
              Create a request in under a minute. We verify it and contact compatible donors nearby.
            </DonorLinkText>
          </View>
        </View>
        <DonorLinkButton title="Request blood" variant="emergency" size="lg" leftIcon="add-circle" fullWidth onPress={() => router.push('/requests/create')} />
      </DonorLinkCard>

      {/* Donor availability is high on the page by design (Milestone 02). */}
      {isDonor ? (
        <AvailabilityHero donor={donorProfile} onOpenSettings={() => router.push('/donor/availability')} />
      ) : (
        <DonorLinkCard variant="primary" className="gap-2">
          <DonorLinkText variant="title">Want to help others?</DonorLinkText>
          <DonorLinkText variant="bodySmall" tone="secondary">
            {profile?.bloodGroup
              ? 'Become a donor and choose when you are available. You are always in control.'
              : 'Add your blood group to your profile to become a donor.'}
          </DonorLinkText>
          <DonorLinkButton
            title={profile?.bloodGroup ? 'Set up donor availability' : 'Add blood group'}
            variant="outline"
            onPress={() => router.push(profile?.bloodGroup ? '/donor/availability' : '/settings/profile')}
          />
        </DonorLinkCard>
      )}

      {loading ? (
        <DonorLinkListSkeleton count={2} />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} compact />
      ) : data ? (
        <>
          {data.invitations.length > 0 ? (
            <DonorLinkSection title="Asking for your help" description="Verified requests that match you">
              {data.invitations.map(({ request, response }) => (
                <EmergencyRequestCard
                  key={response.$id}
                  request={request}
                  footnote={response.distanceKm != null ? `${formatDistance(response.distanceKm)} away` : undefined}
                  onPress={() => router.push(`/donor/incoming/${request.$id}` as Href)}
                />
              ))}
            </DonorLinkSection>
          ) : null}

          {data.activeDonations.length > 0 ? (
            <DonorLinkSection title="Your donation">
              {data.activeDonations.map((donation) => (
                <DonorLinkCard key={donation.$id} variant="elevated" onPress={() => router.push(`/donor/donation/${donation.requestId}` as Href)} accessibilityLabel={`Donation at ${donation.hospitalName}`} className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <BloodGroupBadge group={donation.bloodGroup} />
                    <View className="flex-1">
                      <DonorLinkText variant="bodyStrong" numberOfLines={1}>
                        {donation.hospitalName}
                      </DonorLinkText>
                      <DonorLinkText variant="bodySmall" tone="secondary">
                        Tap to see coordination details
                      </DonorLinkText>
                    </View>
                    <DonationStatusBadge status={donation.status} size="sm" />
                  </View>
                </DonorLinkCard>
              ))}
            </DonorLinkSection>
          ) : null}

          <DonorLinkSection title="Your active requests" actionLabel={data.myRequests.length ? 'See all' : undefined} onAction={() => router.push('/requests')}>
            {data.myRequests.length === 0 ? (
              <DonorLinkCard variant="tinted" className="items-center gap-1 py-6">
                <DonorLinkText variant="bodyStrong">No active blood requests</DonorLinkText>
                <DonorLinkText variant="bodySmall" tone="secondary" align="center">
                  When you request blood, you can follow every step here.
                </DonorLinkText>
              </DonorLinkCard>
            ) : (
              data.myRequests.slice(0, 3).map((request) => (
                <EmergencyRequestCard key={request.$id} request={request} onPress={() => router.push(`/requests/${request.$id}` as Href)} />
              ))
            )}
          </DonorLinkSection>

          <DonorLinkSection title="Quick actions">
            <View className="flex-row flex-wrap gap-3">
              {QUICK_ACTIONS.map((action) => (
                <DonorLinkCard key={action.label} onPress={() => router.push(action.href)} accessibilityLabel={action.label} className="w-[47.5%] items-center gap-2 py-4">
                  <DonorLinkIcon name={action.icon} size={24} color="primary" />
                  <DonorLinkText variant="bodyStrong">{action.label}</DonorLinkText>
                </DonorLinkCard>
              ))}
            </View>
          </DonorLinkSection>

          {data.recentNotifications.length > 0 ? (
            <DonorLinkSection title="Recent activity" actionLabel="See all" onAction={() => router.push('/notifications')}>
              {data.recentNotifications.map((n) => (
                <NotificationCard key={n.$id} notification={n} onPress={() => void open(n)} />
              ))}
            </DonorLinkSection>
          ) : null}
        </>
      ) : null}

      {isOrganizationMember || isAdmin ? (
        <DonorLinkSection title="Workspaces">
          {isOrganizationMember ? (
            <DonorLinkButton title="Open organization workspace" variant="outline" leftIcon="business" fullWidth onPress={() => router.push('/org/dashboard')} />
          ) : null}
          {isAdmin ? <DonorLinkButton title="Open admin console" variant="outline" leftIcon="shield" fullWidth onPress={() => router.push('/admin/dashboard')} /> : null}
        </DonorLinkSection>
      ) : null}
    </DonorLinkScreen>
  );
}
