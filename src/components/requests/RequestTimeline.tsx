import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeInDown, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import type { TimelineStage } from '@/domain';
import { formatDateTime } from '@/lib/format';

function PulsingDot() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.25, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(scale);
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style} className="h-7 w-7 items-center justify-center rounded-full bg-primary">
      <View className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
    </Animated.View>
  );
}

/**
 * Vertical timeline chosen in Milestone 02. The current stage is a filled,
 * pulsing marker with a highlighted card so the status is noticed immediately;
 * completed stages show a tick and timestamp; upcoming stages are muted.
 */
export function RequestTimeline({ stages }: { stages: TimelineStage[] }) {
  return (
    <View accessibilityRole="list">
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        return (
          <Animated.View
            key={stage.key}
            entering={FadeInDown.delay(index * 50).duration(220)}
            className="flex-row gap-3"
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${stage.label}. ${stage.state === 'done' ? 'Completed' : stage.state === 'current' ? 'Current stage' : 'Not yet reached'}${stage.at ? `. ${formatDateTime(stage.at)}` : ''}`}
          >
            <View className="items-center">
              {stage.state === 'done' ? (
                <View className="h-7 w-7 items-center justify-center rounded-full bg-success">
                  <DonorLinkIcon name="checkmark" size={16} color="primaryForeground" />
                </View>
              ) : stage.state === 'current' ? (
                <PulsingDot />
              ) : (
                <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-border-strong bg-surface" />
              )}
              {!last ? <View className={cn('my-1 w-0.5 flex-1', stage.state === 'done' ? 'bg-success' : 'bg-border')} /> : null}
            </View>
            <View
              className={cn(
                'mb-3 flex-1 rounded-md px-3 py-2',
                stage.state === 'current' ? 'border border-primary bg-primary-soft' : 'border border-transparent',
              )}
            >
              <View className="flex-row items-center justify-between gap-2">
                <DonorLinkText variant={stage.state === 'current' ? 'title' : 'bodyStrong'} tone={stage.state === 'upcoming' ? 'muted' : 'default'} className="flex-1">
                  {stage.label}
                </DonorLinkText>
                {stage.state === 'current' ? (
                  <DonorLinkText variant="overline" tone="primary">
                    Now
                  </DonorLinkText>
                ) : null}
              </View>
              {stage.state !== 'upcoming' ? (
                <DonorLinkText variant="bodySmall" tone="secondary">
                  {stage.state === 'done' && stage.at ? formatDateTime(stage.at) : stage.hint}
                </DonorLinkText>
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
