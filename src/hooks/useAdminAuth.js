import { useAdminStore } from '../store/adminStore.js'

export function useAdminAuth() {
  return useAdminStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    login: state.login,
    logout: state.logout,
  }))
}
