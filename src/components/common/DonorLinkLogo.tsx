import { Image } from 'expo-image';
import { View } from 'react-native';

import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { brand } from '@/constants/branding';

export function DonorLinkLogo({ size = 72, withWordmark }: { size?: number; withWordmark?: boolean }) {
  return (
    <View className="items-center gap-2" accessible accessibilityRole="image" accessibilityLabel={`${brand.name} logo`}>
      <Image source={brand.logo} style={{ width: size, height: size, borderRadius: size * 0.22 }} contentFit="contain" />
      {withWordmark ? (
        <DonorLinkText variant="heading" tone="default">
          {brand.name}
        </DonorLinkText>
      ) : null}
    </View>
  );
}
