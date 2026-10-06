import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { coarsenCoordinates, nearestDistrict, type Coordinates } from '@/domain';

export type LocationOutcome =
  | { ok: true; coordinates: Coordinates; district: string }
  | { ok: false; reason: 'denied' | 'blocked' | 'unavailable'; message: string };

/**
 * Asks for foreground location only when the user taps a button that explains
 * why, and returns coordinates that are already coarsened (~1 km) so precise
 * positions never leave the hook. Denial is a normal outcome: callers always
 * keep a manual district picker.
 */
export function useApproximateLocation() {
  const [loading, setLoading] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<LocationOutcome | null>(null);

  const request = useCallback(async (): Promise<LocationOutcome> => {
    setLoading(true);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      const permission = existing.granted ? existing : await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        const outcome: LocationOutcome = permission.canAskAgain
          ? { ok: false, reason: 'denied', message: 'Location was not shared. You can choose your district instead.' }
          : {
              ok: false,
              reason: 'blocked',
              message: 'Location access is turned off for DonorLink. Choose your district, or enable location in your device settings.',
            };
        setLastOutcome(outcome);
        return outcome;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinates = coarsenCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
      const outcome: LocationOutcome = { ok: true, coordinates, district: nearestDistrict(coordinates) };
      setLastOutcome(outcome);
      return outcome;
    } catch {
      const outcome: LocationOutcome = {
        ok: false,
        reason: 'unavailable',
        message: "We couldn't get your location right now. Choose your district instead.",
      };
      setLastOutcome(outcome);
      return outcome;
    } finally {
      setLoading(false);
    }
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { request, loading, lastOutcome, openSettings };
}
