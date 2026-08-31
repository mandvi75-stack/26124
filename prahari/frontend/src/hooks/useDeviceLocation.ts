import { useCallback, useEffect, useRef, useState } from 'react'

export interface DeviceLocation {
  lat: number
  lng: number
  accuracy: number
  label: string
}

export type LocationState =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unsupported'
  | 'error'

export function useDeviceLocation(autoRequest = true) {
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [state, setState] = useState<LocationState>('idle')
  const watchId = useRef<number | null>(null)
  const requested = useRef(false)

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState('unsupported')
      return
    }
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
    }
    setState('requesting')
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setLocation({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          label: 'Your Location',
        })
        setState('ready')
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setState('denied')
        } else {
          setState('error')
        }
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 },
    )
  }, [])

  // Auto-request on mount if enabled
  useEffect(() => {
    if (autoRequest && !requested.current) {
      requested.current = true
      request()
    }
  }, [autoRequest, request])

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [])

  return { location, state, request }
}
