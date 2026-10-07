import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { validateRegistration } from '@/domain';
import { useFormState } from '@/hooks/useFormState';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { values, errors, setValue, setErrors } = useFormState({ name: '', email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // A ref, not state: two taps in the same frame both see `submitting === false`.
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    setFormError(null);
    const result = validateRegistration(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      // On success the auth layout moves on to email verification.
      await signUp({ name: result.value.name, email: result.value.email, password: result.value.password });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <DonorLinkScreen header={{ title: 'Create your account', subtitle: 'One account for requesting and donating blood' }}>
      {formError ? <DonorLinkBanner tone="error" title="Couldn't create your account" message={formError} /> : null}
      <DonorLinkInput
        label="Full name"
        value={values.name}
        onChangeText={(v) => setValue('name', v)}
        error={errors.name}
        leftIcon="person-outline"
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <DonorLinkInput
        ref={emailRef}
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
        helperText="At least 8 characters, with a letter and a number."
        leftIcon="lock-closed-outline"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <DonorLinkInput
        ref={confirmRef}
        label="Confirm password"
        value={values.confirmPassword}
        onChangeText={(v) => setValue('confirmPassword', v)}
        error={errors.confirmPassword}
        leftIcon="lock-closed-outline"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <DonorLinkButton title="Create account" size="lg" fullWidth loading={submitting} onPress={() => void submit()} />
      <DonorLinkText variant="caption" tone="muted" align="center">
        By creating an account you agree to share only the information needed to coordinate blood donations. DonorLink is a coordination tool, not a medical service.
      </DonorLinkText>
      <View className="flex-row items-center justify-center gap-1">
        <DonorLinkText variant="body" tone="secondary">
          Already registered?
        </DonorLinkText>
        <Link href="/login" replace accessibilityRole="link">
          <DonorLinkText variant="bodyStrong" tone="primary">
            Sign in
          </DonorLinkText>
        </Link>
      </View>
    </DonorLinkScreen>
  );
}
