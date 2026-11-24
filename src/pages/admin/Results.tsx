import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { useStore, computeResults, cycleLabel } from '../../lib/store'
import { JOB_LABELS, JOB_ORDER, type JobType } from '../../lib/types'
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
import { MessageSquareQuote } from 'lucide-react'

const STATUS_LABEL = { active: '进行中', closed: '已核算', published: '已公示' } as const
const JOB_COLORS: Record<JobType, string> = {
  platform: '#2f5fd0',
  network: '#0e9f8a',
  complaint: '#d97706',
}

export default function Results() {
  const { db } = useStore()
  const cycles = useMemo(() => [...db.cycles].sort((a, b) => b.month.localeCompare(a.month)), [db])
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? '')
  const cycle = cycles.find((c) => c.id === cycleId) ?? cycles[0]
  const results = useMemo(() => (cycle ? computeResults(db, cycle.id) : []), [db, cycle])

  const barData = results.map((r) => ({
    name: db.staff.find((s) => s.id === r.staffId)?.name ?? r.staffId,
    加权得分: r.weightedAvg,
    原始均分: r.rawAvg,
    job: r.job,
  }))

  const trendData = useMemo(() => {
    const asc = [...db.cycles].sort((a, b) => a.month.localeCompare(b.month))
    return asc.map((c) => {
      const rs = computeResults(db, c.id)
      const row: Record<string, number | string> = { month: `${Number(c.month.slice(5))}月` }
      for (const job of JOB_ORDER) {
        const list = rs.filter((r) => r.job === job && r.count > 0)
        row[JOB_LABELS[job]] = list.length
          ? Math.round((list.reduce((a, r) => a + r.weightedAvg, 0) / list.length) * 100) / 100
          : 0
      }
      return row
    })
  }, [db])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">评价结果</h1>
          <p className="text-sm text-muted-foreground mt-1">按评价人权重自动加权核算，匿名评论摘录展示。</p>
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

      {/* 得分图表 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">岗位人员得分 · {cycle ? cycleLabel(cycle) : ''}</CardTitle>
            <CardDescription>加权得分按评价人权重计算，弱化长期不参与者的影响。</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="加权得分" fill="#2f5fd0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="原始均分" fill="#b9c8ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">三类工种月度趋势</CardTitle>
            <CardDescription>各工种加权平均得分的逐月变化。</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[3, 5]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {JOB_ORDER.map((job) => (
                  <Line
                    key={job}
                    type="monotone"
                    dataKey={JOB_LABELS[job]}
                    stroke={JOB_COLORS[job]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 明细表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">得分明细 · {cycle ? cycleLabel(cycle) : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>岗位</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead className="text-right">有效评价</TableHead>
                <TableHead className="text-right">加权得分</TableHead>
                <TableHead className="text-right">原始均分</TableHead>
                <TableHead className="text-right">环比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => {
                const st = db.staff.find((s) => s.id === r.staffId)!
                const idx = cycles.findIndex((c) => c.id === cycle?.id)
                const prev = cycles[idx + 1]
                const prevR = prev ? computeResults(db, prev.id).find((x) => x.staffId === r.staffId) : undefined
                const diff =
                  prev && prev.status !== 'active' && r.count > 0 && prevR && prevR.count > 0
                    ? Math.round((r.weightedAvg - prevR.weightedAvg) * 100) / 100
                    : null
                return (
                  <TableRow key={r.staffId}>
                    <TableCell className="text-muted-foreground">{JOB_LABELS[r.job]}</TableCell>
                    <TableCell className="font-medium">{st.name}</TableCell>
                    <TableCell className="text-right num">{r.count} 份</TableCell>
                    <TableCell className="text-right num font-semibold text-primary">{r.count ? r.weightedAvg.toFixed(2) : '—'}</TableCell>
                    <TableCell className="text-right num">{r.count ? r.rawAvg.toFixed(2) : '—'}</TableCell>
                    <TableCell className="text-right num">
                      {diff === null ? (
                        '—'
                      ) : (
                        <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {diff >= 0 ? '+' : ''}
                          {diff.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 月度点评 + 匿名评论 */}
      {cycle && db.summaries[cycle.id] && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">系统自动生成 · 月度点评</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed space-y-1.5 text-slate-700">
            {db.summaries[cycle.id].split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-primary" />
            匿名评价摘录
          </CardTitle>
          <CardDescription>仅展示评论内容与所属岗位，不含任何评价人身份信息。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results
            .filter((r) => r.comments.length > 0)
            .map((r) => {
              const st = db.staff.find((s) => s.id === r.staffId)!
              return (
                <div key={r.staffId} className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-2">
                    {st.name} <span className="text-xs text-muted-foreground font-normal">· {r.comments.length} 条</span>
                  </p>
                  <div className="space-y-2">
                    {r.comments.slice(0, 4).map((c, i) => (
                      <p key={i} className="text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2 leading-relaxed">
                        {c}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          {results.every((r) => r.comments.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-full py-6 text-center">本周期暂无文字评价。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
