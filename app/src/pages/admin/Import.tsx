import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Download, Upload, CircleAlert, CircleCheck, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../lib/store'
import {
  JOB_LABELS,
  type ImportParticipationRow,
  type ImportPayload,
  type ImportScoreRow,
  type ImportSummaryRow,
  type JobType,
} from '../../lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'

/* ---------------- 模板 ---------------- */

function downloadTemplate() {
  const wb = XLSX.utils.book_new()

  const s1 = XLSX.utils.aoa_to_sheet([
    ['月份', '姓名', '岗位', '平均得分', '评价份数', '评语（选填，多条用；分隔）'],
    ['2026-09', '王丽娟', '平台运营支撑', 4.35, 10, '响应很及时，问题当天就解决了；服务态度很好，沟通耐心'],
    ['2026-09', '刘浩然', '网络终端技术支撑', 3.92, 10, ''],
  ])
  s1['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 50 }]

  const s2 = XLSX.utils.aoa_to_sheet([
    ['月份', '工号', '姓名', '是否参与（是/否）'],
    ['2026-09', 'KF001', '孙立群', '是'],
    ['2026-09', 'KF002', '何丽华', '否'],
  ])
  s2['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 16 }]

  const s3 = XLSX.utils.aoa_to_sheet([
    ['月份', '周期点评（选填，留空则系统自动生成）'],
    ['2026-09', '平台运营支撑整体表现稳定，王丽娟得分位列岗位第一；网络终端技术支撑响应效率需重点关注。'],
  ])
  s3['!cols'] = [{ wch: 10 }, { wch: 80 }]

  const s4 = XLSX.utils.aoa_to_sheet([
    ['填写说明'],
    ['1. 月份格式为 YYYY-MM，如 2026-09；同一个文件可包含多个月份。'],
    ['2. 「月度得分」为必填表：每个被评对象每月一行，平均得分取 1–5 之间，评价份数为整数。'],
    ['3. 岗位可填：平台运营支撑 / 网络终端技术支撑 / 投诉管理（班长）（含“平台”“网络”“投诉”关键字即可识别）。'],
    ['4. 姓名与系统中岗位人员一致时自动匹配；不存在时将自动新建岗位人员。'],
    ['5. 「参与情况」为选填表：工号已存在时按工号匹配；工号不存在但填写了姓名时，将自动创建员工账号（初始密码 123456）。'],
    ['6. 「周期点评」为选填表：留空的月份由系统按得分自动生成点评。'],
    ['7. 示例行请替换为真实数据；系统中已存在的月份会被自动跳过，不会重复导入。'],
    ['8. 导入的历史月份直接置为「已公示」状态，不追溯历史权重调整。'],
  ])
  s4['!cols'] = [{ wch: 100 }]

  XLSX.utils.book_append_sheet(wb, s1, '月度得分')
  XLSX.utils.book_append_sheet(wb, s2, '参与情况')
  XLSX.utils.book_append_sheet(wb, s3, '周期点评')
  XLSX.utils.book_append_sheet(wb, s4, '填写说明')
  XLSX.writeFile(wb, '历史数据导入模板.xlsx')
}

/* ---------------- 解析与校验 ---------------- */

interface RowError {
  sheet: string
  row: number
  reason: string
}

function normMonth(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && v > 20000) {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}`
  }
  const s = String(v).trim()
  const m = s.match(/^(20\d{2})\s*[-/年.]?\s*(\d{1,2})\s*月?$/)
  if (!m) return null
  const mm = Number(m[2])
  if (mm < 1 || mm > 12) return null
  return `${m[1]}-${String(mm).padStart(2, '0')}`
}

function normJob(v: unknown): JobType | null {
  const s = String(v ?? '').trim()
  if (s.includes('平台')) return 'platform'
  if (s.includes('网络')) return 'network'
  if (s.includes('投诉')) return 'complaint'
  return null
}

function normJoined(v: unknown): boolean | null {
  const s = String(v ?? '').trim()
  if (['是', '参与', '已参与', 'Y', 'y', '1', '√', '✓'].includes(s)) return true
  if (['否', '未参与', 'N', 'n', '0', '×', 'x', 'X'].includes(s)) return false
  return null
}

type SheetRows = Record<string, unknown>[]

function rowsOf(wb: XLSX.WorkBook, name: string): SheetRows {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of Object.keys(row)) {
    if (keys.some((kk) => k.includes(kk))) return row[k]
  }
  return ''
}

interface ParseResult {
  payload: ImportPayload
  errors: RowError[]
  willCreateEmployees: number
  willCreateStaff: number
}

function parseWorkbook(wb: XLSX.WorkBook, existingAccounts: Set<string>, existingStaffNames: Set<string>): ParseResult {
  const errors: RowError[] = []
  const scores: ImportScoreRow[] = []
  const participations: ImportParticipationRow[] = []
  const summaries: ImportSummaryRow[] = []

  // 月度得分
  rowsOf(wb, '月度得分').forEach((row, i) => {
    const rn = i + 2
    const month = normMonth(pick(row, '月份'))
    const staffName = String(pick(row, '姓名') ?? '').trim()
    const job = normJob(pick(row, '岗位'))
    const avg = Number(pick(row, '平均得分'))
    const count = Number(pick(row, '评价份数', '份数'))
    const comments = String(pick(row, '评语') ?? '')
      .split(/[；;\n]/)
      .map((c) => c.trim())
      .filter(Boolean)

    if (!month && !staffName) return // 空行跳过
    if (!month) errors.push({ sheet: '月度得分', row: rn, reason: '月份格式不正确，应为 YYYY-MM（如 2026-09）' })
    if (!staffName) errors.push({ sheet: '月度得分', row: rn, reason: '姓名不能为空' })
    if (!job) errors.push({ sheet: '月度得分', row: rn, reason: '岗位无法识别，应包含“平台”“网络”或“投诉”关键字' })
    if (!Number.isFinite(avg) || avg < 1 || avg > 5)
      errors.push({ sheet: '月度得分', row: rn, reason: '平均得分应为 1–5 之间的数字' })
    if (!Number.isInteger(count) || count < 1 || count > 999)
      errors.push({ sheet: '月度得分', row: rn, reason: '评价份数应为 1–999 的整数' })
    if (month && staffName && job && Number.isFinite(avg) && avg >= 1 && avg <= 5 && Number.isInteger(count) && count >= 1 && count <= 999) {
      scores.push({ month, staffName, job, avg: Math.round(avg * 100) / 100, count, comments })
    }
  })

  // 参与情况
  const seenAccounts = new Set(existingAccounts)
  let willCreateEmployees = 0
  rowsOf(wb, '参与情况').forEach((row, i) => {
    const rn = i + 2
    const month = normMonth(pick(row, '月份'))
    const account = String(pick(row, '工号') ?? '').trim()
    const name = String(pick(row, '姓名') ?? '').trim()
    const joined = normJoined(pick(row, '是否参与'))

    if (!month && !account) return
    if (!month) errors.push({ sheet: '参与情况', row: rn, reason: '月份格式不正确，应为 YYYY-MM' })
    if (!account) errors.push({ sheet: '参与情况', row: rn, reason: '工号不能为空' })
    if (joined === null) errors.push({ sheet: '参与情况', row: rn, reason: '是否参与应填“是”或“否”' })
    if (account && !seenAccounts.has(account)) {
      if (!name) {
        errors.push({ sheet: '参与情况', row: rn, reason: `工号 ${account} 在系统中不存在，需填写姓名以自动建档` })
      } else {
        seenAccounts.add(account)
        willCreateEmployees++
      }
    }
    if (month && account && joined !== null) {
      participations.push({ month, account, name: name || undefined, joined })
    }
  })

  // 周期点评
  rowsOf(wb, '周期点评').forEach((row, i) => {
    const rn = i + 2
    const month = normMonth(pick(row, '月份'))
    const text = String(pick(row, '点评') ?? '').trim()
    if (!month && !text) return
    if (!month) {
      errors.push({ sheet: '周期点评', row: rn, reason: '月份格式不正确，应为 YYYY-MM' })
      return
    }
    if (text) summaries.push({ month, text })
  })

  const willCreateStaff = new Set(
    scores.map((s) => s.staffName).filter((n) => !existingStaffNames.has(n)),
  ).size

  if (!scores.length && !participations.length && !summaries.length) {
    errors.push({ sheet: '文件', row: 0, reason: '未解析到任何有效数据，请检查工作表名称是否为「月度得分」「参与情况」「周期点评」' })
  }

  return { payload: { scores, participations, summaries }, errors, willCreateEmployees, willCreateStaff }
}

/* ---------------- 页面 ---------------- */

export default function Import() {
  const { db, importHistory } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [done, setDone] = useState<{ months: number; skipped: string[] } | null>(null)

  const existingAccounts = useMemo(() => new Set(db.employees.map((e) => e.account)), [db])
  const existingStaffNames = useMemo(() => new Set(db.staff.map((s) => s.name)), [db])
  const existingMonths = useMemo(() => new Set(db.cycles.map((c) => c.month)), [db])

  const months = useMemo(
    () =>
      parsed
        ? [
            ...new Set([
              ...parsed.payload.scores.map((r) => r.month),
              ...parsed.payload.participations.map((r) => r.month),
              ...parsed.payload.summaries.map((r) => r.month),
            ]),
          ].sort()
        : [],
    [parsed],
  )
  const skipMonths = months.filter((m) => existingMonths.has(m))
  const newMonths = months.filter((m) => !existingMonths.has(m))

  const onFile = async (f: File) => {
    setDone(null)
    try {
      const wb = XLSX.read(await f.arrayBuffer())
      const r = parseWorkbook(wb, existingAccounts, existingStaffNames)
      setParsed(r)
      setFileName(f.name)
      if (r.errors.length) {
        toast.error(`解析完成，发现 ${r.errors.length} 处问题，请修正后重新上传。`)
      } else {
        toast.success('文件解析成功，请确认后导入。')
      }
    } catch {
      toast.error('文件读取失败，请确认为有效的 Excel 文件（.xlsx / .xls）。')
    }
  }

  const doImport = () => {
    if (!parsed) return
    const r = importHistory(parsed.payload)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(`成功导入 ${r.months} 个历史月份，结果已公示。`)
    setDone({ months: r.months, skipped: r.skipped })
    setParsed(null)
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">数据导入</h1>
          <p className="text-sm text-muted-foreground mt-1">
            通过 Excel 批量导入历史月份的正式统计数据，导入后直接以「已公示」状态纳入系统。
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-1.5" />
          下载导入模板
        </Button>
      </div>

      {/* 说明 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            导入规则
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-1.5">
          <p>1. 先下载模板，按「月度得分」「参与情况」「周期点评」三张表填写（后两张可留空）。</p>
          <p>2. 月度得分按「每个被评对象 × 每个月」一行填写平均得分与评价份数；姓名不存在时自动新建岗位人员。</p>
          <p>3. 参与情况中的工号不存在时，填写姓名即可自动创建员工账号（初始密码 123456）。</p>
          <p>4. 系统中已存在的月份会自动跳过，不会重复导入；历史数据不追溯权重调整。</p>
        </CardContent>
      </Card>

      {/* 上传 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            上传 Excel 文件
          </CardTitle>
          <CardDescription>支持 .xlsx / .xls，上传后先校验，确认无误再正式导入。</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-input file:bg-background file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-accent"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
        </CardContent>
      </Card>

      {/* 校验结果 */}
      {parsed && (
        <Card className={parsed.errors.length ? 'border-red-300' : 'border-emerald-300'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {parsed.errors.length ? (
                <CircleAlert className="w-4 h-4 text-red-600" />
              ) : (
                <CircleCheck className="w-4 h-4 text-emerald-600" />
              )}
              校验结果 · {fileName}
            </CardTitle>
            <CardDescription>
              共 {months.length} 个月份（新增 {newMonths.length} 个
              {skipMonths.length > 0 && `，跳过已存在 ${skipMonths.length} 个：${skipMonths.join('、')}`}）、
              得分 {parsed.payload.scores.length} 行、参与记录 {parsed.payload.participations.filter((p) => p.joined).length} 条
              {parsed.willCreateStaff > 0 && `、将新建岗位人员 ${parsed.willCreateStaff} 人`}
              {parsed.willCreateEmployees > 0 && `、将新建员工账号 ${parsed.willCreateEmployees} 个`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 max-h-64 overflow-auto">
                <p className="text-sm font-medium text-red-700 mb-2">请修正以下 {parsed.errors.length} 处问题后重新上传：</p>
                <ul className="text-sm text-red-600 space-y-1">
                  {parsed.errors.map((e, i) => (
                    <li key={i}>
                      「{e.sheet}」{e.row > 0 ? `第 ${e.row} 行：` : ''}{e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.payload.scores.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>月份</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>岗位</TableHead>
                      <TableHead className="text-right">平均得分</TableHead>
                      <TableHead className="text-right">评价份数</TableHead>
                      <TableHead className="text-right">评语</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.payload.scores.slice(0, 100).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="num text-muted-foreground">{r.month}</TableCell>
                        <TableCell className="font-medium">{r.staffName}</TableCell>
                        <TableCell className="text-muted-foreground">{JOB_LABELS[r.job]}</TableCell>
                        <TableCell className="text-right num">{r.avg.toFixed(2)}</TableCell>
                        <TableCell className="text-right num">{r.count}</TableCell>
                        <TableCell className="text-right num text-muted-foreground">{r.comments.length} 条</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setParsed(null)
                  setFileName('')
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                放弃
              </Button>
              <Button disabled={parsed.errors.length > 0 || newMonths.length === 0} onClick={doImport}>
                <Upload className="w-4 h-4 mr-1.5" />
                确认导入 {newMonths.length} 个月份
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 完成状态 */}
      {done && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="py-5 flex items-start gap-3">
            <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800">已成功导入 {done.months} 个历史月份</p>
              <p className="text-emerald-700/80 mt-1">
                可在「评价结果」「参与情况」中查看，员工端「结果公示」同步可见。
                {done.skipped.length > 0 && `已跳过系统中存在的月份：${done.skipped.join('、')}。`}
              </p>
              <div className="mt-2">
                <Badge variant="outline" className="bg-white">导入记录已写入操作日志</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
