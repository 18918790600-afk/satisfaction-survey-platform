import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Megaphone,
  FileEdit,
  PenLine,
  Calculator,
  Send,
  Zap,
  CircleCheck,
  CircleDot,
  Circle,
  RotateCcw,
} from 'lucide-react'
import { useStore, cycleLabel, fmtTime } from '../../lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'

const PIPELINE = [
  { icon: Megaphone, title: '启动通知', desc: '每月 1 日 09:00 自动推送全员通知邮件' },
  { icon: FileEdit, title: '问卷生成', desc: '按三类工种自动生成专属问卷（每岗位 3 题）' },
  { icon: PenLine, title: '全员作答', desc: '员工匿名打分（唯一人工环节）' },
  { icon: Calculator, title: '自动核算', desc: '25 日 18:00 自动加权核算得分与点评' },
  { icon: Send, title: '结果公示', desc: '26 日自动向全员公示得分与点评' },
]

export default function Overview() {
  const { db, closeCycle, publishCycle, startCycle, resetDemo } = useStore()
  const [confirm, setConfirm] = useState<'close' | 'publish' | 'start' | 'reset' | null>(null)

  const evaluators = db.employees.filter((e) => e.role === 'employee')
  const active = db.cycles.find((c) => c.status === 'active')
  const closable = db.cycles.find((c) => c.status === 'closed')

  const joinedCount = useMemo(
    () => (active ? db.participations.filter((p) => p.cycleId === active.id).length : 0),
    [db, active],
  )
  const rate = active && evaluators.length ? Math.round((joinedCount / evaluators.length) * 100) : 0

  const nextMonth = useMemo(() => {
    const latest = [...db.cycles].sort((a, b) => b.month.localeCompare(a.month))[0]
    const d = latest
      ? new Date(Number(latest.month.slice(0, 4)), Number(latest.month.slice(5)), 1)
      : new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [db.cycles])

  const cycleState = (c: 'active' | 'closed' | 'published', step: number) => {
    // step: 0=启动 1=问卷 2=作答 3=核算 4=公示
    if (c === 'active') return step <= 2 ? 'done' : step === 3 ? 'current' : 'todo'
    if (c === 'closed') return step <= 3 ? 'done' : step === 4 ? 'current' : 'todo'
    return 'done'
  }

  const current = active ?? closable ?? db.cycles[db.cycles.length - 1]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">工作台</h1>
          <p className="text-sm text-muted-foreground mt-1">月度满意度评价全流程自动化运行总览。</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirm('reset')}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          清空全部数据
        </Button>
      </div>

      {!current && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无评价周期数据。可在下方「周期操作」启动新周期，或前往「数据导入」批量导入历史月份数据。
          </CardContent>
        </Card>
      )}

      {/* 自动化流水线 */}
      {current && (
        <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            自动化流程 · {cycleLabel(current)} 周期
            <Badge variant={current.status === 'active' ? 'default' : 'secondary'} className="ml-1">
              {current.status === 'active' ? '评价收集中' : current.status === 'closed' ? '已核算待公示' : '已公示'}
            </Badge>
          </CardTitle>
          <CardDescription>除「全员作答」外，其余环节均由系统定时自动执行，无需人工介入。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {PIPELINE.map((p, i) => {
              const state = cycleState(current.status, i)
              return (
                <div
                  key={p.title}
                  className={
                    'rounded-lg border px-3 py-3 ' +
                    (state === 'current'
                      ? 'border-primary bg-accent'
                      : state === 'done'
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-dashed bg-slate-50')
                  }
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {state === 'done' ? (
                      <CircleCheck className="w-4 h-4 text-emerald-600" />
                    ) : state === 'current' ? (
                      <CircleDot className="w-4 h-4 text-primary" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300" />
                    )}
                    <span className="text-sm font-medium">{p.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '评价发放', value: active ? evaluators.length : '—', unit: '份', sub: active ? cycleLabel(active) : '' },
          { label: '有效回收', value: active ? joinedCount : '—', unit: '份', sub: active ? '全天候自动收集' : '' },
          { label: '回收率', value: active ? rate : '—', unit: '%', sub: active ? '实时统计' : '' },
          { label: '匿名提交', value: db.submissions.filter((s) => s.cycleId === current.id).length, unit: '条', sub: '打分明细（已脱敏）' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1">
                <span className="num text-3xl font-bold">{s.value}</span>
                <span className="text-sm text-muted-foreground ml-1">{s.unit}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {active && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="font-medium">{cycleLabel(active)} 回收进度</span>
              <span className="num text-muted-foreground">
                {joinedCount} / {evaluators.length} 人
              </span>
            </div>
            <Progress value={rate} className="h-2.5" />
            <p className="text-xs text-muted-foreground mt-2">
              周期启动于 {fmtTime(active.startedAt)} · 系统每日 09:30 自动向未参与员工发送提醒。
            </p>
          </CardContent>
        </Card>
      )}
        </>
      )}

      {/* 操作区 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">周期操作</CardTitle>
          <CardDescription>以下操作通常由系统定时自动执行，此处保留人工触发入口（全程留痕）。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button className="w-full sm:w-auto" disabled={!active} onClick={() => setConfirm('close')}>
            <Calculator className="w-4 h-4 mr-1.5" />
            结束本月评价并核算得分
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" disabled={!closable} onClick={() => setConfirm('publish')}>
            <Send className="w-4 h-4 mr-1.5" />
            公示评价结果
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" disabled={!!active} onClick={() => setConfirm('start')}>
            <Megaphone className="w-4 h-4 mr-1.5" />
            启动 {nextMonth.slice(0, 4)} 年 {Number(nextMonth.slice(5))} 月评价
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'close' && '结束本月评价并核算？'}
              {confirm === 'publish' && '公示评价结果？'}
              {confirm === 'start' && '启动新评价周期？'}
              {confirm === 'reset' && '清空全部数据？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'close' &&
                '结束后员工将无法继续作答。系统将自动核算各岗位加权得分、生成月度点评，并调整全员打分权重（参与者 +0.05，未参与者 -0.10）。'}
              {confirm === 'publish' && '公示后全员即可在「结果公示」页查看各岗位得分与点评，系统将自动发送全员告知邮件。'}
              {confirm === 'start' && `将创建 ${nextMonth} 评价周期，自动生成分岗位问卷并推送全员通知。`}
              {confirm === 'reset' &&
                '将删除全部周期、评分、参与记录、员工与岗位人员数据，仅保留管理员账号（admin / admin123）。此操作不可恢复，会记录日志。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === 'close' && active) {
                  closeCycle(active.id)
                  toast.success('周期已结束，得分与权重已自动核算。')
                } else if (confirm === 'publish' && closable) {
                  publishCycle(closable.id)
                  toast.success('评价结果已向全员公示。')
                } else if (confirm === 'start') {
                  startCycle(nextMonth)
                  toast.success(`${nextMonth} 评价周期已启动。`)
                } else if (confirm === 'reset') {
                  resetDemo()
                  toast.success('全部数据已清空，仅保留管理员账号。')
                }
                setConfirm(null)
              }}
            >
              确认执行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
