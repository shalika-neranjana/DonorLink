import { useState } from 'react';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { validatePasswordField } from '@/domain';
import { authApi } from '@/lib/appwrite/auth';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { testAppwriteConnection } from '@/lib/appwrite/testConnection';

export default function SecuritySettingsScreen() {
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<{ status: 'idle' | 'checking' | 'ok' | 'failed'; message?: string }>({ status: 'idle' });

  async function changePassword() {
    if (saving) return;
    setFormError(null);
    const next: Record<string, string | undefined> = {};
    if (!oldPassword) next.oldPassword = 'Current password is required.';
    const passwordError = validatePasswordField(password);
    if (passwordError) next.password = passwordError;
    else if (password === oldPassword) next.password = 'Choose a password you are not already using.';
    if (!next.password && password !== confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await authApi.updatePassword(oldPassword, password);
      setOldPassword('');
      setPassword('');
      setConfirm('');
      toast.success('Password changed');
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function runCheck() {
    setCheck({ status: 'checking' });
    try {
      await testAppwriteConnection();
      setCheck({ status: 'ok', message: 'Connected to DonorLink services.' });
    } catch (e) {
      setCheck({ status: 'failed', message: getErrorMessage(e) });
    }
  }

  return (
    <DonorLinkScreen header={{ title: 'Security' }}>
      <DonorLinkCard className="gap-4">
        <DonorLinkText variant="title">Change password</DonorLinkText>
        {formError ? <DonorLinkBanner tone="error" message={formError} /> : null}
        <DonorLinkInput label="Current password" value={oldPassword} onChangeText={(v) => { setOldPassword(v); setErrors((e) => ({ ...e, oldPassword: undefined })); }} error={errors.oldPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" leftIcon="lock-closed-outline" />
        <DonorLinkInput label="New password" value={password} onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }} error={errors.password} helperText="At least 8 characters, with a letter and a number." secureTextEntry autoCapitalize="none" autoComplete="new-password" leftIcon="key-outline" />
        <DonorLinkInput label="Confirm new password" value={confirm} onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })); }} error={errors.confirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" leftIcon="key-outline" />
        <DonorLinkButton title="Update password" loading={saving} fullWidth onPress={() => void changePassword()} />
      </DonorLinkCard>

      <DonorLinkCard className="gap-3">
        <DonorLinkText variant="title">Connection check</DonorLinkText>
        <DonorLinkText variant="bodySmall" tone="secondary">
          Confirms this device can reach DonorLink&apos;s servers. Useful if requests are failing.
        </DonorLinkText>
        {check.status === 'ok' ? <DonorLinkBanner tone="success" message={check.message ?? 'Connected.'} /> : null}
        {check.status === 'failed' ? <DonorLinkBanner tone="error" title="Can't reach DonorLink" message={check.message ?? 'Please try again.'} /> : null}
        <DonorLinkButton title="Run check" variant="outline" leftIcon="pulse" loading={check.status === 'checking'} onPress={() => void runCheck()} />
      </DonorLinkCard>
    </DonorLinkScreen>
  );
}
