import { useCallback, useMemo, useState } from 'react'
import { ToastContext } from '../utils/toastContext.js'

const toastStyles = {
  green: 'border-emerald-400/40 bg-emerald-950 text-emerald-100',
  orange: 'border-orange-400/40 bg-orange-950 text-orange-100',
  red: 'border-red-400/40 bg-red-950 text-red-100',
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    ({ message, type = 'green' }) => {
      const id = crypto.randomUUID()

      setToasts((currentToasts) => [
        ...currentToasts,
        {
          id,
          message,
          type,
        },
      ])

      window.setTimeout(() => dismissToast(id), 4500)
    },
    [dismissToast],
  )

  const contextValue = useMemo(() => ({ addToast }), [addToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed right-4 top-4 z-[1000] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            className={`rounded-lg border px-4 py-3 text-sm shadow-2xl shadow-slate-950/40 ${
              toastStyles[toast.type] || toastStyles.green
            }`}
            key={toast.id}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
