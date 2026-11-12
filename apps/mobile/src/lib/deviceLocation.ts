/**
 * deviceLocation.ts — where the phone says the person is, if it will say.
 *
 * The Home header used to read the town somebody picked during onboarding,
 * and "Kingston" when they picked nothing — so an app opened in Montego Bay
 * by a user who skipped a question claimed a city it had no basis for.
 *
 * This asks the device instead, under one rule: it NEVER prompts. It reads the
 * permission that already exists — granted, if at all, when the app asked to
 * time a departure reminder — and stays quiet otherwise. A header is not worth
 * a permission dialog, and a dialog the user did not provoke is the fastest way
 * to have location denied for the feature that genuinely needs it.
 *
 * Every failure path is silent and falls back to the onboarding answer. Nothing
 * here is load-bearing enough to show an error about.
 */
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type DevicePlace = { city: string; country: string; countryCode: string } | null;

export function useDevicePlace(): DevicePlace {
  const [place, setPlace] = useState<DevicePlace>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;

        /* Last known first: it is instant and does not spin up the radio. A
           header that arrives half a second late is worse than one that is a
           street or two stale. */
        const position =
          (await Location.getLastKnownPositionAsync()) ||
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        if (!position || !alive) return;

        const [hit] = await Location.reverseGeocodeAsync(position.coords);
        if (!hit || !alive) return;

        const city = hit.city || hit.subregion || hit.region;
        if (!city) return;
        setPlace({ city, country: hit.country || '', countryCode: (hit.isoCountryCode || '').toUpperCase() });
      } catch {
        /* No location, no geocoder, no network. The caller falls back. */
      }
    })();
    return () => { alive = false; };
  }, []);

  return place;
}

/* ── Distance ────────────────────────────────────────────────────────────
   For "Nearest to you". Only read when location permission is ALREADY
   granted: this never prompts, and the coordinates stay on the phone. */
export type Coords = { lat: number; lng: number } | null;

export function useDeviceCoords(): Coords {
  const [coords, setCoords] = useState<Coords>(null);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const position =
          (await Location.getLastKnownPositionAsync()) ||
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (position && alive) setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      } catch {
        /* No location is a normal state: the list falls back to shortest wait. */
      }
    };
    read();
    const id = setInterval(read, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return coords;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** "1.4 mi" in the US (and the UK, Liberia, Myanmar), "2.3 km" elsewhere. */
export function formatDistance(km: number): string {
  let region = '';
  try { region = (new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region || '').toUpperCase(); } catch { /* default km */ }
  const miles = ['US', 'GB', 'LR', 'MM'].includes(region);
  const v = miles ? km * 0.621371 : km;
  const unit = miles ? 'mi' : 'km';
  return v < 10 ? `${v.toFixed(1)} ${unit}` : `${Math.round(v)} ${unit}`;
}
