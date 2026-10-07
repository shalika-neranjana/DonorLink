import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { BLOOD_GROUPS, type BloodGroup } from '@/domain';
import { DonorLinkBottomSheet } from './DonorLinkBottomSheet';
import { DonorLinkButton } from './DonorLinkButton';
import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkInput } from './DonorLinkInput';
import { DonorLinkText } from './DonorLinkText';

// --- Field label wrapper -------------------------------------------------------

function FieldShell({ label, required, error, helperText, children }: { label: string; required?: boolean; error?: string; helperText?: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row">
        <DonorLinkText variant="label" tone="secondary">
          {label}
        </DonorLinkText>
        {required ? (
          <DonorLinkText variant="label" tone="emergency" accessibilityElementsHidden>
            {' *'}
          </DonorLinkText>
        ) : null}
      </View>
      {children}
      {error ? (
        <View className="flex-row items-center gap-1" accessibilityLiveRegion="polite">
          <DonorLinkIcon name="alert-circle" size={14} color="error" />
          <DonorLinkText variant="bodySmall" tone="error" className="flex-1">
            {error}
          </DonorLinkText>
        </View>
      ) : helperText ? (
        <DonorLinkText variant="caption" tone="muted">
          {helperText}
        </DonorLinkText>
      ) : null}
    </View>
  );
}

// --- Blood group ----------------------------------------------------------------

export interface BloodGroupPickerProps {
  value: BloodGroup | null | undefined;
  onChange: (value: BloodGroup) => void;
  label?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

/** 4x2 grid so all eight groups are visible at once, with large targets. */
export function BloodGroupPicker({ value, onChange, label = 'Blood group', error, required, helperText }: BloodGroupPickerProps) {
  return (
    <FieldShell label={label} required={required} error={error} helperText={helperText}>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
        {BLOOD_GROUPS.map((group) => {
          const selected = value === group;
          return (
            <Pressable
              key={group}
              onPress={() => onChange(group)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Blood group ${group.replace('+', ' positive').replace('-', ' negative')}`}
              className={cn(
                'h-[52px] w-[23%] items-center justify-center rounded-md border',
                selected ? 'border-emergency bg-emergency' : 'border-border-strong bg-surface active:bg-subtle',
              )}
            >
              <DonorLinkText variant="title" tone={selected ? 'inverse' : 'default'} className={selected ? 'text-emergency-foreground' : undefined}>
                {group}
              </DonorLinkText>
            </Pressable>
          );
        })}
      </View>
    </FieldShell>
  );
}

// --- Segmented control -----------------------------------------------------------

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

export function DonorLinkSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scrollable,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
}) {
  const items = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        onPress={() => onChange(option.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={option.badge ? `${option.label}, ${option.badge} new` : option.label}
        className={cn(
          'min-h-[40px] flex-row items-center justify-center gap-1.5 rounded-md px-3',
          scrollable ? '' : 'flex-1',
          selected ? 'bg-surface shadow-sm' : 'active:bg-surface/50',
        )}
      >
        <DonorLinkText variant="label" tone={selected ? 'default' : 'secondary'} className={selected ? 'font-inter-semibold' : undefined}>
          {option.label}
        </DonorLinkText>
        {option.badge ? (
          <View className="min-w-[18px] items-center rounded-full bg-emergency px-1">
            <DonorLinkText variant="caption" tone="inverse" className="text-[10px] leading-[16px]">
              {option.badge > 9 ? '9+' : option.badge}
            </DonorLinkText>
          </View>
        ) : null}
      </Pressable>
    );
  });
  if (scrollable) {
    return (
      // React Native gives every ScrollView `flexGrow: 1`. Inside a screen's
      // vertical content container (which also grows), a horizontal ScrollView
      // therefore claimed all the leftover height and pushed the empty state
      // away. `flexGrow: 0` keeps it as tall as its row of tabs.
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
        <View className="flex-row gap-1 rounded-lg bg-subtle p-1">{items}</View>
      </ScrollView>
    );
  }
  return (
    <View className="flex-row gap-1 rounded-lg bg-subtle p-1" accessibilityRole="tablist">
      {items}
    </View>
  );
}

// --- Chips --------------------------------------------------------------------------

export function DonorLinkChip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      className={cn(
        'min-h-[40px] flex-row items-center gap-1.5 rounded-full border px-3.5',
        selected ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface active:bg-subtle',
      )}
    >
      {selected ? <DonorLinkIcon name="checkmark" size={16} color="primary" /> : icon ? <DonorLinkIcon name={icon} size={16} color="fgSecondary" /> : null}
      <DonorLinkText variant="label" tone={selected ? 'primary' : 'default'}>
        {label}
      </DonorLinkText>
    </Pressable>
  );
}

// --- Stepper --------------------------------------------------------------------------

export function DonorLinkStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 20,
  unit,
  error,
  required,
  helperText,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}) {
  return (
    <FieldShell label={label} required={required} error={error} helperText={helperText}>
      <View className="flex-row items-center gap-3" accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          className={cn('h-12 w-12 items-center justify-center rounded-md border border-border-strong bg-surface active:bg-subtle', value <= min && 'opacity-40')}
        >
          <DonorLinkIcon name="remove" size={22} />
        </Pressable>
        <View className="min-w-[72px] items-center">
          <DonorLinkText variant="heading">{value}</DonorLinkText>
          {unit ? (
            <DonorLinkText variant="caption" tone="muted">
              {value === 1 ? unit : `${unit}s`}
            </DonorLinkText>
          ) : null}
        </View>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          className={cn('h-12 w-12 items-center justify-center rounded-md border border-border-strong bg-surface active:bg-subtle', value >= max && 'opacity-40')}
        >
          <DonorLinkIcon name="add" size={22} />
        </Pressable>
      </View>
    </FieldShell>
  );
}

// --- Select (bottom sheet list) ---------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export function DonorLinkSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchable,
  error,
  required,
  helperText,
  sheetTitle,
  emptyText = 'Nothing matches your search.',
}: {
  label: string;
  value: string | null | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  error?: string;
  required?: boolean;
  helperText?: string;
  sheetTitle?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <FieldShell label={label} required={required} error={error} helperText={helperText}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : 'not selected'}`}
        accessibilityHint="Opens a list to choose from"
        className={cn(
          'min-h-[48px] flex-row items-center gap-2 rounded-md border bg-surface px-3 active:bg-subtle',
          error ? 'border-error' : 'border-border-strong',
        )}
      >
        <DonorLinkText variant="body" tone={selected ? 'default' : 'muted'} className="flex-1" numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </DonorLinkText>
        <DonorLinkIcon name="chevron-down" size={18} color="fgMuted" />
      </Pressable>
      <DonorLinkBottomSheet
        visible={open}
        onClose={() => {
          setOpen(false);
          setQuery('');
        }}
        title={sheetTitle ?? label}
      >
        {searchable ? <DonorLinkInput label="Search" value={query} onChangeText={setQuery} leftIcon="search" placeholder="Type to filter" autoCorrect={false} /> : null}
        {filtered.length === 0 ? (
          <DonorLinkText variant="body" tone="secondary" align="center" className="py-6">
            {emptyText}
          </DonorLinkText>
        ) : (
          <View className="overflow-hidden rounded-lg border border-border">
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={cn('min-h-[52px] flex-row items-center gap-3 px-4 py-2.5 active:bg-subtle', index > 0 && 'border-t border-border', isSelected && 'bg-primary-soft')}
                >
                  <View className="flex-1">
                    <DonorLinkText variant="bodyStrong">{option.label}</DonorLinkText>
                    {option.description ? (
                      <DonorLinkText variant="bodySmall" tone="secondary">
                        {option.description}
                      </DonorLinkText>
                    ) : null}
                  </View>
                  {isSelected ? <DonorLinkIcon name="checkmark-circle" size={20} color="primary" /> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </DonorLinkBottomSheet>
    </FieldShell>
  );
}

// --- Radio cards (e.g. urgency) ------------------------------------------------------------

export interface RadioCardOption<T extends string> {
  value: T;
  title: string;
  description: string;
  icon: IconName;
  /** Selected-state accent. */
  tone?: 'primary' | 'emergency' | 'warning';
}

export function DonorLinkRadioCards<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  required,
}: {
  label: string;
  options: RadioCardOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <FieldShell label={label} required={required} error={error}>
      <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          const tone = option.tone ?? 'primary';
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.title}. ${option.description}`}
              className={cn(
                'min-h-[60px] flex-row items-center gap-3 rounded-md border p-3',
                selected
                  ? tone === 'emergency'
                    ? 'border-emergency bg-emergency-soft'
                    : tone === 'warning'
                      ? 'border-warning bg-warning-soft'
                      : 'border-primary bg-primary-soft'
                  : 'border-border-strong bg-surface active:bg-subtle',
              )}
            >
              <DonorLinkIcon name={option.icon} size={22} color={selected ? (tone === 'primary' ? 'primary' : tone) : 'fgMuted'} />
              <View className="flex-1">
                <DonorLinkText variant="bodyStrong">{option.title}</DonorLinkText>
                <DonorLinkText variant="bodySmall" tone="secondary">
                  {option.description}
                </DonorLinkText>
              </View>
              <DonorLinkIcon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? (tone === 'primary' ? 'primary' : tone) : 'fgMuted'} />
            </Pressable>
          );
        })}
      </View>
    </FieldShell>
  );
}

// --- Date & time ------------------------------------------------------------------------------

export interface QuickTimeOption {
  label: string;
  hoursFromNow: number;
}

export function DonorLinkDateTimeField({
  label,
  value,
  onChange,
  quickOptions,
  clearable = true,
  helperText,
  error,
  minimumDate,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  quickOptions: QuickTimeOption[];
  clearable?: boolean;
  helperText?: string;
  error?: string;
  minimumDate?: Date;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => (value ? new Date(value) : new Date(Date.now() + 3600_000)));
  const [pickerMin, setPickerMin] = useState<Date | undefined>(minimumDate);
  const display = value
    ? new Date(value).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  const openPicker = () => {
    const start = value ? new Date(value) : new Date(Date.now() + 3600_000);
    const min = minimumDate ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: start,
        mode: 'date',
        minimumDate: min,
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (timeEvent, time) => {
              if (timeEvent.type !== 'set' || !time) return;
              const merged = new Date(date);
              merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(merged.toISOString());
            },
          });
        },
      });
    } else if (Platform.OS === 'ios') {
      setDraft(start);
      setPickerMin(min);
      setIosOpen(true);
    }
  };

  return (
    <FieldShell label={label} error={error} helperText={helperText}>
      <View className="flex-row flex-wrap gap-2">
        {quickOptions.map((option) => (
          <DonorLinkChip
            key={option.label}
            label={option.label}
            selected={false}
            icon="time-outline"
            onPress={() => onChange(new Date(Date.now() + option.hoursFromNow * 3600_000).toISOString())}
          />
        ))}
        {Platform.OS !== 'web' ? <DonorLinkChip label="Pick date & time" icon="calendar-outline" onPress={openPicker} /> : null}
      </View>
      {display ? (
        <View className="min-h-[44px] flex-row items-center gap-2 rounded-md bg-primary-soft px-3">
          <DonorLinkIcon name="time" size={18} color="primary" />
          <DonorLinkText variant="bodyStrong" tone="primary" className="flex-1">
            {display}
          </DonorLinkText>
          {clearable ? <DonorLinkButton title="Clear" variant="ghost" size="sm" onPress={() => onChange(null)} /> : null}
        </View>
      ) : null}
      <DonorLinkBottomSheet
        visible={iosOpen}
        onClose={() => setIosOpen(false)}
        title={label}
        footer={
          <DonorLinkButton
            title="Done"
            onPress={() => {
              onChange(draft.toISOString());
              setIosOpen(false);
            }}
          />
        }
      >
        <DateTimePicker value={draft} mode="datetime" display="spinner" minimumDate={pickerMin} onChange={(_, date) => date && setDraft(date)} />
      </DonorLinkBottomSheet>
    </FieldShell>
  );
}
