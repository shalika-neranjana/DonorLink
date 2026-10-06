import { Image } from 'expo-image';
import { View } from 'react-native';

import { DonorLinkText } from './DonorLinkText';

const SIZES = { sm: 32, md: 44, lg: 64, xl: 88 } as const;
const TEXT_SIZE = { sm: 'text-[12px]', md: 'text-[16px]', lg: 'text-[22px]', xl: 'text-[30px]' } as const;

export interface DonorLinkAvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: keyof typeof SIZES;
}

function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Photo when available, otherwise initials. Never exposes a public image URL. */
export function DonorLinkAvatar({ name, uri, size = 'md' }: DonorLinkAvatarProps) {
  const dimension = SIZES[size];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ? `${name}, profile picture` : 'Profile picture'}
      style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
      className="items-center justify-center overflow-hidden bg-primary-soft"
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: dimension, height: dimension }} contentFit="cover" />
      ) : (
        <DonorLinkText variant="bodyStrong" tone="primary" className={TEXT_SIZE[size]}>
          {initials(name)}
        </DonorLinkText>
      )}
    </View>
  );
}
