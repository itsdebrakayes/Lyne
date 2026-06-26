declare module 'expo-location' {
  export enum Accuracy {
    Balanced = 3,
  }

  export type LocationObject = {
    coords: {
      latitude: number;
      longitude: number;
    };
  };

  export function requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function getCurrentPositionAsync(options?: { accuracy?: Accuracy }): Promise<LocationObject>;
}
