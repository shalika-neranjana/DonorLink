import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { validateEmailField, validatePasswordField } from '@/domain';
import { authApi } from '@/lib/appwrite/auth';
import { getErrorMessage } from '@/lib/appwrite/errors';

const RESEND_SECONDS = 30;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (busy) return;
    setFormError(null);
    const emailError = validateEmailField(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }
    setBusy(true);
    try {
      const id = await authApi.sendRecoveryCode(email);
      setUserId(id);
      setStep('reset');
      setCooldown(RESEND_SECONDS);
      toast.info('Code sent', 'Check your email for a 6-digit code.');
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (busy) return;
    setFormError(null);
    const next: Record<string, string | undefined> = {};
    if (!/^\d{6}$/.test(code.trim())) next.code = 'Enter the 6-digit code from your email.';
    const passwordError = validatePasswordField(password);
    if (passwordError) next.password = passwordError;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await authApi.resetPassword(userId, code, password);
      toast.success('Password updated', 'Sign in with your new password.');
      router.replace('/login');
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DonorLinkScreen
      header={{
        title: 'Reset password',
        subtitle: step === 'email' ? "We'll email you a 6-digit code" : `Code sent to ${email.trim()}`,
      }}
    >
      {formError ? <DonorLinkBanner tone="error" message={formError} /> : null}
      {step === 'email' ? (
        <>
          <DonorLinkInput
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setErrors({});
            }}
            error={errors.email}
            leftIcon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={() => void sendCode()}
          />
          <DonorLinkButton title="Send reset code" size="lg" fullWidth loading={busy} onPress={() => void sendCode()} />
        </>
      ) : (
        <>
          <DonorLinkInput
            label="6-digit code"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setErrors((e) => ({ ...e, code: undefined }));
            }}
            error={errors.code}
            leftIcon="keypad-outline"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <DonorLinkInput
            ref={passwordRef}
            label="New password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErrors((e) => ({ ...e, password: undefined }));
            }}
            error={errors.password}
            helperText="At least 8 characters, with a letter and a number."
            leftIcon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={() => void resetPassword()}
          />
          <DonorLinkButton title="Update password" size="lg" fullWidth loading={busy} onPress={() => void resetPassword()} />
          <DonorLinkButton
            title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            variant="ghost"
            disabled={cooldown > 0 || busy}
            onPress={() => void sendCode()}
          />
        </>
      )}
    </DonorLinkScreen>
  );
}
