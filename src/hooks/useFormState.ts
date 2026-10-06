import { useCallback, useState } from 'react';

import { getFieldErrors } from '@/lib/appwrite/errors';

export type FormErrors<T> = Partial<Record<keyof T & string, string>> & Record<string, string | undefined>;

/**
 * Tiny form helper: values, per-field errors (cleared as the user edits that
 * field) and a way to merge server-side field errors into the same place.
 */
export function useFormState<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<FormErrors<T>>({});

  const setValue = useCallback(<K extends keyof T & string>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const applyServerError = useCallback((error: unknown) => {
    const fields = getFieldErrors(error);
    if (Object.keys(fields).length) {
      setErrors((prev) => ({ ...prev, ...fields }));
      return true;
    }
    return false;
  }, []);

  return { values, errors, setValue, setValues, setErrors, applyServerError };
}
