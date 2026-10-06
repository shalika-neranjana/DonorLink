import { View } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { StockBadge } from '@/components/common/StatusBadges';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { BLOOD_COMPONENT_LABELS, stockState, type BloodComponent, type BloodGroup } from '@/domain';
import { formatRelativeTime } from '@/lib/format';

export interface InventoryCardProps {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsAvailable: number;
  unitsReserved: number;
  lowStockThreshold: number;
  updatedAt?: string;
  onPress?: () => void;
}

/** Stock tile. Low and critical stock are loud (accent border + label), never colour-only. */
export function InventoryCard({ bloodGroup, component, unitsAvailable, unitsReserved, lowStockThreshold, updatedAt, onPress }: InventoryCardProps) {
  const state = stockState(unitsAvailable, unitsReserved, lowStockThreshold);
  const free = Math.max(0, unitsAvailable - unitsReserved);
  const alarming = state === 'out' || state === 'critical';
  return (
    <DonorLinkCard
      variant="elevated"
      onPress={onPress}
      className={cn('gap-3', alarming && 'border-emergency', state === 'low' && 'border-warning')}
      accessibilityLabel={`${bloodGroup} ${BLOOD_COMPONENT_LABELS[component]}: ${free} units free, ${unitsReserved} reserved. ${state === 'ok' ? 'In stock' : state + ' stock'}`}
      accessibilityHint="Edit stock"
    >
      <View className="flex-row items-center gap-3">
        <BloodGroupBadge group={bloodGroup} size="md" />
        <View className="flex-1">
          <DonorLinkText variant="bodyStrong">{BLOOD_COMPONENT_LABELS[component]}</DonorLinkText>
          {updatedAt ? (
            <DonorLinkText variant="caption" tone="muted">
              Updated {formatRelativeTime(updatedAt)}
            </DonorLinkText>
          ) : null}
        </View>
        <StockBadge state={state} size="sm" />
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 rounded-md bg-subtle p-2.5">
          <DonorLinkText variant="caption" tone="muted">
            Free units
          </DonorLinkText>
          <DonorLinkText variant="heading" tone={alarming ? 'emergency' : 'default'}>
            {free}
          </DonorLinkText>
        </View>
        <View className="flex-1 rounded-md bg-subtle p-2.5">
          <DonorLinkText variant="caption" tone="muted">
            Reserved
          </DonorLinkText>
          <DonorLinkText variant="heading">{unitsReserved}</DonorLinkText>
        </View>
        <View className="flex-1 rounded-md bg-subtle p-2.5">
          <DonorLinkText variant="caption" tone="muted">
            Alert at
          </DonorLinkText>
          <DonorLinkText variant="heading">{lowStockThreshold}</DonorLinkText>
        </View>
      </View>
    </DonorLinkCard>
  );
}
