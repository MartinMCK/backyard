import { useEffect, useMemo, useState } from 'react'
import MapView from '../components/MapView.jsx'
import { useRaceStore } from '../store/raceStore.js'

const STATUS_META = {
  running: {
    label: 'En course',
    className: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/25',
  },
  dnf: {
    label: 'DNF',
    className: 'bg-red-400/15 text-red-300 ring-red-400/25',
  },
  waiting: {
    label: 'En attente',
    className: 'bg-slate-400/15 text-slate-300 ring-slate-400/25',
  },
  finished: {
    label: 'Terminé',
    className: 'bg-sky-400/15 text-sky-300 ring-sky-400/25',
  },
}

const STATUS_SORT_ORDER = {
  running: 0,
  waiting: 1,
  finished: 2,
  dnf: 3,
}

const pad = (value) => String(value).padStart(2, '0')

const formatDuration = (milliseconds, includeHours = true) => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return includeHours ? '00:00:00' : '00:00'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (!includeHours) {
    return `${pad(minutes)}:${pad(seconds)}`
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const formatClockTime = (isoString) => {
  if (!isoString) {
    return '--:--:--'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(isoString))
}

const getLastLap = (participant) => participant.laps.at(-1)

const getLapDurations = (participant, raceConfig) =>
  participant.laps
    .map((lap, index, laps) => {
      const arrivalMs = new Date(lap.arrivalTime).getTime()
      const previousArrivalMs =
        index === 0
          ? new Date(raceConfig.startTime).getTime()
          : new Date(laps[index - 1].arrivalTime).getTime()

      return arrivalMs - previousArrivalMs
    })
    .filter((duration) => Number.isFinite(duration) && duration > 0)

function LapSparkline({ participant, raceConfig }) {
  const lapDurations = getLapDurations(participant, raceConfig)

  if (lapDurations.length === 0) {
    return (
      <div className="mt-5 h-10 rounded-md border border-dashed border-slate-800 bg-slate-950" />
    )
  }

  const fastestLapDuration = Math.min(...lapDurations)

  return (
    <div className="mt-5 flex h-12 items-end gap-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-2">
      {lapDurations.map((duration, index) => {
        const height = Math.max(18, Math.min(100, (duration / fastestLapDuration) * 42))

        return (
          <span
            aria-label={`Tour ${index + 1}`}
            className="min-w-2 flex-1 rounded-sm bg-lime-300/80"
            key={`${participant.id}-${index}-${duration}`}
            style={{ height: `${height}%` }}
            title={`${Math.round(duration / 1000)}s`}
          />
        )
      })}
    </div>
  )
}

function PublicView() {
  const [searchTerm, setSearchTerm] = useState('')
  const [now, setNow] = useState(() => new Date())
  const participants = useRaceStore((state) => state.participants)
  const raceConfig = useRaceStore((state) => state.raceConfig)
  const getNextLapStartTime = useRaceStore((state) => state.getNextLapStartTime)
  const currentLapNumber = useRaceStore((state) => state.getCurrentLapNumber())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  const filteredParticipants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return participants
      .filter((participant) => {
        if (!normalizedSearch) {
          return true
        }

        return (
          participant.name.toLowerCase().includes(normalizedSearch) ||
          participant.bibNumber.toLowerCase().includes(normalizedSearch)
        )
      })
      .sort((participantA, participantB) => {
        const statusDelta =
          STATUS_SORT_ORDER[participantA.status] - STATUS_SORT_ORDER[participantB.status]

        if (statusDelta !== 0) {
          return statusDelta
        }

        if (participantA.status === 'running' && participantB.status === 'running') {
          return participantB.laps.length - participantA.laps.length
        }

        return participantA.name.localeCompare(participantB.name)
      })
  }, [participants, searchTerm])

  const nextLapStartTime = raceConfig.isStarted ? getNextLapStartTime() : null
  const raceChrono = raceConfig.startTime
    ? formatDuration(now.getTime() - new Date(raceConfig.startTime).getTime())
    : '00:00:00'
  const nextLapCountdown = nextLapStartTime
    ? formatDuration(new Date(nextLapStartTime).getTime() - now.getTime(), false)
    : '--:--'
  const runningCount = participants.filter(
    (participant) => participant.status === 'running',
  ).length

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-lime-300">
              {raceConfig.raceName || 'Backyard Ultra Tracker'}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Tableau public
            </h1>
          </div>

          {raceConfig.isStarted ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-md border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Chrono course
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-white">
                  {raceChrono}
                </p>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Prochain départ
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-lime-300">
                  {nextLapCountdown}
                </p>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Boucle
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-white">
                  {currentLapNumber || '--'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-slate-800 bg-slate-950 px-4 py-3 text-slate-300">
              La course n'a pas encore démarré
            </div>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Participants</h2>
            <p className="mt-1 text-sm text-slate-400">
              {runningCount} en course sur {participants.length} inscrits
            </p>
          </div>
          <label className="w-full md:max-w-sm">
            <span className="sr-only">Rechercher un participant</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none ring-lime-300 transition placeholder:text-slate-500 focus:border-lime-300 focus:ring-2"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher nom ou dossard"
            />
          </label>
        </div>

        {filteredParticipants.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredParticipants.map((participant) => {
              const lastLap = getLastLap(participant)
              const status = STATUS_META[participant.status] ?? STATUS_META.waiting
              const timeSinceLastArrival = lastLap
                ? formatDuration(now.getTime() - new Date(lastLap.arrivalTime).getTime())
                : '--:--:--'

              return (
                <article
                  className="rounded-lg border border-slate-800 bg-slate-900 p-5"
                  key={participant.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: participant.color }}
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-white">
                          {participant.name}
                        </h3>
                        <p className="text-sm text-slate-400">
                          Dossard {participant.bibNumber}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-slate-400">Tours validés</dt>
                      <dd className="mt-1 text-2xl font-bold text-lime-300">
                        {participant.laps.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Dernier ravito</dt>
                      <dd className="mt-1 font-mono text-lg font-semibold text-white">
                        {formatClockTime(lastLap?.arrivalTime)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-400">Depuis le dernier ravito</dt>
                      <dd className="mt-1 font-mono text-lg font-semibold text-white">
                        {timeSinceLastArrival}
                      </dd>
                    </div>
                  </dl>
                  <LapSparkline participant={participant} raceConfig={raceConfig} />
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
            Aucun participant trouvé
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-bold text-white">Carte</h2>
        <div className="mt-4">
          <MapView />
        </div>
      </section>
    </div>
  )
}

export default PublicView
