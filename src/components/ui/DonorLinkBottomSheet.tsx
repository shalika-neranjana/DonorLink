import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DonorLinkIcon } from './DonorLinkIcon';
import { DonorLinkText } from './DonorLinkText';

export interface DonorLinkBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal bottom sheet: slides up, closes with the handle drag, the backdrop,
 * the close button or the Android back button. Used for pickers, filters and
 * quick edits so context is preserved behind it. Its children are unmounted
 * when closed, so local state inside the sheet resets on every open.
 */
export function DonorLinkBottomSheet({ visible, onClose, title, children, footer }: DonorLinkBottomSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  // Mount on open (adjusting state during render is the sanctioned pattern here).
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      translateY.set(height);
      translateY.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
      backdrop.set(withTiming(1, { duration: 200 }));
    } else {
      backdrop.set(withTiming(0, { duration: 150 }));
      translateY.set(
        withTiming(height, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, height, translateY, backdrop]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 800) runOnJS(onClose)();
      else translateY.set(withTiming(0, { duration: 160 }));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 justify-end">
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)' }, backdropStyle]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={{ flex: 1 }} />
          </Animated.View>
          <Animated.View
            style={[{ maxHeight: height * 0.88, paddingBottom: Math.max(insets.bottom, 12) }, sheetStyle]}
            className="rounded-t-xl border-t border-border bg-surface"
            accessibilityViewIsModal={Platform.OS === 'ios'}
          >
            <GestureDetector gesture={pan}>
              <View className="items-center pb-1 pt-2.5" accessibilityLabel="Drag down to close" accessible={false}>
                <View className="h-1 w-10 rounded-full bg-border-strong" />
              </View>
            </GestureDetector>
            <View className="flex-row items-center justify-between px-5 pb-2 pt-1">
              <DonorLinkText variant="title" accessibilityRole="header">
                {title}
              </DonorLinkText>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} className="h-9 w-9 items-center justify-center">
                <DonorLinkIcon name="close" size={22} color="fgMuted" />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 px-5 pb-3 pt-1" bounces={false}>
              {children}
            </ScrollView>
            {footer ? <View className="gap-2 px-5 pt-2">{footer}</View> : null}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
