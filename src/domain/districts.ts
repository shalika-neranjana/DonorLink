import type { Coordinates } from './geo';

/**
 * Sri Lankan districts with approximate centre points. Used as the manual
 * location fallback when device location permission is denied, so no feature
 * ever depends on GPS access.
 */
export const DISTRICTS: readonly { name: string; centre: Coordinates }[] = [
  { name: 'Ampara', centre: { lat: 7.3, lng: 81.67 } },
  { name: 'Anuradhapura', centre: { lat: 8.31, lng: 80.4 } },
  { name: 'Badulla', centre: { lat: 6.99, lng: 81.06 } },
  { name: 'Batticaloa', centre: { lat: 7.71, lng: 81.69 } },
  { name: 'Colombo', centre: { lat: 6.93, lng: 79.86 } },
  { name: 'Galle', centre: { lat: 6.05, lng: 80.22 } },
  { name: 'Gampaha', centre: { lat: 7.09, lng: 79.99 } },
  { name: 'Hambantota', centre: { lat: 6.12, lng: 81.12 } },
  { name: 'Jaffna', centre: { lat: 9.66, lng: 80.03 } },
  { name: 'Kalutara', centre: { lat: 6.59, lng: 79.96 } },
  { name: 'Kandy', centre: { lat: 7.29, lng: 80.63 } },
  { name: 'Kegalle', centre: { lat: 7.25, lng: 80.35 } },
  { name: 'Kilinochchi', centre: { lat: 9.38, lng: 80.38 } },
  { name: 'Kurunegala', centre: { lat: 7.48, lng: 80.36 } },
  { name: 'Mannar', centre: { lat: 8.98, lng: 79.9 } },
  { name: 'Matale', centre: { lat: 7.47, lng: 80.62 } },
  { name: 'Matara', centre: { lat: 5.95, lng: 80.55 } },
  { name: 'Monaragala', centre: { lat: 6.87, lng: 81.35 } },
  { name: 'Mullaitivu', centre: { lat: 9.27, lng: 80.81 } },
  { name: 'Nuwara Eliya', centre: { lat: 6.95, lng: 80.79 } },
  { name: 'Polonnaruwa', centre: { lat: 7.94, lng: 81.02 } },
  { name: 'Puttalam', centre: { lat: 8.04, lng: 79.84 } },
  { name: 'Ratnapura', centre: { lat: 6.71, lng: 80.38 } },
  { name: 'Trincomalee', centre: { lat: 8.59, lng: 81.22 } },
  { name: 'Vavuniya', centre: { lat: 8.75, lng: 80.5 } },
];

export const DISTRICT_NAMES: readonly string[] = DISTRICTS.map((d) => d.name);

export function findDistrict(name: string | null | undefined) {
  if (!name) return undefined;
  return DISTRICTS.find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
}

export function districtCentre(name: string | null | undefined): Coordinates | undefined {
  return findDistrict(name)?.centre;
}

/** Nearest district to a coordinate; used to label GPS-derived locations. */
export function nearestDistrict(point: Coordinates): string {
  let best = DISTRICTS[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const district of DISTRICTS) {
    const dLat = district.centre.lat - point.lat;
    const dLng = (district.centre.lng - point.lng) * Math.cos((point.lat * Math.PI) / 180);
    const score = dLat * dLat + dLng * dLng;
    if (score < bestScore) {
      best = district;
      bestScore = score;
    }
  }
  return best.name;
}
