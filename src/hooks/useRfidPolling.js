import { useEffect } from 'react'
import { useToast } from './useToast.js'
import { useRaceStore } from '../store/raceStore.js'

const POLLING_INTERVAL_MS = 2_000

const getEventTimestamp = (event) => event.timestamp || new Date().toISOString()

const handleRfidEvent = (event, addToast) => {
  const tagId = String(event.tag_id ?? '').trim()

  if (!tagId) {
    return
  }

  const state = useRaceStore.getState()
  const matchedParticipant = state.participants.find(
    (participant) => participant.tagId === tagId,
  )

  if (matchedParticipant) {
    state.recordLapArrival(matchedParticipant.id, getEventTimestamp(event))
    addToast({
      message: `Tour enregistré pour ${matchedParticipant.name}`,
      type: 'green',
    })
    return
  }

  const listeningParticipantId =
    state.listeningForTag || state.pendingTagAssignmentParticipantId

  if (listeningParticipantId) {
    state.assignTag(listeningParticipantId, tagId)
    return
  }

  state.addUnmatchedTag({
    tag_id: tagId,
    timestamp: getEventTimestamp(event),
  })
  addToast({
    message: `Tag non reconnu : ${tagId}`,
    type: 'orange',
  })
}

export function useRfidPolling() {
  const { addToast } = useToast()

  useEffect(() => {
    let isActive = true
    let isPolling = false

    const poll = async () => {
      if (isPolling) {
        return
      }

      isPolling = true

      try {
        const response = await fetch('/.netlify/functions/rfid', {
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()

        if (!isActive || !Array.isArray(data.events)) {
          return
        }

        data.events.forEach((event) => handleRfidEvent(event, addToast))
      } catch {
        // The endpoint is unavailable during plain Vite dev; Netlify serves it in deployment.
      } finally {
        isPolling = false
      }
    }

    poll()
    const intervalId = window.setInterval(poll, POLLING_INTERVAL_MS)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [addToast])
}
