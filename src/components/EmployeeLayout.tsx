import { NavLink, useNavigate } from 'react-router'
import { ClipboardCheck, BarChart3, LogOut, Star } from 'lucide-react'
import { useStore } from '../lib/store'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import type { ReactNode } from 'react'

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { currentUser, logout } = useStore()
  const navigate = useNavigate()
  if (!currentUser) return null

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-[#12224a] text-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 min-h-14 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Star className="w-5 h-5 text-blue-300" />
            <span className="font-semibold tracking-wide whitespace-nowrap">满意度自动测评平台</span>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { to: '/evaluate', label: '评价打分', icon: ClipboardCheck },
              { to: '/results', label: '结果公示', icon: BarChart3 },
            ].map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 px-3 h-9 rounded-md text-sm whitespace-nowrap transition-colors',
                    isActive ? 'bg-white/15 text-white' : 'text-blue-200/80 hover:text-white hover:bg-white/10',
                  )
                }
              >
                <it.icon className="w-4 h-4" />
                {it.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-blue-200/80 whitespace-nowrap">
              {currentUser.name} · 权重 <span className="num font-semibold text-white">{currentUser.weight.toFixed(2)}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-200/80 hover:text-white hover:bg-white/10"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              <LogOut className="w-4 h-4 mr-1" />
              退出
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
