import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { DonorLinkText } from '@/components/ui/DonorLinkText';

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Minimal vertical bar chart (no chart library). Values are printed on the bars
 * and summarised in the accessibility label, so no information is colour-only.
 */
export function BarSeries({ data, height = 120, summary }: { data: BarDatum[]; height?: number; summary: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} className="flex-row items-end gap-2" style={{ height: height + 40 }}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} className="flex-1 items-center justify-end gap-1">
          <DonorLinkText variant="caption" tone="secondary">
            {d.value}
          </DonorLinkText>
          <Animated.View
            entering={FadeInUp.delay(i * 40).duration(240)}
            className={cn('w-full rounded-t-sm', d.value === 0 ? 'bg-border' : 'bg-primary')}
            style={{ height: Math.max(4, Math.round((d.value / max) * height)) }}
          />
          <DonorLinkText variant="caption" tone="muted">
            {d.label}
          </DonorLinkText>
        </View>
      ))}
    </View>
  );
}

export interface HBarDatum {
  label: string;
  value: number;
  tone?: 'primary' | 'success' | 'warning' | 'emergency' | 'neutral';
}

const BAR_TONE: Record<NonNullable<HBarDatum['tone']>, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  emergency: 'bg-emergency',
  neutral: 'bg-border-strong',
};

/** Labelled horizontal bars, sorted by the caller. */
export function HorizontalBars({ rows }: { rows: HBarDatum[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row.label} accessible accessibilityLabel={`${row.label}: ${row.value}`} className="gap-1">
          <View className="flex-row justify-between">
            <DonorLinkText variant="bodySmall" tone="secondary">
              {row.label}
            </DonorLinkText>
            <DonorLinkText variant="bodyStrong">{row.value}</DonorLinkText>
          </View>
          <View className="h-2.5 overflow-hidden rounded-full bg-subtle">
            <View className={cn('h-full rounded-full', BAR_TONE[row.tone ?? 'primary'])} style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}
