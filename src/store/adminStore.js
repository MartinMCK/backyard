import { create } from 'zustand'
import { getStoredAdminPin } from '../utils/adminPin.js'

export const useAdminStore = create((set) => ({
  isAuthenticated: false,
  login: (pin) => {
    const isValid = pin === getStoredAdminPin()
    set({ isAuthenticated: isValid })
    return isValid
  },
  logout: () => set({ isAuthenticated: false }),
}))
