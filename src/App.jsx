import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import { useRfidPolling } from './hooks/useRfidPolling.js'
import { useToast } from './hooks/useToast.js'
import AdminView from './pages/AdminView.jsx'
import PublicView from './pages/PublicView.jsx'
import { useRaceStore } from './store/raceStore.js'

function App() {
  const checkAndMarkDNFs = useRaceStore((state) => state.checkAndMarkDNFs)
  const { addToast } = useToast()
  useRfidPolling()

  useEffect(() => {
    const checkDnfsWithToast = () => {
      const participantsBeforeCheck = new Map(
        useRaceStore
          .getState()
          .participants.map((participant) => [participant.id, participant.status]),
      )

      checkAndMarkDNFs()

      useRaceStore
        .getState()
        .participants.filter(
          (participant) =>
            participant.status === 'dnf' &&
            !participant.dnfManual &&
            participantsBeforeCheck.get(participant.id) === 'running',
        )
        .forEach((participant) => {
          addToast({
            message: `${participant.name} auto-marqué DNF`,
            type: 'red',
          })
        })
    }

    checkDnfsWithToast()

    const intervalId = window.setInterval(checkDnfsWithToast, 30_000)
    return () => window.clearInterval(intervalId)
  }, [addToast, checkAndMarkDNFs])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<PublicView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
