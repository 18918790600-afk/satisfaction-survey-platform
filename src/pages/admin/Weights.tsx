import { useMemo, useState } from 'react'
import { Scale, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore, cycleLabel, fmtTime } from '../../lib/store'
import { WEIGHT_RULE } from '../../lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
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

export default function Weights() {
  const { db } = useStore()
  const evaluators = useMemo(
    () => db.employees.filter((e) => e.role === 'employee').sort((a, b) => b.weight - a.weight),
    [db],
  )
  const [selected, setSelected] = useState<string>('all')

  const changes = useMemo(
    () =>
      [...db.weightChanges]
        .sort((a, b) => b.at - a.at)
        .filter((c) => selected === 'all' || c.employeeId === selected),
    [db, selected],
  )

  const weightBadge = (w: number) =>
    w >= 1.05 ? (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200" variant="outline">
        高权重
      </Badge>
    ) : w < 1 ? (
      <Badge variant="outline" className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
        权重下调
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-slate-100 text-slate-600 hover:bg-slate-100">
        标准
      </Badge>
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">权重管理</h1>
        <p className="text-sm text-muted-foreground mt-1">打分权重动态升降，正向激励主动参与、反向约束长期缺席。</p>
      </div>

      {/* 规则说明 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            权重规则
          </CardTitle>
          <CardDescription>系统在每次评价周期核算时自动调整，无需人工干预。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            {[
              { label: '基础权重', value: WEIGHT_RULE.base.toFixed(2), sub: '全员初始值' },
              { label: '参与奖励', value: `+${WEIGHT_RULE.stepUp.toFixed(2)}`, sub: '每月按时参与，累加上调' },
              { label: '缺席扣减', value: `-${WEIGHT_RULE.stepDown.toFixed(2)}`, sub: '当月未参与，自动下调' },
              { label: '权重区间', value: `${WEIGHT_RULE.min.toFixed(1)} – ${WEIGHT_RULE.max.toFixed(1)}`, sub: '低于下限不再扣减' },
            ].map((r) => (
              <div key={r.label} className="rounded-lg border bg-slate-50/60 py-4">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="num text-2xl font-bold mt-1">{r.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.sub}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            加权得分 = Σ（评分 × 评价人权重）÷ Σ（评价人权重）。长期不参与评价的员工，其打分对岗位最终得分的影响将持续弱化。
          </p>
        </CardContent>
      </Card>

      {/* 员工权重表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">员工当前权重</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工号</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead className="text-right">当前权重</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-64">权重水平</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluators.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="num text-muted-foreground">{e.account}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-right num font-semibold">{e.weight.toFixed(2)}</TableCell>
                  <TableCell>{weightBadge(e.weight)}</TableCell>
                  <TableCell>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          e.weight >= 1.05 ? 'bg-emerald-500' : e.weight < 1 ? 'bg-red-500' : 'bg-slate-400',
                        )}
                        style={{ width: `${((e.weight - WEIGHT_RULE.min) / (WEIGHT_RULE.max - WEIGHT_RULE.min)) * 100}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 调整记录 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">权重调整记录</CardTitle>
              <CardDescription>每次周期核算时的全部权重变动，永久留痕。</CardDescription>
            </div>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部员工" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部员工</SelectItem>
                {evaluators.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>员工</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>原因</TableHead>
                <TableHead className="text-right">变动</TableHead>
                <TableHead className="text-right">调整后</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((c) => {
                const emp = db.employees.find((e) => e.id === c.employeeId)
                const cy = db.cycles.find((x) => x.id === c.cycleId)
                return (
                  <TableRow key={c.id}>
                    <TableCell className="num text-muted-foreground">{fmtTime(c.at)}</TableCell>
                    <TableCell className="font-medium">{emp?.name ?? c.employeeId}</TableCell>
                    <TableCell className="text-muted-foreground">{cy ? cycleLabel(cy) : c.cycleId}</TableCell>
                    <TableCell className="text-muted-foreground">{c.reason}</TableCell>
                    <TableCell className="text-right num">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-medium',
                          c.delta >= 0 ? 'text-emerald-600' : 'text-red-600',
                        )}
                      >
                        {c.delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {c.delta >= 0 ? '+' : ''}
                        {c.delta.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right num font-semibold">{c.after.toFixed(2)}</TableCell>
                  </TableRow>
                )
              })}
              {changes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无调整记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
