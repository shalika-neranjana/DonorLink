import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { DonorLinkCard } from './DonorLinkCard';

export interface DonorLinkSkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  className?: string;
}

/** Placeholder block with a gentle pulse; used instead of blank screens while loading. */
export function DonorLinkSkeleton({ width = '100%', height = 16, radius = 6, className }: DonorLinkSkeletonProps) {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius }, style]}
      className={className ? `bg-border ${className}` : 'bg-border'}
    />
  );
}

/** Skeleton shaped like a typical list card. */
export function DonorLinkCardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <DonorLinkCard accessibilityLabel="Loading">
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <DonorLinkSkeleton width={44} height={44} radius={22} />
          <View className="flex-1 gap-2">
            <DonorLinkSkeleton width="55%" height={14} />
            <DonorLinkSkeleton width="35%" height={12} />
          </View>
        </View>
        {Array.from({ length: lines }).map((_, i) => (
          <DonorLinkSkeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
        ))}
      </View>
    </DonorLinkCard>
  );
}

export function DonorLinkListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3" accessibilityLabel="Loading content" accessibilityLiveRegion="polite">
      {Array.from({ length: count }).map((_, i) => (
        <DonorLinkCardSkeleton key={i} />
      ))}
    </View>
  );
}
