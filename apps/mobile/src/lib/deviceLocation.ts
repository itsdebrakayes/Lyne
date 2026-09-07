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

export type DevicePlace = { city: string; country: string } | null;

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
        setPlace({ city, country: hit.country || '' });
      } catch {
        /* No location, no geocoder, no network. The caller falls back. */
      }
    })();
    return () => { alive = false; };
  }, []);

  return place;
}
