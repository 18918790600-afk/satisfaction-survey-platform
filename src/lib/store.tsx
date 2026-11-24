import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  JOB_LABELS,
  JOB_ORDER,
  WEIGHT_RULE,
  type Cycle,
  type DB,
  type Employee,
  type JobType,
  type LogEntry,
  type Participation,
  type Question,
  type StaffResult,
  type Submission,
  type SupportStaff,
  type WeightChange,
} from './types'

const DB_KEY = 'sat-platform-db-v1'
const SESSION_KEY = 'sat-platform-session-v1'

/* ---------------- 确定性随机数（演示数据可复现） ---------------- */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let seq = 0
function uid(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

/* ---------------- 基础数据 ---------------- */

const ADMIN: Employee = {
  id: 'emp-admin',
  name: '鲍学亮',
  account: 'admin',
  password: 'admin123',
  role: 'admin',
  weight: 1,
}

const EMPLOYEE_NAMES = [
  '孙立群', '何丽华', '郭晓东', '马文静', '罗国强', '高晓燕',
  '林子豪', '徐雅琴', '胡建军', '朱婷婷', '宋志明', '唐小雪',
]

const STAFF: SupportStaff[] = [
  { id: 'st-wlj', name: '王丽娟', job: 'platform' },
  { id: 'st-zzq', name: '张志强', job: 'platform' },
  { id: 'st-lhr', name: '刘浩然', job: 'network' },
  { id: 'st-cjh', name: '陈建华', job: 'network' },
  { id: 'st-yl', name: '杨柳', job: 'complaint' },
  { id: 'st-zm', name: '赵敏', job: 'complaint' },
]

const QUESTIONS: Question[] = [
  { id: 'q-p1', job: 'platform', dimension: '服务态度', text: '您对平台运营支撑人员的服务态度是否满意？' },
  { id: 'q-p2', job: 'platform', dimension: '响应效率', text: '您对平台运营问题的响应与处理效率是否满意？' },
  { id: 'q-p3', job: 'platform', dimension: '解决质量', text: '您对平台运营支撑问题的解决质量是否满意？' },
  { id: 'q-n1', job: 'network', dimension: '服务态度', text: '您对网络终端技术支撑人员的服务态度是否满意？' },
  { id: 'q-n2', job: 'network', dimension: '响应效率', text: '您对网络终端故障的响应与修复效率是否满意？' },
  { id: 'q-n3', job: 'network', dimension: '解决质量', text: '您对网络终端技术问题的解决质量是否满意？' },
  { id: 'q-c1', job: 'complaint', dimension: '服务态度', text: '您对投诉管理（班长）岗位的服务态度是否满意？' },
  { id: 'q-c2', job: 'complaint', dimension: '响应效率', text: '您对投诉工单的响应与跟进效率是否满意？' },
  { id: 'q-c3', job: 'complaint', dimension: '支撑满意度', text: '您对投诉管理整体支撑工作的满意程度如何？' },
]

const COMMENT_POOL = [
  '响应很及时，问题当天就解决了，值得肯定。',
  '服务态度很好，沟通耐心细致。',
  '处理速度总体可以，高峰期略有延迟。',
  '专业能力强，定位问题准确。',
  '整体不错，希望继续保持。',
  '跟进很主动，反馈闭环做得比较好。',
  '问题解决了，但过程沟通可以再充分一些。',
  '支撑很到位，对工作帮助很大。',
]

/* ---------------- 种子数据：回放两个历史周期 + 一个进行中周期 ---------------- */

function seed(): DB {
  const rnd = mulberry32(20261123)
  const employees: Employee[] = [
    ADMIN,
    ...EMPLOYEE_NAMES.map((name, i) => ({
      id: `emp-${i + 1}`,
      name,
      account: `KF${String(i + 1).padStart(3, '0')}`,
      password: '123456',
      role: 'employee' as const,
      weight: WEIGHT_RULE.base,
    })),
  ]
  const evaluators = employees.filter((e) => e.role === 'employee')

  const cycles: Cycle[] = [
    {
      id: 'cy-2026-09',
      month: '2026-09',
      status: 'published',
      startedAt: new Date(2026, 8, 1, 9, 0).getTime(),
      closedAt: new Date(2026, 8, 25, 18, 0).getTime(),
      publishedAt: new Date(2026, 8, 26, 9, 30).getTime(),
    },
    {
      id: 'cy-2026-10',
      month: '2026-10',
      status: 'published',
      startedAt: new Date(2026, 10 - 1, 1, 9, 0).getTime(),
      closedAt: new Date(2026, 10 - 1, 26, 18, 0).getTime(),
      publishedAt: new Date(2026, 10 - 1, 27, 9, 30).getTime(),
    },
    {
      id: 'cy-2026-11',
      month: '2026-11',
      status: 'active',
      startedAt: new Date(2026, 10, 2, 9, 0).getTime(),
    },
  ]

  const submissions: Submission[] = []
  const participations: Participation[] = []
  const weightChanges: WeightChange[] = []
  const logs: LogEntry[] = []
  const summaries: DB['summaries'] = {}

  const weightOf = (emp: Employee) => emp.weight

  const makeSubmissionsFor = (
    cycle: Cycle,
    participantIds: string[],
    dayStart: number,
    dayEnd: number,
  ) => {
    for (const emp of evaluators) {
      if (!participantIds.includes(emp.id)) continue
      const day = dayStart + Math.floor(rnd() * (dayEnd - dayStart))
      const at = new Date(2026, Number(cycle.month.slice(5)) - 1, day, 9 + Math.floor(rnd() * 9), Math.floor(rnd() * 60)).getTime()
      participations.push({ id: uid('pa'), cycleId: cycle.id, employeeId: emp.id, at })
      for (const st of STAFF) {
        const bias = 3.4 + rnd() * 1.4 // 每人对每个岗位的整体倾向
        const scores = QUESTIONS.filter((q) => q.job === st.job).map(() => {
          const v = Math.round(bias + (rnd() - 0.5) * 1.2)
          return Math.max(2, Math.min(5, v))
        })
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        submissions.push({
          id: uid('sub'),
          cycleId: cycle.id,
          staffId: st.id,
          job: st.job,
          scores,
          avg: Math.round(avg * 100) / 100,
          weight: weightOf(emp),
          comment: rnd() < 0.35 ? COMMENT_POOL[Math.floor(rnd() * COMMENT_POOL.length)] : undefined,
          at,
        })
      }
    }
  }

  const applyWeights = (cycle: Cycle, participantIds: string[], at: number) => {
    for (const emp of evaluators) {
      const joined = participantIds.includes(emp.id)
      const delta = joined ? WEIGHT_RULE.stepUp : -WEIGHT_RULE.stepDown
      const after = Math.min(
        WEIGHT_RULE.max,
        Math.max(WEIGHT_RULE.min, Math.round((emp.weight + delta) * 100) / 100),
      )
      if (after !== emp.weight) {
        emp.weight = after
        weightChanges.push({
          id: uid('wc'),
          employeeId: emp.id,
          cycleId: cycle.id,
          delta: Math.round((after - (after - delta)) * 100) / 100,
          after,
          reason: joined ? '按时参与评价，权重上调' : '未参与当月评价，权重下调',
          at,
        })
      }
    }
  }

  const buildSummary = (cycle: Cycle) => {
    const results = computeResults({ ...emptyShell(), cycles, staff: STAFF, submissions } as DB, cycle.id)
    const lines: string[] = []
    for (const job of JOB_ORDER) {
      const rs = results.filter((r) => r.job === job).sort((a, b) => b.weightedAvg - a.weightedAvg)
      if (!rs.length) continue
      const top = rs[0]
      const topName = STAFF.find((s) => s.id === top.staffId)?.name ?? ''
      lines.push(
        `${JOB_LABELS[job]}：${topName} 以加权得分 ${top.weightedAvg.toFixed(2)} 位列岗位第一，共回收 ${rs.reduce((a, r) => a + r.count, 0)} 份有效评价。`,
      )
    }
    const lowest = [...results].sort((a, b) => a.weightedAvg - b.weightedAvg)[0]
    if (lowest) {
      const name = STAFF.find((s) => s.id === lowest.staffId)?.name ?? ''
      lines.push(
        `${name} 得分 ${lowest.weightedAvg.toFixed(2)} 相对靠后，建议重点关注响应效率与问题解决质量维度的员工反馈。`,
      )
    }
    return lines.join('\n')
  }

  // —— 2026-09：10/12 参与 ——
  const sepMiss = ['emp-9', 'emp-11']
  const sepJoin = evaluators.filter((e) => !sepMiss.includes(e.id)).map((e) => e.id)
  makeSubmissionsFor(cycles[0], sepJoin, 3, 22)
  applyWeights(cycles[0], sepJoin, cycles[0].closedAt!)
  summaries[cycles[0].id] = buildSummary(cycles[0])

  // —— 2026-10：9/12 参与 ——
  const octMiss = ['emp-9', 'emp-11', 'emp-4']
  const octJoin = evaluators.filter((e) => !octMiss.includes(e.id)).map((e) => e.id)
  makeSubmissionsFor(cycles[1], octJoin, 3, 23)
  applyWeights(cycles[1], octJoin, cycles[1].closedAt!)
  summaries[cycles[1].id] = buildSummary(cycles[1])

  // —— 2026-11 进行中：7/12 已提交 ——
  const novJoined = ['emp-1', 'emp-2', 'emp-3', 'emp-5', 'emp-6', 'emp-7', 'emp-10']
  makeSubmissionsFor(cycles[2], novJoined, 3, 21)

  const log = (at: number, actor: string, action: string, detail: string) =>
    logs.push({ id: uid('log'), at, actor, action, detail })

  log(cycles[0].startedAt, '系统', '自动启动评价周期', '2026-09 月度满意度评价自动启动，问卷自动生成并定向推送至 12 名员工。')
  log(cycles[0].closedAt!, '系统', '自动核算得分', '2026-09 评价周期结束，自动完成加权得分核算与权重调整。')
  log(cycles[0].publishedAt!, '鲍学亮', '公示评价结果', '2026-09 评价结果已向全员公示。')
  log(cycles[1].startedAt, '系统', '自动启动评价周期', '2026-10 月度满意度评价自动启动，问卷自动生成并定向推送至 12 名员工。')
  log(cycles[1].closedAt!, '系统', '自动核算得分', '2026-10 评价周期结束，自动完成加权得分核算与权重调整。')
  log(cycles[1].publishedAt!, '鲍学亮', '公示评价结果', '2026-10 评价结果已向全员公示。')
  log(cycles[2].startedAt, '系统', '自动启动评价周期', '2026-11 月度满意度评价自动启动，问卷自动生成并定向推送至 12 名员工。')
  log(new Date(2026, 10, 20, 14, 12).getTime(), '系统', '参与提醒', '自动向 5 名未参与员工发送评价提醒通知。')

  return {
    version: 1,
    employees,
    staff: STAFF,
    questions: QUESTIONS,
    cycles,
    submissions,
    participations,
    weightChanges,
    logs,
    summaries,
  }
}

function emptyShell(): Partial<DB> {
  return { staff: STAFF, questions: QUESTIONS }
}

/* ---------------- 持久化 ---------------- */

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      if (db.version === 1) return db
    }
  } catch {
    /* fallthrough */
  }
  const db = seed()
  localStorage.setItem(DB_KEY, JSON.stringify(db))
  return db
}

function saveDB(db: DB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

/* ---------------- 派生计算 ---------------- */

export function computeResults(db: DB, cycleId: string): StaffResult[] {
  const subs = db.submissions.filter((s) => s.cycleId === cycleId)
  return db.staff.map((st) => {
    const list = subs.filter((s) => s.staffId === st.id)
    const wSum = list.reduce((a, s) => a + s.weight * s.avg, 0)
    const wTotal = list.reduce((a, s) => a + s.weight, 0)
    const raw = list.reduce((a, s) => a + s.avg, 0)
    return {
      staffId: st.id,
      job: st.job,
      weightedAvg: wTotal ? Math.round((wSum / wTotal) * 100) / 100 : 0,
      rawAvg: list.length ? Math.round((raw / list.length) * 100) / 100 : 0,
      count: list.length,
      comments: list.map((s) => s.comment).filter((c): c is string => !!c),
    }
  })
}

export function cycleLabel(c: Cycle) {
  return `${c.month.slice(0, 4)} 年 ${Number(c.month.slice(5))} 月`
}

export function fmtTime(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ---------------- Context ---------------- */

interface Session {
  employeeId: string
}

interface StoreCtx {
  db: DB
  session: Session | null
  currentUser: Employee | null
  login: (account: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  submitEvaluation: (
    cycleId: string,
    entries: { staffId: string; scores: number[]; comment?: string }[],
  ) => void
  closeCycle: (cycleId: string) => void
  publishCycle: (cycleId: string) => void
  startCycle: (month: string) => void
  resetDemo: () => void
  addLog: (action: string, detail: string) => void
  addEmployee: (input: {
    name: string
    account: string
    password: string
    role: 'admin' | 'employee'
  }) => { ok: boolean; error?: string }
  removeEmployee: (employeeId: string) => { ok: boolean; error?: string }
  updateEmployee: (
    employeeId: string,
    patch: { name?: string; role?: 'admin' | 'employee'; password?: string },
  ) => { ok: boolean; error?: string }
}

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB)
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as Session) : null
    } catch {
      return null
    }
  })

  const persist = useCallback((next: DB) => {
    setDb(next)
    saveDB(next)
  }, [])

  const currentUser = useMemo(
    () => db.employees.find((e) => e.id === session?.employeeId) ?? null,
    [db, session],
  )

  const pushLog = useCallback(
    (base: DB, actor: string, action: string, detail: string): DB => ({
      ...base,
      logs: [{ id: uid('log'), at: Date.now(), actor, action, detail }, ...base.logs],
    }),
    [],
  )

  const login = useCallback(
    (account: string, password: string) => {
      const emp = db.employees.find((e) => e.account === account.trim())
      if (!emp || emp.password !== password) {
        return { ok: false, error: '账号或密码不正确，请重试。' }
      }
      const s = { employeeId: emp.id }
      setSession(s)
      localStorage.setItem(SESSION_KEY, JSON.stringify(s))
      persist(pushLog(db, emp.name, '登录系统', `${emp.name}（${emp.account}）登录系统。`))
      return { ok: true }
    },
    [db, persist, pushLog],
  )

  const logout = useCallback(() => {
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
  }, [])

  /** 匿名提交：Submission 不携带任何评价人身份信息 */
  const submitEvaluation = useCallback(
    (cycleId: string, entries: { staffId: string; scores: number[]; comment?: string }[]) => {
      if (!currentUser) return
      const cycle = db.cycles.find((c) => c.id === cycleId)
      if (!cycle || cycle.status !== 'active') return
      if (db.participations.some((p) => p.cycleId === cycleId && p.employeeId === currentUser.id)) return

      const now = Date.now()
      const newSubs: Submission[] = entries.map((en) => {
        const st = db.staff.find((s) => s.id === en.staffId)!
        const avg = en.scores.reduce((a, b) => a + b, 0) / en.scores.length
        return {
          id: uid('sub'),
          cycleId,
          staffId: en.staffId,
          job: st.job,
          scores: en.scores,
          avg: Math.round(avg * 100) / 100,
          weight: currentUser.weight,
          comment: en.comment?.trim() || undefined,
          at: now,
        }
      })
      const pa: Participation = { id: uid('pa'), cycleId, employeeId: currentUser.id, at: now }
      let next: DB = {
        ...db,
        submissions: [...db.submissions, ...newSubs],
        participations: [...db.participations, pa],
      }
      next = pushLog(next, '系统', '收到匿名评价', `收到 1 份匿名评价提交（共 ${newSubs.length} 条岗位评分，已按匿名规则脱敏存储）。`)
      persist(next)
    },
    [db, currentUser, persist, pushLog],
  )

  const closeCycle = useCallback(
    (cycleId: string) => {
      const cycle = db.cycles.find((c) => c.id === cycleId)
      if (!cycle || cycle.status !== 'active' || !currentUser) return
      const now = Date.now()
      const evaluators = db.employees.filter((e) => e.role === 'employee')
      const joined = db.participations.filter((p) => p.cycleId === cycleId).map((p) => p.employeeId)
      const changes: WeightChange[] = []
      const employees = db.employees.map((emp) => {
        if (emp.role !== 'employee') return emp
        const did = joined.includes(emp.id)
        const delta = did ? WEIGHT_RULE.stepUp : -WEIGHT_RULE.stepDown
        const after = Math.min(WEIGHT_RULE.max, Math.max(WEIGHT_RULE.min, Math.round((emp.weight + delta) * 100) / 100))
        if (after !== emp.weight) {
          changes.push({
            id: uid('wc'),
            employeeId: emp.id,
            cycleId,
            delta: Math.round((after - emp.weight) * 100) / 100,
            after,
            reason: did ? '按时参与评价，权重上调' : '未参与当月评价，权重下调',
            at: now,
          })
        }
        return { ...emp, weight: after }
      })

      const cycles = db.cycles.map((c) => (c.id === cycleId ? { ...c, status: 'closed' as const, closedAt: now } : c))
      let next: DB = { ...db, employees, cycles, weightChanges: [...db.weightChanges, ...changes] }

      // 自动生成月度点评
      const results = computeResults(next, cycleId)
      const lines: string[] = []
      for (const job of JOB_ORDER) {
        const rs = results.filter((r) => r.job === job).sort((a, b) => b.weightedAvg - a.weightedAvg)
        if (!rs.length) continue
        const top = rs[0]
        const topName = next.staff.find((s) => s.id === top.staffId)?.name ?? ''
        lines.push(
          `${JOB_LABELS[job]}：${topName} 以加权得分 ${top.weightedAvg.toFixed(2)} 位列岗位第一，共回收 ${rs.reduce((a, r) => a + r.count, 0)} 份有效评价。`,
        )
      }
      const lowest = [...results].sort((a, b) => a.weightedAvg - b.weightedAvg)[0]
      if (lowest) {
        const name = next.staff.find((s) => s.id === lowest.staffId)?.name ?? ''
        lines.push(`${name} 得分 ${lowest.weightedAvg.toFixed(2)} 相对靠后，建议重点关注服务态度与响应效率维度的反馈。`)
      }
      next.summaries = { ...next.summaries, [cycleId]: lines.join('\n') }

      next = pushLog(
        next,
        currentUser.name,
        '结束周期并核算',
        `${cycleLabel(cycle)}评价周期结束：回收 ${joined.length}/${evaluators.length} 份，自动完成加权得分核算，${changes.length} 名员工权重已调整。`,
      )
      persist(next)
    },
    [db, currentUser, persist, pushLog],
  )

  const publishCycle = useCallback(
    (cycleId: string) => {
      const cycle = db.cycles.find((c) => c.id === cycleId)
      if (!cycle || cycle.status !== 'closed' || !currentUser) return
      const cycles = db.cycles.map((c) =>
        c.id === cycleId ? { ...c, status: 'published' as const, publishedAt: Date.now() } : c,
      )
      let next: DB = { ...db, cycles }
      next = pushLog(next, currentUser.name, '公示评价结果', `${cycleLabel(cycle)}评价结果已向全员公示，并自动发送全员告知邮件。`)
      persist(next)
    },
    [db, currentUser, persist, pushLog],
  )

  const startCycle = useCallback(
    (month: string) => {
      if (!currentUser) return
      if (db.cycles.some((c) => c.month === month)) return
      const cycle: Cycle = { id: uid('cy'), month, status: 'active', startedAt: Date.now() }
      let next: DB = { ...db, cycles: [...db.cycles, cycle] }
      next = pushLog(
        next,
        '系统',
        '自动启动评价周期',
        `${cycleLabel(cycle)}月度满意度评价自动启动：问卷按三类支撑工种自动生成（每岗位 3 题），已定向推送至全体 ${db.employees.filter((e) => e.role === 'employee').length} 名评价员工。`,
      )
      persist(next)
    },
    [db, currentUser, persist, pushLog],
  )

  const addLog = useCallback(
    (action: string, detail: string) => {
      if (!currentUser) return
      persist(pushLog(db, currentUser.name, action, detail))
    },
    [db, currentUser, persist, pushLog],
  )

  const resetDemo = useCallback(() => {
    const fresh = seed()
    persist(pushLog(fresh, currentUser?.name ?? '系统', '重置演示数据', '演示数据已重置为初始状态。'))
  }, [currentUser, persist, pushLog])

  /* ---------------- 人员管理 ---------------- */

  const addEmployee = useCallback(
    (input: { name: string; account: string; password: string; role: 'admin' | 'employee' }) => {
      if (!currentUser || currentUser.role !== 'admin') return { ok: false, error: '无权限操作。' }
      const name = input.name.trim()
      const account = input.account.trim()
      const password = input.password.trim()
      if (!name || !account || !password) return { ok: false, error: '姓名、工号和初始密码都不能为空。' }
      if (db.employees.some((e) => e.account === account)) {
        return { ok: false, error: `工号 ${account} 已存在，请更换。` }
      }
      const emp: Employee = {
        id: uid('emp'),
        name,
        account,
        password,
        role: input.role,
        weight: WEIGHT_RULE.base,
      }
      let next: DB = { ...db, employees: [...db.employees, emp] }
      next = pushLog(
        next,
        currentUser.name,
        '新增人员',
        `新增${input.role === 'admin' ? '管理员' : '参评员工'} ${name}（${account}），初始权重 ${WEIGHT_RULE.base.toFixed(2)}。`,
      )
      persist(next)
      return { ok: true }
    },
    [db, currentUser, persist, pushLog],
  )

  const removeEmployee = useCallback(
    (employeeId: string) => {
      if (!currentUser || currentUser.role !== 'admin') return { ok: false, error: '无权限操作。' }
      const target = db.employees.find((e) => e.id === employeeId)
      if (!target) return { ok: false, error: '人员不存在。' }
      if (target.id === currentUser.id) return { ok: false, error: '不能删除当前登录的账号。' }
      if (target.role === 'admin' && db.employees.filter((e) => e.role === 'admin').length <= 1) {
        return { ok: false, error: '至少需要保留一名管理员。' }
      }
      let next: DB = {
        ...db,
        employees: db.employees.filter((e) => e.id !== employeeId),
        // 同步清理其参与记录；匿名打分明细本就不含身份信息，按设计保留为历史数据
        participations: db.participations.filter((p) => p.employeeId !== employeeId),
      }
      // 如果删的是自己以外的当前会话对象，无需处理会话
      next = pushLog(
        next,
        currentUser.name,
        '删除人员',
        `删除${target.role === 'admin' ? '管理员' : '参评员工'} ${target.name}（${target.account}），其参与记录已同步清除。`,
      )
      persist(next)
      return { ok: true }
    },
    [db, currentUser, persist, pushLog],
  )

  const updateEmployee = useCallback(
    (employeeId: string, patch: { name?: string; role?: 'admin' | 'employee'; password?: string }) => {
      if (!currentUser || currentUser.role !== 'admin') return { ok: false, error: '无权限操作。' }
      const target = db.employees.find((e) => e.id === employeeId)
      if (!target) return { ok: false, error: '人员不存在。' }
      if (
        target.role === 'admin' &&
        patch.role === 'employee' &&
        db.employees.filter((e) => e.role === 'admin').length <= 1
      ) {
        return { ok: false, error: '至少需要保留一名管理员，不能将其调整为参评员工。' }
      }
      const name = patch.name !== undefined ? patch.name.trim() : target.name
      if (!name) return { ok: false, error: '姓名不能为空。' }
      const password = patch.password !== undefined ? patch.password.trim() : target.password
      if (!password) return { ok: false, error: '密码不能为空。' }

      const changes: string[] = []
      if (name !== target.name) changes.push(`姓名 ${target.name} → ${name}`)
      if (patch.role && patch.role !== target.role) {
        changes.push(patch.role === 'admin' ? '角色 参评员工 → 管理员' : '角色 管理员 → 参评员工')
      }
      if (password !== target.password) changes.push('重置登录密码')

      const employees = db.employees.map((e) =>
        e.id === employeeId ? { ...e, name, password, role: patch.role ?? e.role } : e,
      )
      let next: DB = { ...db, employees }
      if (changes.length) {
        next = pushLog(next, currentUser.name, '修改人员信息', `${target.name}（${target.account}）：${changes.join('；')}。`)
        persist(next)
      }
      return { ok: true }
    },
    [db, currentUser, persist, pushLog],
  )

  const value = useMemo(
    () => ({
      db,
      session,
      currentUser,
      login,
      logout,
      submitEvaluation,
      closeCycle,
      publishCycle,
      startCycle,
      resetDemo,
      addLog,
      addEmployee,
      removeEmployee,
      updateEmployee,
    }),
    [db, session, currentUser, login, logout, submitEvaluation, closeCycle, publishCycle, startCycle, resetDemo, addLog, addEmployee, removeEmployee, updateEmployee],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function questionsFor(db: DB, job: JobType): Question[] {
  return db.questions.filter((q) => q.job === job)
}
