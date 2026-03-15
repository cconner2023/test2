import { useState, useEffect, useCallback, useRef } from 'react';
import { forward } from 'mgrs';

interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  mgrs: string;
}

interface UseGeolocationReturn {
  position: GeoPosition | null;
  error: string | null;
  isWatching: boolean;
  startWatching: () => void;
  stopWatching: () => void;
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 5_000,
};

function getErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied';
    case error.POSITION_UNAVAILABLE:
      return 'Position unavailable';
    case error.TIMEOUT:
      return 'Location request timed out';
    default:
      return 'Unknown geolocation error';
  }
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported');
      return;
    }

    stopWatching();
    setError(null);
    setIsWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const mgrs = forward([longitude, latitude], 5);
        setPosition({ lat: latitude, lng: longitude, accuracy, mgrs });
        setError(null);
      },
      (err) => {
        setError(getErrorMessage(err));
      },
      WATCH_OPTIONS,
    );
  }, [stopWatching]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, error, isWatching, startWatching, stopWatching };
}
