import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const COLOR_PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#64748b',
  '#78716c',
  '#0891b2',
]

const initialRaceConfig = {
  raceName: 'Backyard Ultra Tracker',
  startTime: null,
  lapDurationMinutes: 60,
  isStarted: false,
  gpxData: null,
}

const createParticipant = (name, bibNumber, color) => ({
  id: crypto.randomUUID(),
  name,
  bibNumber,
  tagId: null,
  color,
  laps: [],
  status: 'waiting',
  dnfManual: false,
})

const getLapNumberForTime = (startTime, lapDurationMinutes, time) => {
  if (!startTime || !lapDurationMinutes) {
    return 0
  }

  const startMs = new Date(startTime).getTime()
  const timeMs = new Date(time).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(timeMs) || timeMs < startMs) {
    return 0
  }

  const lapDurationMs = lapDurationMinutes * 60 * 1000
  return Math.floor((timeMs - startMs) / lapDurationMs) + 1
}

const getNextColor = (participants) => {
  const usedColors = new Set(participants.map((participant) => participant.color))
  const availableColor = COLOR_PALETTE.find((color) => !usedColors.has(color))

  if (availableColor) {
    return availableColor
  }

  return COLOR_PALETTE[participants.length % COLOR_PALETTE.length]
}

export const useRaceStore = create(
  persist(
    (set, get) => ({
      participants: [],
      raceConfig: initialRaceConfig,
      listeningForTag: null,
      pendingTagAssignmentParticipantId: null,
      unmatchedTags: [],

      initRace: (startTime, lapDurationMinutes) =>
        set((state) => ({
          raceConfig: {
            ...state.raceConfig,
            startTime,
            lapDurationMinutes,
            isStarted: true,
          },
          participants: state.participants.map((participant) => ({
            ...participant,
            status: participant.status === 'waiting' ? 'running' : participant.status,
          })),
        })),

      resetRace: () =>
        set((state) => ({
          participants: [],
          raceConfig: {
            ...initialRaceConfig,
            raceName: state.raceConfig.raceName || initialRaceConfig.raceName,
          },
          listeningForTag: null,
          pendingTagAssignmentParticipantId: null,
          unmatchedTags: [],
        })),

      addParticipant: (name, bibNumber) =>
        set((state) => ({
          participants: [
            ...state.participants,
            createParticipant(name, bibNumber, getNextColor(state.participants)),
          ],
        })),

      updateParticipant: (id, fields) =>
        set((state) => ({
          participants: state.participants.map((participant) =>
            participant.id === id ? { ...participant, ...fields } : participant,
          ),
        })),

      removeParticipant: (id) =>
        set((state) => ({
          participants: state.participants.filter((participant) => participant.id !== id),
        })),

      assignTag: (participantId, tagId) =>
        set((state) => ({
          listeningForTag:
            state.listeningForTag === participantId ? null : state.listeningForTag,
          pendingTagAssignmentParticipantId:
            state.pendingTagAssignmentParticipantId === participantId
              ? null
              : state.pendingTagAssignmentParticipantId,
          participants: state.participants.map((participant) =>
            participant.id === participantId ? { ...participant, tagId } : participant,
          ),
        })),

      startListeningForTag: (participantId) =>
        set({
          listeningForTag: participantId,
          pendingTagAssignmentParticipantId: participantId,
        }),

      stopListeningForTag: () =>
        set({
          listeningForTag: null,
          pendingTagAssignmentParticipantId: null,
        }),

      assignPendingTag: (tagId) =>
        set((state) => {
          const listeningParticipantId =
            state.listeningForTag || state.pendingTagAssignmentParticipantId

          if (!listeningParticipantId) {
            return state
          }

          const tagAlreadyAssigned = state.participants.some(
            (participant) => participant.tagId === tagId,
          )

          if (tagAlreadyAssigned) {
            return state
          }

          return {
            listeningForTag: null,
            pendingTagAssignmentParticipantId: null,
            participants: state.participants.map((participant) =>
              participant.id === listeningParticipantId
                ? { ...participant, tagId }
                : participant,
            ),
          }
        }),

      addUnmatchedTag: (event) =>
        set((state) => ({
          unmatchedTags: [
            {
              tag_id: event.tag_id,
              timestamp: event.timestamp,
            },
            ...state.unmatchedTags,
          ].slice(0, 50),
        })),

      clearUnmatchedTags: () => set({ unmatchedTags: [] }),

      recordLapArrival: (participantId, arrivalTime) =>
        set((state) => {
          const { startTime, lapDurationMinutes } = state.raceConfig
          const lapNumber = getLapNumberForTime(
            startTime,
            lapDurationMinutes,
            arrivalTime,
          )

          return {
            participants: state.participants.map((participant) => {
              if (participant.id !== participantId) {
                return participant
              }

              return {
                ...participant,
                laps: [...participant.laps, { lapNumber, arrivalTime }],
                status: participant.status === 'dnf' ? 'dnf' : 'running',
              }
            }),
          }
        }),

      markDNF: (participantId) =>
        get().updateParticipant(participantId, {
          status: 'dnf',
          dnfManual: true,
        }),

      setGpxData: (gpxString) =>
        set((state) => ({
          raceConfig: {
            ...state.raceConfig,
            gpxData: gpxString,
          },
        })),

      setRaceName: (raceName) =>
        set((state) => ({
          raceConfig: {
            ...state.raceConfig,
            raceName: raceName || initialRaceConfig.raceName,
          },
        })),

      getCurrentLapNumber: () => {
        const { startTime, lapDurationMinutes, isStarted } = get().raceConfig

        if (!isStarted) {
          return 0
        }

        return getLapNumberForTime(startTime, lapDurationMinutes, new Date().toISOString())
      },

      getNextLapStartTime: () => {
        const { startTime, lapDurationMinutes, isStarted } = get().raceConfig
        const currentLapNumber = get().getCurrentLapNumber()

        if (!isStarted || !startTime || currentLapNumber === 0) {
          return null
        }

        const startMs = new Date(startTime).getTime()
        const lapDurationMs = lapDurationMinutes * 60 * 1000
        return new Date(startMs + currentLapNumber * lapDurationMs).toISOString()
      },

      checkAndMarkDNFs: () =>
        set((state) => {
          if (!state.raceConfig.isStarted) {
            return state
          }

          const currentLapNumber = getLapNumberForTime(
            state.raceConfig.startTime,
            state.raceConfig.lapDurationMinutes,
            new Date().toISOString(),
          )

          if (currentLapNumber <= 1) {
            return state
          }

          const requiredCompletedLap = currentLapNumber - 1
          const participants = state.participants.map((participant) => {
            if (participant.status !== 'running') {
              return participant
            }

            const lastLap = participant.laps.at(-1)

            if (lastLap?.lapNumber === requiredCompletedLap) {
              return participant
            }

            return {
              ...participant,
              status: 'dnf',
              dnfManual: false,
            }
          })

          return { participants }
        }),
    }),
    {
      name: 'backyard-ultra-tracker-race',
    },
  ),
)

export { COLOR_PALETTE }
