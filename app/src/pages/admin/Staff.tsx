import { useMemo, useState } from 'react'
import { Headset, UserPlus, Trash2, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../lib/store'
import { JOB_LABELS, JOB_ORDER, type JobType, type SupportStaff } from '../../lib/types'
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

const NONE = '__none__'

export default function Staff() {
  const { db, addStaff, updateStaff, removeStaff } = useStore()

  const staffList = useMemo(
    () => [...db.staff].sort((a, b) => JOB_ORDER.indexOf(a.job) - JOB_ORDER.indexOf(b.job)),
    [db],
  )

  const receivedCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of db.submissions) m.set(s.staffId, (m.get(s.staffId) ?? 0) + 1)
    return m
  }, [db])

  /* ---------- 新增表单 ---------- */
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [job, setJob] = useState<JobType>('platform')
  const [link, setLink] = useState<string>(NONE)

  const submitAdd = () => {
    const r = addStaff({ name, job, employeeId: link === NONE ? undefined : link })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(`已新增被评对象 ${name.trim()}`)
    setName('')
    setJob('platform')
    setLink(NONE)
    setFormOpen(false)
  }

  const changeJob = (st: SupportStaff, next: JobType) => {
    const r = updateStaff(st.id, { job: next })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(`${st.name} 的岗位已调整为${JOB_LABELS[next]}`)
  }

  const changeLink = (st: SupportStaff, next: string) => {
    const r = updateStaff(st.id, { employeeId: next === NONE ? null : next })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    if (next === NONE) {
      toast.success(`已取消 ${st.name} 的参评账号关联`)
    } else {
      const emp = db.employees.find((e) => e.id === next)
      toast.success(`已关联 ${emp?.name ?? ''}，其打分时将自动回避`)
    }
  }

  const doRemove = (st: SupportStaff) => {
    const r = removeStaff(st.id)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(`已删除 ${st.name}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">岗位人员管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            维护被评价的支撑岗位人员：新增、调整岗位、关联参评账号（自动回避）、删除。
          </p>
        </div>
        <Button onClick={() => setFormOpen((v) => !v)}>
          <UserPlus className="w-4 h-4 mr-1.5" />
          新增岗位人员
        </Button>
      </div>

      {/* 新增 */}
      {formOpen && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">新增岗位人员</CardTitle>
            <CardDescription>
              若该人员同时拥有参评账号，关联后其打分时系统自动回避（不能自评）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">姓名</Label>
                <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：王丽娟" />
              </div>
              <div className="space-y-1.5">
                <Label>所属岗位</Label>
                <Select value={job} onValueChange={(v) => setJob(v as JobType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_ORDER.map((j) => (
                      <SelectItem key={j} value={j}>
                        {JOB_LABELS[j]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>关联参评账号（选填）</Label>
                <Select value={link} onValueChange={setLink}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>不关联</SelectItem>
                    {db.employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}（{e.account}）
                      </SelectItem>
                    ))}
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

      {/* 列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Headset className="w-4 h-4 text-primary" />
            被评岗位人员（{staffList.length} 人）
          </CardTitle>
          <CardDescription>
            名单即评价问卷的对象范围；跨周期轮换时在此调整。删除已收到评价的人员时，其历史评价记录将一并清除。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>所属岗位</TableHead>
                <TableHead>关联参评账号</TableHead>
                <TableHead className="text-right">累计收到评价</TableHead>
                <TableHead className="text-right w-32">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map((st) => {
                const linked = st.employeeId ? db.employees.find((e) => e.id === st.employeeId) : null
                const count = receivedCount.get(st.id) ?? 0
                return (
                  <TableRow key={st.id}>
                    <TableCell className="font-medium">{st.name}</TableCell>
                    <TableCell>
                      <Select value={st.job} onValueChange={(v) => changeJob(st, v as JobType)}>
                        <SelectTrigger className="w-44 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_ORDER.map((j) => (
                            <SelectItem key={j} value={j}>
                              {JOB_LABELS[j]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select value={st.employeeId ?? NONE} onValueChange={(v) => changeLink(st, v)}>
                          <SelectTrigger className="w-48 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>不关联</SelectItem>
                            {db.employees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name}（{e.account}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {linked && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 font-normal shrink-0"
                          >
                            <Link2 className="w-3 h-3 mr-1" />
                            自动回避
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right num text-muted-foreground">{count} 份</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            删除
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除 {st.name}？</AlertDialogTitle>
                            <AlertDialogDescription>
                              {count > 0
                                ? `该人员已收到 ${count} 份历史评价，删除后这些评价记录将一并清除，历史月份结果中不再显示该人员。此操作不可撤销。`
                                : '删除后新问卷将不再包含该人员。此操作不可撤销。'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => doRemove(st)}>确认删除</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
