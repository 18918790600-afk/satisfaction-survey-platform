import { useMemo, useState } from 'react'
import { EyeOff, UserCheck, UserX } from 'lucide-react'
import { useStore, cycleLabel, fmtTime } from '../../lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { cn } from '../../lib/utils'

const STATUS_LABEL = { active: '进行中', closed: '已核算', published: '已公示' } as const

export default function ParticipationPage() {
  const { db } = useStore()
  const cycles = useMemo(() => [...db.cycles].sort((a, b) => b.month.localeCompare(a.month)), [db])
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? '')
  const cycle = cycles.find((c) => c.id === cycleId) ?? cycles[0]

  const evaluators = db.employees.filter((e) => e.role === 'employee')
  const joined = useMemo(
    () => (cycle ? db.participations.filter((p) => p.cycleId === cycle.id) : []),
    [db, cycle],
  )
  const joinedIds = new Set(joined.map((p) => p.employeeId))
  const rate = cycle ? Math.round((joined.length / evaluators.length) * 100) : 0
  const missed = evaluators.filter((e) => !joinedIds.has(e.id))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">参与情况</h1>
          <p className="text-sm text-muted-foreground mt-1">自动统计发放、回收与未参与名单，供各支撑岗位知悉。</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cycle && <Badge variant="secondary">{STATUS_LABEL[cycle.status]}</Badge>}
          <Select value={cycle?.id} onValueChange={setCycleId}>
            <SelectTrigger className="w-full sm:w-44 max-w-full">
              <SelectValue placeholder="选择周期" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {cycleLabel(c)}（{STATUS_LABEL[c.status]}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
        <EyeOff className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed text-blue-900">
          本页仅展示<span className="font-medium">参与状态与数量</span>
          ，不关联任何打分内容与打分倾向，评价明细全程匿名。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">发放总份数</p>
            <p className="num text-3xl font-bold mt-1">{evaluators.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">有效回收</p>
            <p className="num text-3xl font-bold mt-1 text-emerald-600">{joined.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">未参与</p>
            <p className="num text-3xl font-bold mt-1 text-red-600">{missed.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">回收率</span>
            <span className="num text-muted-foreground">{rate}%</span>
          </div>
          <Progress value={rate} className="h-2.5" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">参与明细 · {cycle ? cycleLabel(cycle) : ''}</CardTitle>
          <CardDescription>未参与员工将由系统自动记录并在周期结束时下调打分权重。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工号</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>参与状态</TableHead>
                <TableHead>提交时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluators.map((e) => {
                const p = joined.find((x) => x.employeeId === e.id)
                return (
                  <TableRow key={e.id} className={cn(!p && 'bg-red-50/50')}>
                    <TableCell className="num text-muted-foreground">{e.account}</TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>
                      {p ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200" variant="outline">
                          <UserCheck className="w-3 h-3 mr-1" />
                          已参与
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                          <UserX className="w-3 h-3 mr-1" />
                          未参与
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="num text-muted-foreground">{p ? fmtTime(p.at) : '—'}</TableCell>
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
