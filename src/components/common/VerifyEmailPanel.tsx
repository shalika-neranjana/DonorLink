import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { authApi } from '@/lib/appwrite/auth';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';

const RESEND_SECONDS = 30;

/**
 * Email verification with a 6-digit code (no redirect page needed on mobile).
 * Used on the sign-up path and from Profile > Verification.
 */
export function VerifyEmailPanel({ onVerified, onSkip }: { onVerified?: () => void; onSkip?: () => void }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send() {
    if (busy) return;
    setError(null);
    setBusy('send');
    try {
      await authApi.sendVerificationCode();
      setSent(true);
      setCooldown(RESEND_SECONDS);
      toast.info('Code sent', `Check ${user?.email ?? 'your email'} for a 6-digit code.`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    if (busy || !user) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setFieldError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy('verify');
    try {
      await authApi.confirmVerificationCode(user.$id, code);
      await refreshUser();
      toast.success('Email verified');
      onVerified?.();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="gap-4">
      <View className="items-center gap-3 py-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <DonorLinkIcon name="mail-open-outline" size={30} color="primary" />
        </View>
        <DonorLinkText variant="body" tone="secondary" align="center">
          {sent ? `Enter the code we sent to ${user?.email ?? 'your email'}.` : `We'll send a 6-digit code to ${user?.email ?? 'your email'} to confirm it's really you.`}
        </DonorLinkText>
      </View>

      {error ? <DonorLinkBanner tone="error" message={error} /> : null}

      {sent ? (
        <>
          <DonorLinkInput
            label="6-digit code"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setFieldError(undefined);
            }}
            error={fieldError}
            leftIcon="keypad-outline"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={() => void verify()}
          />
          <DonorLinkButton title="Verify email" size="lg" fullWidth loading={busy === 'verify'} onPress={() => void verify()} />
          <DonorLinkButton
            title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            variant="ghost"
            disabled={cooldown > 0 || busy !== null}
            onPress={() => void send()}
          />
        </>
      ) : (
        <DonorLinkButton title="Send me a code" size="lg" fullWidth loading={busy === 'send'} leftIcon="paper-plane-outline" onPress={() => void send()} />
      )}

      {onSkip ? (
        <View className="gap-1">
          <DonorLinkButton title="Verify later" variant="outline" fullWidth onPress={onSkip} />
          <DonorLinkText variant="caption" tone="muted" align="center">
            You can verify from Profile at any time. Some features need a verified email.
          </DonorLinkText>
        </View>
      ) : null}
    </View>
  );
}
