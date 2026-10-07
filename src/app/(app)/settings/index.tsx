import { useRouter } from 'expo-router';

import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkListGroup, DonorLinkListRow } from '@/components/ui/DonorLinkSection';

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <DonorLinkScreen header={{ title: 'Settings' }}>
      <DonorLinkListGroup>
        <DonorLinkListRow icon="person" title="Profile" subtitle="Name, phone, blood group, location" onPress={() => router.push('/settings/profile')} />
        <DonorLinkListRow icon="notifications" title="Notifications" subtitle="Choose what you hear about" onPress={() => router.push('/settings/notifications')} />
        <DonorLinkListRow icon="color-palette" title="Appearance" subtitle="System, light or dark" onPress={() => router.push('/settings/appearance')} />
        <DonorLinkListRow icon="eye-off" title="Privacy" subtitle="What others can see" onPress={() => router.push('/settings/privacy')} />
        <DonorLinkListRow icon="lock-closed" title="Security" subtitle="Password and connection" onPress={() => router.push('/settings/security')} />
        <DonorLinkListRow icon="help-buoy" title="Support & FAQ" onPress={() => router.push('/support')} last />
      </DonorLinkListGroup>
    </DonorLinkScreen>
  );
}
