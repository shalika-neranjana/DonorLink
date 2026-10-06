import { createModal } from '@gluestack-ui/core/modal/creator';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { DonorLinkButton } from './DonorLinkButton';
import { DonorLinkIcon } from './DonorLinkIcon';
import { DonorLinkText } from './DonorLinkText';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

// gluestack-ui modal primitive: handles focus, escape/back, overlay and a11y.
const UIModal = createModal({
  Root: View,
  Backdrop: AnimatedPressable,
  Content: AnimatedView,
  Body: ScrollView,
  CloseButton: Pressable,
  Footer: View,
  Header: View,
});

export interface DonorLinkModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Prevent closing by tapping outside (e.g. while a request is in flight). */
  dismissable?: boolean;
}

/** Centered dialog. Use sparingly; prefer inline banners, toasts and sheets. */
export function DonorLinkModal({ visible, onClose, title, description, children, footer, dismissable = true }: DonorLinkModalProps) {
  return (
    <UIModal isOpen={visible} onClose={dismissable ? onClose : undefined} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <UIModal.Backdrop
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(120)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)' }}
      />
      <UIModal.Content
        entering={ZoomIn.duration(160)}
        exiting={FadeOut.duration(120)}
        accessibilityViewIsModal
        className="w-[88%] max-w-[420px] gap-3 rounded-xl border border-border bg-surface p-5"
      >
        <UIModal.Header className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <DonorLinkText variant="title">{title}</DonorLinkText>
            {description ? (
              <DonorLinkText variant="body" tone="secondary">
                {description}
              </DonorLinkText>
            ) : null}
          </View>
          {dismissable ? (
            <UIModal.CloseButton accessibilityLabel="Close dialog" hitSlop={10} className="h-8 w-8 items-center justify-center">
              <DonorLinkIcon name="close" size={22} color="fgMuted" />
            </UIModal.CloseButton>
          ) : null}
        </UIModal.Header>
        {children ? <UIModal.Body scrollEnabled={false}>{children}</UIModal.Body> : null}
        {footer ? <UIModal.Footer className="mt-2 gap-2">{footer}</UIModal.Footer> : null}
      </UIModal.Content>
    </UIModal>
  );
}

export interface DonorLinkConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'emergency' | 'success';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** Confirmation for consequential or hard-to-undo actions (cancel request, withdraw, ...). */
export function DonorLinkConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Go back',
  tone = 'primary',
  loading,
  onConfirm,
  onCancel,
  children,
}: DonorLinkConfirmDialogProps) {
  const variant = tone === 'danger' ? 'emergency' : tone;
  return (
    <DonorLinkModal
      visible={visible}
      onClose={onCancel}
      title={title}
      description={message}
      dismissable={!loading}
      footer={
        <>
          <DonorLinkButton title={confirmLabel} variant={variant} loading={loading} onPress={onConfirm} fullWidth />
          <DonorLinkButton title={cancelLabel} variant="outline" disabled={loading} onPress={onCancel} fullWidth />
        </>
      }
    >
      {children}
    </DonorLinkModal>
  );
}
