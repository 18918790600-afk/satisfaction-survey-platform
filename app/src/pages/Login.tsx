import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ShieldCheck, Star, KeyRound, User } from 'lucide-react'
import { useStore } from '../lib/store'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function Login() {
  const { login, db } = useStore()
  const navigate = useNavigate()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const doLogin = (acc: string, pwd: string) => {
    setLoading(true)
    setError('')
    const res = login(acc, pwd)
    if (res.ok) {
      const emp = db.employees.find((e) => e.account === acc.trim())
      navigate(emp?.role === 'admin' ? '/admin' : '/evaluate', { replace: true })
    } else {
      setError(res.error ?? '登录失败')
      setLoading(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!account.trim() || !password) {
      setError('请输入账号和密码。')
      return
    }
    doLogin(account, password)
  }

  return (
    <div className="min-h-dvh bg-[#0e1a33] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden shadow-2xl">
        {/* 左侧品牌区 */}
        <div className="hidden md:flex flex-col justify-between bg-[#12224a] text-white p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                <Star className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-wide">满意度自动测评平台</p>
                <p className="text-xs text-blue-200/70 mt-0.5">内部支撑岗位月度评价系统</p>
              </div>
            </div>
            <div className="mt-12 space-y-6">
              {[
                { t: '全流程自动化', d: '通知、问卷、收集、核算、公示全程无人值守' },
                { t: '百分百匿名评价', d: '打分明细与评价人身份完全隔离，可审计可追溯' },
                { t: '权重动态升降', d: '积极参与者话语权提升，长期缺席者权重下调' },
              ].map((f) => (
                <div key={f.t} className="flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{f.t}</p>
                    <p className="text-xs text-blue-200/60 mt-1 leading-relaxed">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-blue-200/40">覆盖平台运营支撑 · 网络终端技术支撑 · 投诉管理（班长）</p>
        </div>

        {/* 右侧登录表单 */}
        <div className="bg-white p-8 md:p-10 flex flex-col justify-center">
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-2xl">登录</CardTitle>
              <CardDescription>请使用工号或管理员账号登录系统</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="account">账号</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="account"
                      placeholder="工号，如 KF001"
                      className="pl-9"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? '登录中…' : '登 录'}
                </Button>
              </form>

              <div className="mt-8 border-t pt-5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAccount('admin')
                      setPassword('admin123')
                    }}
                  >
                    管理员账号一键填充
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  员工账号由管理员在「人员管理」中创建，初始密码默认为 123456。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
