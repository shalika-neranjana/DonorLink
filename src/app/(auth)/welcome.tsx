import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DonorLinkLogo } from '@/components/common/DonorLinkLogo';
import { MedicalDisclaimer } from '@/components/common/InfoRow';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { brand } from '@/constants/branding';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'shield-checkmark', title: 'Verified requests', body: 'Every request is checked before donors are contacted.' },
  { icon: 'people', title: 'Nearby, available donors', body: 'See who can help, how far away they are, and why they match.' },
  { icon: 'git-commit', title: 'Live tracking', body: 'Follow a request from submission to donation, step by step.' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <DonorLinkScreen
      hideOfflineBanner
      contentClassName="justify-between pt-6"
      footer={
        <>
          <DonorLinkButton title="Create account" size="lg" fullWidth onPress={() => router.push('/register')} />
          <DonorLinkButton title="I already have an account" variant="outline" size="lg" fullWidth onPress={() => router.push('/login')} />
        </>
      }
    >
      <View className="items-center gap-4 pt-4">
        <DonorLinkLogo size={96} />
        <View className="items-center gap-2">
          <DonorLinkText variant="display" align="center">
            {brand.name}
          </DonorLinkText>
          <DonorLinkText variant="body" tone="secondary" align="center">
            {brand.tagline}
          </DonorLinkText>
        </View>
      </View>

      <View className="gap-4">
        {FEATURES.map((feature, index) => (
          <Animated.View key={feature.title} entering={FadeInDown.delay(120 + index * 90).duration(280)} className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
              <DonorLinkIcon name={feature.icon} size={24} color="primary" />
            </View>
            <View className="flex-1">
              <DonorLinkText variant="bodyStrong">{feature.title}</DonorLinkText>
              <DonorLinkText variant="bodySmall" tone="secondary">
                {feature.body}
              </DonorLinkText>
            </View>
          </Animated.View>
        ))}
      </View>

      <MedicalDisclaimer compact />
    </DonorLinkScreen>
  );
}
