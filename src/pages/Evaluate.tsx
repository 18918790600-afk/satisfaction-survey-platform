import { useMemo, useState } from 'react'
import { EyeOff, Send, CheckCircle2, Info, UserX } from 'lucide-react'
import { toast } from 'sonner'
import EmployeeLayout from '../components/EmployeeLayout'
import { StarRating } from '../components/StarRating'
import { useStore, cycleLabel, questionsFor } from '../lib/store'
import { JOB_LABELS, JOB_ORDER } from '../lib/types'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'

export default function Evaluate() {
  const { db, currentUser, submitEvaluation } = useStore()
  const cycle = db.cycles.find((c) => c.status === 'active')

  const [scores, setScores] = useState<Record<string, Record<string, number>>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const submitted = useMemo(
    () =>
      !!cycle &&
      !!currentUser &&
      db.participations.some((p) => p.cycleId === cycle.id && p.employeeId === currentUser.id),
    [db, cycle, currentUser],
  )

  if (!currentUser) return null

  if (!cycle) {
    return (
      <EmployeeLayout>
        <Card className="max-w-xl mx-auto mt-16">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Info className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            当前暂无进行中的评价周期，请等待每月 1 日系统自动启动。
          </CardContent>
        </Card>
      </EmployeeLayout>
    )
  }

  const setScore = (staffId: string, qid: string, v: number) =>
    setScores((prev) => ({ ...prev, [staffId]: { ...prev[staffId], [qid]: v } }))

  // 回避机制：本人若同时是本周期的被评对象，自动从问卷中剔除，不能自评；
  // 完成其余岗位评价即视为正常参与，权重奖励不受影响。
  const selfStaff = db.staff.filter((s) => s.employeeId === currentUser.id)
  const visibleStaff = db.staff.filter((s) => s.employeeId !== currentUser.id)

  const totalQuestions = visibleStaff.length * 3
  const answered = visibleStaff.reduce(
    (acc, st) => acc + questionsFor(db, st.job).filter((q) => scores[st.id]?.[q.id]).length,
    0,
  )
  const allDone = answered === totalQuestions

  const doSubmit = () => {
    const entries = visibleStaff.map((st) => ({
      staffId: st.id,
      scores: questionsFor(db, st.job).map((q) => scores[st.id][q.id]),
      comment: comments[st.id],
    }))
    submitEvaluation(cycle.id, entries)
    setConfirmOpen(false)
    toast.success('评价已匿名提交，感谢您的参与！')
  }

  return (
    <EmployeeLayout>
      {/* 匿名承诺横幅 */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3 mb-6">
        <EyeOff className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed text-blue-900">
          <p className="font-medium">本次评价全程匿名，请放心真实作答</p>
          <p className="text-blue-700/80 mt-0.5">
            系统不记录任何评价人身份与打分明细的对应关系，被评价人及其他管理人员均无法追溯您的打分。按时参与可提升您的打分权重（当前权重{' '}
            <span className="num font-semibold">{currentUser.weight.toFixed(2)}</span>）。
          </p>
        </div>
      </div>

      {/* 回避提示：本人是被评对象时展示 */}
      {selfStaff.length > 0 && !submitted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 mb-6">
          <UserX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed text-amber-900">
            <p className="font-medium">已按回避规则移除对本人的评分项</p>
            <p className="text-amber-700/80 mt-0.5">
              你同时是本周期被评价对象（
              {selfStaff.map((s) => `${s.name} · ${JOB_LABELS[s.job]}`).join('、')}
              ），系统已自动剔除相关题目。完成其余岗位的评价即视为正常参与，权重奖励不受影响。
            </p>
          </div>
        </div>
      )}

      {submitted ? (
        <Card className="max-w-xl mx-auto mt-10">
          <CardContent className="py-14 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
            <p className="text-lg font-semibold">您已完成 {cycleLabel(cycle)} 满意度评价</p>
            <p className="text-sm text-muted-foreground mt-2">
              提交时间已记录，打分内容已匿名脱敏存储。评价结果将于周期结束后统一公示。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-bold">{cycleLabel(cycle)} 内部支撑岗位满意度评价</h1>
              <p className="text-sm text-muted-foreground mt-1">
                请根据本月实际被支撑体验，对以下三类支撑岗位人员进行 1–5 分打分。
              </p>
            </div>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              已完成 <span className="num font-semibold">{answered}</span> / {totalQuestions} 题
            </Badge>
          </div>

          {JOB_ORDER.map((job) => (
            <section key={job} className="mb-8">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded bg-primary inline-block" />
                {JOB_LABELS[job]}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {visibleStaff
                  .filter((s) => s.job === job)
                  .map((st) => (
                    <Card key={st.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          {st.name}
                          <Badge variant="outline" className="font-normal text-xs">
                            {JOB_LABELS[job]}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {questionsFor(db, job).map((q, qi) => (
                          <div key={q.id} className="space-y-1.5">
                            <p className="text-sm leading-relaxed">
                              <span className="text-muted-foreground mr-1">{qi + 1}.</span>
                              {q.text}
                              <span className="ml-1 text-xs text-muted-foreground">（{q.dimension}）</span>
                            </p>
                            <StarRating
                              value={scores[st.id]?.[q.id] ?? 0}
                              onChange={(v) => setScore(st.id, q.id, v)}
                            />
                          </div>
                        ))}
                        <Textarea
                          placeholder={`对 ${st.name} 的补充评价（选填，匿名展示）`}
                          className="text-sm"
                          rows={2}
                          value={comments[st.id] ?? ''}
                          onChange={(e) => setComments((prev) => ({ ...prev, [st.id]: e.target.value }))}
                        />
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </section>
          ))}

          <div className="sticky bottom-4 flex justify-center">
            <div className="rounded-full bg-white/90 backdrop-blur border shadow-lg px-3 py-2">
              <Button
                size="lg"
                className="px-10"
                disabled={!allDone}
                onClick={() => setConfirmOpen(true)}
              >
                <Send className="w-4 h-4 mr-2" />
                {allDone ? '匿名提交评价' : `还有 ${totalQuestions - answered} 题未作答`}
              </Button>
            </div>
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认匿名提交？</AlertDialogTitle>
                <AlertDialogDescription>
                  提交后不可修改。系统将立即脱敏存储您的打分，任何人员（包括被评价人）都无法追溯您的身份与打分明细。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>再检查一下</AlertDialogCancel>
                <AlertDialogAction onClick={doSubmit}>确认提交</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </EmployeeLayout>
  )
}
