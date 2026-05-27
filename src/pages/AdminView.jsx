import { useMemo, useState } from 'react'
import { gpx } from '@tmcw/togeojson'
import { getStoredAdminPin } from '../utils/adminPin.js'
import { useRaceStore } from '../store/raceStore.js'

const ADMIN_UNLOCKED_KEY = 'admin_unlocked'

const tabs = [
  { id: 'race', label: 'Race Control' },
  { id: 'participants', label: 'Participants' },
  { id: 'gpx', label: 'GPX Import' },
  { id: 'webhook', label: 'Webhook Test' },
]

const statusLabels = {
  waiting: 'En attente',
  running: 'En course',
  dnf: 'DNF',
  finished: 'Terminé',
}

const toDateTimeLocalValue = (date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const fromDateTimeLocalValue = (value) => {
  if (!value) {
    return null
  }

  return new Date(value).toISOString()
}

const formatDateTime = (isoString) => {
  if (!isoString) {
    return '--'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(isoString))
}

const getGpxSummary = (gpxString) => {
  if (!gpxString) {
    return null
  }

  try {
    const document = new DOMParser().parseFromString(gpxString, 'application/xml')
    const geoJson = gpx(document)
    const track = geoJson.features.find((feature) =>
      ['LineString', 'MultiLineString'].includes(feature.geometry?.type),
    )

    if (!track) {
      return { trackName: 'Tracé sans nom', pointCount: 0 }
    }

    const pointCount =
      track.geometry.type === 'MultiLineString'
        ? track.geometry.coordinates[0]?.length || 0
        : track.geometry.coordinates.length

    return {
      trackName: track.properties?.name || 'Tracé sans nom',
      pointCount,
    }
  } catch {
    return { trackName: 'GPX illisible', pointCount: 0 }
  }
}

function AdminView() {
  const [isUnlocked, setIsUnlocked] = useState(
    () => window.localStorage.getItem(ADMIN_UNLOCKED_KEY) === 'true',
  )
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [activeTab, setActiveTab] = useState('race')
  const [startTimeInput, setStartTimeInput] = useState(() =>
    toDateTimeLocalValue(new Date()),
  )
  const [lapDurationInput, setLapDurationInput] = useState('60')
  const [participantForm, setParticipantForm] = useState({ name: '', bibNumber: '' })
  const [editingRows, setEditingRows] = useState({})
  const [manualTags, setManualTags] = useState({})
  const [gpxSummary, setGpxSummary] = useState(null)
  const [gpxMessage, setGpxMessage] = useState('')
  const [webhookForm, setWebhookForm] = useState({
    tag_id: '',
    timestamp: toDateTimeLocalValue(new Date()),
  })
  const [webhookResponse, setWebhookResponse] = useState('')
  const [isSendingWebhook, setIsSendingWebhook] = useState(false)
  const [raceNameInput, setRaceNameInput] = useState(
    () => useRaceStore.getState().raceConfig.raceName || 'Backyard Ultra Tracker',
  )
  const [shareMessage, setShareMessage] = useState('')

  const participants = useRaceStore((state) => state.participants)
  const raceConfig = useRaceStore((state) => state.raceConfig)
  const listeningForTag = useRaceStore((state) => state.listeningForTag)
  const unmatchedTags = useRaceStore((state) => state.unmatchedTags)
  const initRace = useRaceStore((state) => state.initRace)
  const resetRace = useRaceStore((state) => state.resetRace)
  const addParticipant = useRaceStore((state) => state.addParticipant)
  const updateParticipant = useRaceStore((state) => state.updateParticipant)
  const removeParticipant = useRaceStore((state) => state.removeParticipant)
  const assignTag = useRaceStore((state) => state.assignTag)
  const startListeningForTag = useRaceStore((state) => state.startListeningForTag)
  const markDNF = useRaceStore((state) => state.markDNF)
  const setGpxData = useRaceStore((state) => state.setGpxData)
  const setRaceName = useRaceStore((state) => state.setRaceName)
  const clearUnmatchedTags = useRaceStore((state) => state.clearUnmatchedTags)
  const currentLapNumber = useRaceStore((state) => state.getCurrentLapNumber())
  const nextLapStartTime = useRaceStore((state) => state.getNextLapStartTime())

  const storedGpxSummary = useMemo(
    () => getGpxSummary(raceConfig.gpxData),
    [raceConfig.gpxData],
  )

  const handlePinSubmit = (event) => {
    event.preventDefault()
    setPinError('')

    if (pin !== getStoredAdminPin()) {
      setPinError('PIN incorrect')
      return
    }

    window.localStorage.setItem(ADMIN_UNLOCKED_KEY, 'true')
    setIsUnlocked(true)
    setPin('')
  }

  const handleLock = () => {
    window.localStorage.removeItem(ADMIN_UNLOCKED_KEY)
    setIsUnlocked(false)
  }

  const handleStartRace = (event) => {
    event.preventDefault()
    initRace(fromDateTimeLocalValue(startTimeInput), Number(lapDurationInput))
  }

  const handleRaceNameSubmit = (event) => {
    event.preventDefault()
    setRaceName(raceNameInput.trim() || 'Backyard Ultra Tracker')
  }

  const handleCopyPublicUrl = async () => {
    const publicUrl = `${window.location.origin}/`

    try {
      await navigator.clipboard.writeText(publicUrl)
      setShareMessage('URL publique copiée')
    } catch {
      setShareMessage(publicUrl)
    }
  }

  const handleResetRace = () => {
    if (window.confirm('Réinitialiser toute la course ?')) {
      resetRace()
      setEditingRows({})
      setManualTags({})
      setGpxSummary(null)
      setGpxMessage('')
    }
  }

  const handleAddParticipant = (event) => {
    event.preventDefault()
    const name = participantForm.name.trim()
    const bibNumber = participantForm.bibNumber.trim()

    if (!name || !bibNumber) {
      return
    }

    addParticipant(name, bibNumber)
    setParticipantForm({ name: '', bibNumber: '' })
  }

  const handleStartEdit = (participant) => {
    setEditingRows((rows) => ({
      ...rows,
      [participant.id]: {
        name: participant.name,
        bibNumber: participant.bibNumber,
      },
    }))
  }

  const handleSaveEdit = (participantId) => {
    const fields = editingRows[participantId]

    if (!fields?.name.trim() || !fields?.bibNumber.trim()) {
      return
    }

    updateParticipant(participantId, {
      name: fields.name.trim(),
      bibNumber: fields.bibNumber.trim(),
    })
    setEditingRows((rows) => {
      const nextRows = { ...rows }
      delete nextRows[participantId]
      return nextRows
    })
  }

  const handleDeleteParticipant = (participantId) => {
    if (window.confirm('Supprimer ce participant ?')) {
      removeParticipant(participantId)
    }
  }

  const handleAssignManualTag = (participantId) => {
    const tagId = manualTags[participantId]?.trim()

    if (!tagId) {
      return
    }

    assignTag(participantId, tagId)
    setManualTags((tags) => ({ ...tags, [participantId]: '' }))
  }

  const handleGpxFile = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const gpxText = await file.text()
    setGpxData(gpxText)
    const summary = getGpxSummary(gpxText)
    setGpxSummary(summary)
    setGpxMessage(`${summary.trackName} importé (${summary.pointCount} points)`)
  }

  const handleWebhookSubmit = async (event) => {
    event.preventDefault()
    setIsSendingWebhook(true)
    setWebhookResponse('')

    try {
      const response = await fetch('/.netlify/functions/rfid', {
        body: JSON.stringify({
          tag_id: webhookForm.tag_id,
          timestamp: fromDateTimeLocalValue(webhookForm.timestamp),
        }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      })
      const data = await response.json()
      setWebhookResponse(JSON.stringify(data, null, 2))
    } catch (error) {
      setWebhookResponse(
        JSON.stringify(
          {
            ok: false,
            error: error.message,
          },
          null,
          2,
        ),
      )
    } finally {
      setIsSendingWebhook(false)
    }
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-lime-300">
          Race Admin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">Entrer le PIN</h1>
        <form className="mt-6 space-y-4" onSubmit={handlePinSubmit}>
          <label className="block text-sm font-medium text-slate-300" htmlFor="admin-pin">
            PIN administrateur
          </label>
          <input
            id="admin-pin"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition placeholder:text-slate-500 focus:border-lime-300 focus:ring-2"
            inputMode="numeric"
            onChange={(event) => setPin(event.target.value)}
            placeholder="1234"
            type="password"
            value={pin}
          />
          {pinError ? <p className="text-sm text-red-300">{pinError}</p> : null}
          <button
            className="w-full rounded-md bg-lime-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-lime-200"
            type="submit"
          >
            Déverrouiller
          </button>
        </form>
      </section>
    )
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <header className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-lime-300">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Race Control</h1>
        </div>
        <button
          className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-lime-300 hover:text-lime-300"
          onClick={handleLock}
          type="button"
        >
          Lock
        </button>
      </header>

      <nav className="hidden gap-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-2 md:flex">
        {tabs.map((tab) => (
          <button
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-lime-300 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-[900] grid grid-cols-4 gap-1 border-t border-slate-800 bg-slate-950/95 p-2 backdrop-blur md:hidden">
        {tabs.map((tab) => (
          <button
            className={`rounded-md px-2 py-3 text-xs font-semibold transition ${
              activeTab === tab.id
                ? 'bg-lime-300 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'race' ? (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-2xl font-bold text-white">Race Control</h2>
          <form className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={handleRaceNameSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Nom de la course</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition focus:border-lime-300 focus:ring-2"
                onChange={(event) => setRaceNameInput(event.target.value)}
                type="text"
                value={raceNameInput}
              />
            </label>
            <button
              className="self-end rounded-md border border-lime-300/50 px-5 py-3 font-semibold text-lime-300 transition hover:bg-lime-300/10"
              type="submit"
            >
              Enregistrer
            </button>
          </form>

          <div className="mt-4 rounded-md border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-300">URL publique</p>
                <p className="mt-1 truncate font-mono text-sm text-slate-400">
                  {window.location.origin}/
                </p>
              </div>
              <button
                className="rounded-md bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200"
                onClick={handleCopyPublicUrl}
                type="button"
              >
                Copier
              </button>
            </div>
            {shareMessage ? (
              <p className="mt-3 text-sm text-lime-300">{shareMessage}</p>
            ) : null}
          </div>

          <form
            className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_auto]"
            onSubmit={handleStartRace}
          >
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Départ</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition focus:border-lime-300 focus:ring-2"
                onChange={(event) => setStartTimeInput(event.target.value)}
                type="datetime-local"
                value={startTimeInput}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Minutes / tour</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition focus:border-lime-300 focus:ring-2"
                min="1"
                onChange={(event) => setLapDurationInput(event.target.value)}
                type="number"
                value={lapDurationInput}
              />
            </label>
            <button
              className="self-end rounded-md bg-lime-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-lime-200"
              type="submit"
            >
              Start race
            </button>
          </form>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">Tour actuel</dt>
              <dd className="mt-1 text-2xl font-bold text-lime-300">
                {currentLapNumber || '--'}
              </dd>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">Prochain départ</dt>
              <dd className="mt-1 text-lg font-semibold text-white">
                {formatDateTime(nextLapStartTime)}
              </dd>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">Statut</dt>
              <dd className="mt-1 text-lg font-semibold text-white">
                {raceConfig.isStarted ? 'Course démarrée' : 'En attente'}
              </dd>
            </div>
          </dl>

          <button
            className="mt-6 rounded-md border border-red-400/40 px-4 py-2 font-semibold text-red-300 transition hover:bg-red-400/10"
            onClick={handleResetRace}
            type="button"
          >
            Reset race
          </button>
        </section>
      ) : null}

      {activeTab === 'participants' ? (
        <section className="space-y-6 rounded-lg border border-slate-800 bg-slate-900 p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Participants</h2>
            <form className="mt-5 grid gap-4 md:grid-cols-[1fr_160px_auto]" onSubmit={handleAddParticipant}>
              <input
                className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition placeholder:text-slate-500 focus:border-lime-300 focus:ring-2"
                onChange={(event) =>
                  setParticipantForm((form) => ({ ...form, name: event.target.value }))
                }
                placeholder="Nom"
                value={participantForm.name}
              />
              <input
                className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition placeholder:text-slate-500 focus:border-lime-300 focus:ring-2"
                onChange={(event) =>
                  setParticipantForm((form) => ({
                    ...form,
                    bibNumber: event.target.value,
                  }))
                }
                placeholder="Dossard"
                value={participantForm.bibNumber}
              />
              <button
                className="rounded-md bg-lime-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-lime-200"
                type="submit"
              >
                Ajouter
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="border-b border-slate-800 p-3">Nom</th>
                  <th className="border-b border-slate-800 p-3">Bib</th>
                  <th className="border-b border-slate-800 p-3">Tag ID</th>
                  <th className="border-b border-slate-800 p-3">Tours</th>
                  <th className="border-b border-slate-800 p-3">Statut</th>
                  <th className="border-b border-slate-800 p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => {
                  const editRow = editingRows[participant.id]
                  const isListening =
                    listeningForTag === participant.id

                  return (
                    <tr className="align-top" key={participant.id}>
                      <td className="border-b border-slate-800 p-3">
                        {editRow ? (
                          <input
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                            onChange={(event) =>
                              setEditingRows((rows) => ({
                                ...rows,
                                [participant.id]: {
                                  ...rows[participant.id],
                                  name: event.target.value,
                                },
                              }))
                            }
                            value={editRow.name}
                          />
                        ) : (
                          <div className="flex items-center gap-2 font-semibold text-white">
                            <span
                              className="size-3 rounded-full"
                              style={{ backgroundColor: participant.color }}
                            />
                            {participant.name}
                          </div>
                        )}
                      </td>
                      <td className="border-b border-slate-800 p-3">
                        {editRow ? (
                          <input
                            className="w-24 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                            onChange={(event) =>
                              setEditingRows((rows) => ({
                                ...rows,
                                [participant.id]: {
                                  ...rows[participant.id],
                                  bibNumber: event.target.value,
                                },
                              }))
                            }
                            value={editRow.bibNumber}
                          />
                        ) : (
                          participant.bibNumber
                        )}
                      </td>
                      <td className="border-b border-slate-800 p-3">
                        <div className="flex min-w-56 gap-2">
                          <input
                            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
                            onChange={(event) =>
                              setManualTags((tags) => ({
                                ...tags,
                                [participant.id]: event.target.value,
                              }))
                            }
                            placeholder={participant.tagId || 'Tag ID'}
                            value={manualTags[participant.id] ?? ''}
                          />
                          <button
                            className="rounded-md border border-slate-700 px-3 py-2 text-slate-200 transition hover:border-lime-300 hover:text-lime-300"
                            onClick={() => handleAssignManualTag(participant.id)}
                            type="button"
                          >
                            OK
                          </button>
                        </div>
                        <button
                          className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-lime-300 hover:text-lime-300"
                          onClick={() => startListeningForTag(participant.id)}
                          type="button"
                        >
                          {isListening ? (
                            <span className="size-3 animate-spin rounded-full border-2 border-lime-300 border-t-transparent" />
                          ) : null}
                          Scanner le prochain tag
                        </button>
                      </td>
                      <td className="border-b border-slate-800 p-3">{participant.laps.length}</td>
                      <td className="border-b border-slate-800 p-3">
                        {statusLabels[participant.status]}
                      </td>
                      <td className="border-b border-slate-800 p-3">
                        <div className="flex flex-wrap gap-2">
                          {editRow ? (
                            <button
                              className="rounded-md bg-lime-300 px-3 py-2 font-semibold text-slate-950"
                              onClick={() => handleSaveEdit(participant.id)}
                              type="button"
                            >
                              Sauver
                            </button>
                          ) : (
                            <button
                              className="rounded-md border border-slate-700 px-3 py-2 text-slate-200"
                              onClick={() => handleStartEdit(participant)}
                              type="button"
                            >
                              Éditer
                            </button>
                          )}
                          <button
                            className="rounded-md border border-red-400/40 px-3 py-2 text-red-300"
                            onClick={() => markDNF(participant.id)}
                            type="button"
                          >
                            DNF
                          </button>
                          <button
                            className="rounded-md border border-red-400/40 px-3 py-2 text-red-300"
                            onClick={() => handleDeleteParticipant(participant.id)}
                            type="button"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'gpx' ? (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-2xl font-bold text-white">GPX Import</h2>
          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-300">Fichier GPX</span>
            <input
              accept=".gpx,application/gpx+xml,text/xml,application/xml"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-lime-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
              onChange={handleGpxFile}
              type="file"
            />
          </label>
          {gpxMessage ? <p className="mt-4 text-lime-300">{gpxMessage}</p> : null}
          {gpxSummary || storedGpxSummary ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
                <dt className="text-sm text-slate-400">Nom du tracé</dt>
                <dd className="mt-1 font-semibold text-white">
                  {(gpxSummary || storedGpxSummary).trackName}
                </dd>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
                <dt className="text-sm text-slate-400">Points</dt>
                <dd className="mt-1 font-semibold text-white">
                  {(gpxSummary || storedGpxSummary).pointCount}
                </dd>
              </div>
            </dl>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'webhook' ? (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-2xl font-bold text-white">Webhook Test</h2>
          <form className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleWebhookSubmit}>
            <label>
              <span className="text-sm font-medium text-slate-300">tag_id</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition focus:border-lime-300 focus:ring-2"
                onChange={(event) =>
                  setWebhookForm((form) => ({ ...form, tag_id: event.target.value }))
                }
                type="text"
                value={webhookForm.tag_id}
              />
            </label>
            <label>
              <span className="text-sm font-medium text-slate-300">timestamp</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-lime-300 transition focus:border-lime-300 focus:ring-2"
                onChange={(event) =>
                  setWebhookForm((form) => ({ ...form, timestamp: event.target.value }))
                }
                type="datetime-local"
                value={webhookForm.timestamp}
              />
            </label>
            <button
              className="self-end rounded-md bg-lime-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSendingWebhook}
              type="submit"
            >
              {isSendingWebhook ? 'Envoi...' : 'Send test'}
            </button>
          </form>
          {listeningForTag ? (
            <p className="mt-4 text-sm text-lime-300">
              Un participant attend le prochain tag non assigné.
            </p>
          ) : null}
          <div className="mt-6 rounded-md border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-white">Tags non reconnus</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Les tags sans participant et sans écoute active apparaissent ici.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-lime-300 hover:text-lime-300"
                onClick={clearUnmatchedTags}
                type="button"
              >
                Effacer
              </button>
            </div>
            {unmatchedTags.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-800 text-sm">
                {unmatchedTags.map((event, index) => (
                  <li
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    key={`${event.tag_id}-${event.timestamp}-${index}`}
                  >
                    <span className="font-mono text-red-300">{event.tag_id}</span>
                    <span className="text-slate-400">{formatDateTime(event.timestamp)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Aucun tag non reconnu.</p>
            )}
          </div>
          {webhookResponse ? (
            <pre className="mt-5 overflow-x-auto rounded-md border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">
              {webhookResponse}
            </pre>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default AdminView
