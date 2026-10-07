import { Platform } from 'react-native';

import { DonorLinkRadioCards, type RadioCardOption } from '@/components/ui/DonorLinkPickers';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useThemePreference, type ThemePreference } from '@/theme/ThemePreferenceProvider';

const OPTIONS: RadioCardOption<ThemePreference>[] = [
  { value: 'system', title: 'System', description: "Match your device's light or dark setting.", icon: 'phone-portrait-outline' },
  { value: 'light', title: 'Light', description: 'Always use the light theme.', icon: 'sunny-outline' },
  { value: 'dark', title: 'Dark', description: 'Always use the dark theme.', icon: 'moon-outline' },
];

export default function AppearanceScreen() {
  const { preference, setPreference } = useThemePreference();
  return (
    <DonorLinkScreen header={{ title: 'Appearance', subtitle: 'Choose how DonorLink looks' }}>
      <DonorLinkRadioCards<ThemePreference> label="Theme" options={OPTIONS} value={preference} onChange={setPreference} />
      {Platform.OS === 'web' ? (
        <DonorLinkBanner tone="info" message="In a browser DonorLink always follows your browser's light or dark setting. Your choice applies on your phone." />
      ) : null}
    </DonorLinkScreen>
  );
}
