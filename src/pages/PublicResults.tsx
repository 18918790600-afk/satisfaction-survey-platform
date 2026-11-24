import { useMemo, useState } from 'react'
import EmployeeLayout from '../components/EmployeeLayout'
import { ScoreStars } from '../components/StarRating'
import { useStore, computeResults, cycleLabel } from '../lib/store'
import { JOB_LABELS, JOB_ORDER } from '../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { MessageSquareQuote, Megaphone } from 'lucide-react'

export default function PublicResults() {
  const { db } = useStore()
  const published = useMemo(
    () => db.cycles.filter((c) => c.status === 'published').sort((a, b) => b.month.localeCompare(a.month)),
    [db],
  )
  const [cycleId, setCycleId] = useState<string>(published[0]?.id ?? '')
  const cycle = published.find((c) => c.id === cycleId) ?? published[0]
  const results = useMemo(() => (cycle ? computeResults(db, cycle.id) : []), [db, cycle])

  return (
    <EmployeeLayout>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            评价结果公示
          </h1>
          <p className="text-sm text-muted-foreground mt-1">各支撑岗位月度满意度得分面向全员公开。</p>
        </div>
        {published.length > 0 && (
          <Select value={cycle?.id} onValueChange={setCycleId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {published.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {cycleLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!cycle ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">暂无已公示的评价结果。</CardContent>
        </Card>
      ) : (
        <>
          {db.summaries[cycle.id] && (
            <Card className="mb-6 border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cycleLabel(cycle)} 月度点评</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed space-y-1.5 text-slate-700">
                  {db.summaries[cycle.id].split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {JOB_ORDER.map((job) => {
            const rs = results.filter((r) => r.job === job)
            if (!rs.length) return null
            return (
              <section key={job} className="mb-8">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 rounded bg-primary inline-block" />
                  {JOB_LABELS[job]}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {rs.map((r) => {
                    const st = db.staff.find((s) => s.id === r.staffId)!
                    return (
                      <Card key={r.staffId}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            {st.name}
                            <Badge variant="secondary">有效评价 {r.count} 份</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-end gap-3 mb-3">
                            <span className="num text-4xl font-bold text-primary">{r.weightedAvg.toFixed(2)}</span>
                            <ScoreStars value={r.weightedAvg} className="mb-1.5" />
                          </div>
                          {r.comments.length > 0 && (
                            <div className="mt-3 border-t pt-3 space-y-2">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MessageSquareQuote className="w-3.5 h-3.5" />
                                匿名评价摘录（{r.comments.length} 条）
                              </p>
                              {r.comments.slice(0, 3).map((c, i) => (
                                <p key={i} className="text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2">
                                  {c}
                                </p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </>
      )}
    </EmployeeLayout>
  )
}
