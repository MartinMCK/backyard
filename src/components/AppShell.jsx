import { Link, NavLink } from 'react-router-dom'

const navLinkClass = ({ isActive }) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-lime-300 text-slate-950'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
  ].join(' ')

function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-lg font-semibold text-white">
            Backyard Ultra Tracker
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/" className={navLinkClass}>
              Public
            </NavLink>
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
    </div>
  )
}

export default AppShell
