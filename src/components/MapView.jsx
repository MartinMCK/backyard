import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { gpx } from '@tmcw/togeojson'
import { useRaceStore } from '../store/raceStore.js'

const FALLBACK_LAP_DURATION_MINUTES = 60
const EARTH_RADIUS_METERS = 6371000

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const toRadians = (degrees) => (degrees * Math.PI) / 180

const getDistanceMeters = ([latA, lngA], [latB, lngB]) => {
  const latDelta = toRadians(latB - latA)
  const lngDelta = toRadians(lngB - lngA)
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      Math.sin(lngDelta / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const extractTrackPoints = (gpxString) => {
  if (!gpxString) {
    return []
  }

  try {
    const document = new DOMParser().parseFromString(gpxString, 'application/xml')
    const geoJson = gpx(document)
    const track = geoJson.features.find((feature) =>
      ['LineString', 'MultiLineString'].includes(feature.geometry?.type),
    )

    if (!track) {
      return []
    }

    const coordinates =
      track.geometry.type === 'MultiLineString'
        ? track.geometry.coordinates[0]
        : track.geometry.coordinates

    return coordinates
      .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
      .map(([lng, lat]) => [lat, lng])
  } catch {
    return []
  }
}

const getTrackDistance = (points) =>
  points.reduce((total, point, index) => {
    if (index === 0) {
      return total
    }

    return total + getDistanceMeters(points[index - 1], point)
  }, 0)

const getPointAtProgress = (points, progress) => {
  if (points.length === 0) {
    return null
  }

  if (points.length === 1) {
    return points[0]
  }

  const targetDistance = getTrackDistance(points) * clamp(progress, 0, 1)
  let walkedDistance = 0

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1]
    const currentPoint = points[index]
    const segmentDistance = getDistanceMeters(previousPoint, currentPoint)

    if (walkedDistance + segmentDistance >= targetDistance) {
      const segmentProgress =
        segmentDistance === 0 ? 0 : (targetDistance - walkedDistance) / segmentDistance

      return [
        previousPoint[0] + (currentPoint[0] - previousPoint[0]) * segmentProgress,
        previousPoint[1] + (currentPoint[1] - previousPoint[1]) * segmentProgress,
      ]
    }

    walkedDistance += segmentDistance
  }

  return points.at(-1)
}

const getAverageLapDuration = (participant, raceConfig) => {
  const fallbackDuration =
    (raceConfig.lapDurationMinutes || FALLBACK_LAP_DURATION_MINUTES) * 60 * 1000

  if (participant.laps.length <= 1) {
    return fallbackDuration
  }

  const durations = participant.laps
    .map((lap, index, laps) => {
      const arrivalMs = new Date(lap.arrivalTime).getTime()
      const previousArrivalMs =
        index === 0
          ? new Date(raceConfig.startTime).getTime()
          : new Date(laps[index - 1].arrivalTime).getTime()

      return arrivalMs - previousArrivalMs
    })
    .filter((duration) => Number.isFinite(duration) && duration > 0)

  if (durations.length === 0) {
    return fallbackDuration
  }

  return durations.reduce((total, duration) => total + duration, 0) / durations.length
}

function FitTrackBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [28, 28] })
    }
  }, [map, points])

  return null
}

function MapView() {
  const [now, setNow] = useState(() => new Date())
  const participants = useRaceStore((state) => state.participants)
  const raceConfig = useRaceStore((state) => state.raceConfig)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 10_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const trackPoints = useMemo(
    () => extractTrackPoints(raceConfig.gpxData),
    [raceConfig.gpxData],
  )

  const runnerMarkers = useMemo(() => {
    if (trackPoints.length === 0 || !raceConfig.startTime) {
      return []
    }

    return participants
      .filter((participant) => participant.status === 'running')
      .map((participant) => {
        const lastArrivalTime =
          participant.laps.at(-1)?.arrivalTime ?? raceConfig.startTime
        const elapsed = now.getTime() - new Date(lastArrivalTime).getTime()
        const avgLapDuration = getAverageLapDuration(participant, raceConfig)
        const progress = clamp(elapsed / avgLapDuration, 0, 1)
        const position = getPointAtProgress(trackPoints, progress)

        if (!position) {
          return null
        }

        return {
          id: participant.id,
          bibNumber: participant.bibNumber,
          color: participant.color,
          position,
        }
      })
      .filter(Boolean)
  }, [now, participants, raceConfig, trackPoints])

  if (trackPoints.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950 text-slate-500 lg:h-[500px]">
        Aucun tracé chargé
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950">
      <MapContainer
        center={trackPoints[0]}
        className="h-[300px] w-full lg:h-[500px]"
        scrollWheelZoom={false}
        zoom={14}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          pathOptions={{ color: '#bef264', opacity: 0.9, weight: 5 }}
          positions={trackPoints}
        />
        {runnerMarkers.map((marker) => (
          <CircleMarker
            center={marker.position}
            key={marker.id}
            pathOptions={{
              color: '#0f172a',
              fillColor: marker.color,
              fillOpacity: 1,
              opacity: 1,
              weight: 2,
            }}
            radius={8}
          >
            <Tooltip direction="right" offset={[10, 0]} permanent>
              {marker.bibNumber}
            </Tooltip>
          </CircleMarker>
        ))}
        <FitTrackBounds points={trackPoints} />
      </MapContainer>
    </div>
  )
}

export default MapView
