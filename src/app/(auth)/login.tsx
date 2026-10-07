import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { DonorLinkLogo } from '@/components/common/DonorLinkLogo';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { validateLogin } from '@/domain';
import { useFormState } from '@/hooks/useFormState';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { values, errors, setValue, setErrors } = useFormState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    setFormError(null);
    const result = validateLogin(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      await signIn(result.value.email, result.value.password);
      // The root layout swaps to onboarding or the app once the session is ready;
      // an unverified account is sent to email verification by the auth layout.
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <DonorLinkScreen
      hideOfflineBanner={false}
      header={{ title: 'Welcome back', subtitle: 'Sign in to continue' }}
      contentClassName="pt-4"
    >
      <View className="items-center pb-2">
        <DonorLinkLogo size={64} />
      </View>
      {formError ? <DonorLinkBanner tone="error" title="Couldn't sign you in" message={formError} /> : null}
      <DonorLinkInput
        label="Email"
        value={values.email}
        onChangeText={(v) => setValue('email', v)}
        error={errors.email}
        leftIcon="mail-outline"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <DonorLinkInput
        ref={passwordRef}
        label="Password"
        value={values.password}
        onChangeText={(v) => setValue('password', v)}
        error={errors.password}
        leftIcon="lock-closed-outline"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <View className="items-end">
        <DonorLinkButton title="Forgot password?" variant="ghost" size="sm" onPress={() => router.push('/forgot-password')} />
      </View>
      <DonorLinkButton title="Sign in" size="lg" fullWidth loading={submitting} onPress={() => void submit()} />
      <View className="flex-row items-center justify-center gap-1">
        <DonorLinkText variant="body" tone="secondary">
          New to DonorLink?
        </DonorLinkText>
        <Link href="/register" replace accessibilityRole="link">
          <DonorLinkText variant="bodyStrong" tone="primary">
            Create an account
          </DonorLinkText>
        </Link>
      </View>
    </DonorLinkScreen>
  );
}
