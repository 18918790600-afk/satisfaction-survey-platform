import { NavLink, Outlet, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  BarChart3,
  Users,
  UserCog,
  Headset,
  Scale,
  ScrollText,
  LogOut,
  Star,
} from 'lucide-react'
import { useStore } from '../../lib/store'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/admin', label: '工作台', icon: LayoutDashboard, end: true },
  { to: '/admin/results', label: '评价结果', icon: BarChart3, end: false },
  { to: '/admin/participation', label: '参与情况', icon: Users, end: false },
  { to: '/admin/users', label: '人员管理', icon: UserCog, end: false },
  { to: '/admin/staff', label: '岗位人员', icon: Headset, end: false },
  { to: '/admin/weights', label: '权重管理', icon: Scale, end: false },
  { to: '/admin/logs', label: '操作日志', icon: ScrollText, end: false },
]

export default function AdminLayout() {
  const { currentUser, logout } = useStore()
  const navigate = useNavigate()
  if (!currentUser) return null

  return (
    <div className="min-h-dvh flex">
      {/* 侧边栏 */}
      <aside className="w-60 shrink-0 bg-[#12224a] text-white flex flex-col min-h-dvh sticky top-0">
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
            <Star className="w-4.5 h-4.5 text-blue-300" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide leading-tight">满意度自动测评平台</p>
            <p className="text-[11px] text-blue-200/50 mt-0.5">管理端</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-blue-200/70 hover:text-white hover:bg-white/10',
                )
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{currentUser.name}</p>
              <p className="text-[11px] text-blue-200/50 mt-0.5">超级管理员</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-blue-200/70 hover:text-white hover:bg-white/10"
              aria-label="退出登录"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 min-w-0 px-6 py-6 max-w-[1200px]">
        <Outlet />
      </main>
    </div>
  )
}
