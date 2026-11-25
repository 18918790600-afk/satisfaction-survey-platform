import { useMemo, useState } from 'react'
import { UserCog, UserPlus, KeyRound, Trash2, ShieldCheck, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../lib/store'
import { JOB_LABELS, type Employee } from '../../lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog'

const DEFAULT_PASSWORD = '123456'

export default function Users() {
  const { db, currentUser, addEmployee, removeEmployee, updateEmployee } = useStore()

  const people = useMemo(
    () =>
      [...db.employees].sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
        return a.account.localeCompare(b.account)
      }),
    [db],
  )

  const joinCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of db.participations) m.set(p.employeeId, (m.get(p.employeeId) ?? 0) + 1)
    return m
  }, [db])

  /* ---------- 新增人员表单 ---------- */
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [role, setRole] = useState<'employee' | 'admin'>('employee')

  const submitAdd = () => {
    const r = addEmployee({ name, account, password, role })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(`已新增${role === 'admin' ? '管理员' : '参评员工'} ${name.trim()}`)
    setName('')
    setAccount('')
    setPassword(DEFAULT_PASSWORD)
    setRole('employee')
    setFormOpen(false)
  }

  const changeRole = (emp: Employee, next: 'admin' | 'employee') => {
    const r = updateEmployee(emp.id, { role: next })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(
      next === 'admin'
        ? `${emp.name} 已调整为管理员`
        : `${emp.name} 已调整为参评员工`,
    )
  }

  const resetPassword = (emp: Employee) => {
    const r = updateEmployee(emp.id, { password: DEFAULT_PASSWORD })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(`已将 ${emp.name} 的密码重置为 ${DEFAULT_PASSWORD}`)
  }

  const doRemove = (emp: Employee) => {
    const r = removeEmployee(emp.id)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(`已删除 ${emp.name}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">人员管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            维护参评员工与管理员账号：新增、删除、调整角色、重置密码。
          </p>
        </div>
        <Button onClick={() => setFormOpen((v) => !v)}>
          <UserPlus className="w-4 h-4 mr-1.5" />
          新增人员
        </Button>
      </div>

      {/* 新增人员 */}
      {formOpen && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">新增人员</CardTitle>
            <CardDescription>工号用于登录，需全局唯一；新参评员工初始权重为 1.00。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="u-name">姓名</Label>
                <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：王小明" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-account">工号（登录账号）</Label>
                <Input id="u-account" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="如：KF013" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-password">初始密码</Label>
                <Input id="u-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'employee' | 'admin')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">参评员工</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button onClick={submitAdd}>确认新增</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 人员列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            全部人员（{people.length} 人）
          </CardTitle>
          <CardDescription>
            参评员工参与每月满意度打分；管理员负责周期操作与结果公示，不参与打分。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工号</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="text-right">当前权重</TableHead>
                <TableHead className="text-right">累计参与</TableHead>
                <TableHead className="text-right w-64">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((emp) => {
                const isSelf = emp.id === currentUser?.id
                const linkedStaff = db.staff.find((s) => s.employeeId === emp.id)
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="num text-muted-foreground">{emp.account}</TableCell>
                    <TableCell className="font-medium">
                      {emp.name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground">（我）</span>
                      )}
                      {linkedStaff && (
                        <Badge
                          variant="outline"
                          className="ml-1.5 bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 font-normal"
                          title={`该员工同时是本周期的被评价对象，打分时系统自动回避本人评分项`}
                        >
                          兼被评·{JOB_LABELS[linkedStaff.job]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200" variant="outline">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          管理员
                        </Badge>
                      ) : (
                        <Select
                          value={emp.role}
                          onValueChange={(v) => changeRole(emp, v as 'admin' | 'employee')}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">参评员工</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right num">
                      {emp.role === 'employee' ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          {emp.weight.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right num text-muted-foreground">
                      {emp.role === 'employee' ? `${joinCount.get(emp.id) ?? 0} 次` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetPassword(emp)}
                          title={`重置为 ${DEFAULT_PASSWORD}`}
                        >
                          <KeyRound className="w-3.5 h-3.5 mr-1" />
                          重置密码
                        </Button>
                        {!isSelf && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                删除
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除 {emp.name}？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  将删除该账号（{emp.account}）及其 {joinCount.get(emp.id) ?? 0} 条参与记录。
                                  {linkedStaff && `该员工同时关联着被评岗位人员「${linkedStaff.name}」，删除后关联将自动解除。`}
                                  已提交的匿名评价不含身份信息，会作为历史数据保留。此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => doRemove(emp)}>
                                  确认删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
