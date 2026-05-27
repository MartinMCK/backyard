export const ADMIN_PIN_KEY = 'admin_pin'
export const DEFAULT_ADMIN_PIN = '1234'

export function getStoredAdminPin() {
  const storedPin = window.localStorage.getItem(ADMIN_PIN_KEY)

  if (storedPin) {
    return storedPin
  }

  window.localStorage.setItem(ADMIN_PIN_KEY, DEFAULT_ADMIN_PIN)
  return DEFAULT_ADMIN_PIN
}
