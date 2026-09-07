declare module 'expo-location' {
  export enum Accuracy {
    Low = 2,
    Balanced = 3,
  }

  export type LocationObject = {
    coords: {
      latitude: number;
      longitude: number;
    };
  };

  export type LocationGeocodedAddress = {
    city?: string | null;
    subregion?: string | null;
    region?: string | null;
    country?: string | null;
  };

  export function requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  /** Reads the current grant WITHOUT prompting. */
  export function getForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function getCurrentPositionAsync(options?: { accuracy?: Accuracy }): Promise<LocationObject>;
  export function getLastKnownPositionAsync(): Promise<LocationObject | null>;
  export function reverseGeocodeAsync(coords: { latitude: number; longitude: number }): Promise<LocationGeocodedAddress[]>;
}
