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
  type ImportPayload,
  type JobType,
  type Participation,
  type Question,
  type StaffResult,
  type Submission,
  type SupportStaff,
  type WeightChange,
} from './types'

const DB_KEY = 'sat-platform-db-v1'
const SESSION_KEY = 'sat-platform-session-v1'

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

/* ---------------- 初始数据：仅管理员账号，正式数据通过管理页面或 Excel 导入录入 ---------------- */

function seed(): DB {
  return {
    version: 1,
    employees: [ADMIN],
    staff: [],
    questions: QUESTIONS,
    cycles: [],
    submissions: [],
    participations: [],
    weightChanges: [],
    logs: [
      {
        id: uid('log'),
        at: Date.now(),
        actor: '系统',
        action: '系统初始化',
        detail:
          '平台初始化完成，当前仅含管理员账号。请通过「人员管理」「岗位人员」维护名单，或通过「数据导入」批量导入历史月份数据。',
      },
    ],
    summaries: {},
  }
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

/** 根据某周期的得分自动生成月度点评（周期核算与历史导入共用） */
export function buildSummaryText(db: DB, cycleId: string): string {
  const results = computeResults(db, cycleId).filter((r) => r.count > 0)
  const lines: string[] = []
  for (const job of JOB_ORDER) {
    const rs = results.filter((r) => r.job === job).sort((a, b) => b.weightedAvg - a.weightedAvg)
    if (!rs.length) continue
    const top = rs[0]
    const topName = db.staff.find((s) => s.id === top.staffId)?.name ?? ''
    lines.push(
      `${JOB_LABELS[job]}：${topName} 以加权得分 ${top.weightedAvg.toFixed(2)} 位列岗位第一，共回收 ${rs.reduce((a, r) => a + r.count, 0)} 份有效评价。`,
    )
  }
  const lowest = [...results].sort((a, b) => a.weightedAvg - b.weightedAvg)[0]
  if (lowest) {
    const name = db.staff.find((s) => s.id === lowest.staffId)?.name ?? ''
    lines.push(
      `${name} 得分 ${lowest.weightedAvg.toFixed(2)} 相对靠后，建议重点关注服务态度与响应效率维度的反馈。`,
    )
  }
  return lines.join('\n')
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
  addStaff: (input: {
    name: string
    job: JobType
    employeeId?: string
  }) => { ok: boolean; error?: string }
  updateStaff: (
    staffId: string,
    patch: { name?: string; job?: JobType; employeeId?: string | null },
  ) => { ok: boolean; error?: string }
  removeStaff: (staffId: string) => { ok: boolean; error?: string }
  importHistory: (
    payload: ImportPayload,
  ) => { ok: boolean; error?: string; months: number; skipped: string[] }
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
      next.summaries = { ...next.summaries, [cycleId]: buildSummaryText(next, cycleId) }

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

  /* ---------------- 岗位人员管理（被评对象） ---------------- */

  const addStaff = useCallback(
    (input: { name: string; job: JobType; employeeId?: string }) => {
      if (!currentUser || currentUser.role !== 'admin') return { ok: false, error: '无权限操作。' }
      const name = input.name.trim()
      if (!name) return { ok: false, error: '姓名不能为空。' }
      if (input.employeeId && !db.employees.some((e) => e.id === input.employeeId)) {
        return { ok: false, error: '关联的参评账号不存在。' }
      }
      const st: SupportStaff = {
        id: uid('st'),
        name,
        job: input.job,
        employeeId: input.employeeId || undefined,
      }
      let next: DB = { ...db, staff: [...db.staff, st] }
      const linked = input.employeeId ? db.employees.find((e) => e.id === input.employeeId) : null
      next = pushLog(
        next,
        currentUser.name,
        '新增岗位人员',
        `新增被评对象 ${name}（${JOB_LABELS[input.job]}）${linked ? `，关联参评账号 ${linked.name}（${linked.account}），其打分时自动回避` : ''}。`,
      )
      persist(next)
      return { ok: true }
    },
    [db, currentUser, persist, pushLog],
  )

  const updateStaff = useCallback(
    (staffId: string, patch: { name?: string; job?: JobType; employeeId?: string | null }) => {
      if (!currentUser || currentUser.role !== 'admin') return { ok: false, error: '无权限操作。' }
      const target = db.staff.find((s) => s.id === staffId)
      if (!target) return { ok: false, error: '岗位人员不存在。' }
      if (patch.employeeId && !db.employees.some((e) => e.id === patch.employeeId)) {
        return { ok: false, error: '关联的参评账号不存在。' }
      }
      const name = patch.name !== undefined ? patch.name.trim() : target.name
      if (!name) return { ok: false, error: '姓名不能为空。' }

      const changes: string[] = []
      if (name !== target.name) changes.push(`姓名 ${target.name} → ${name}`)
      if (patch.job && patch.job !== target.job) {
        changes.push(`岗位 ${JOB_LABELS[target.job]} → ${JOB_LABELS[patch.job]}`)
      }
      let nextLink = target.employeeId
      if (patch.employeeId !== undefined) {
        nextLink = patch.employeeId === null ? undefined : patch.employeeId
        if (nextLink !== target.employeeId) {
          if (nextLink) {
            const emp = db.employees.find((e) => e.id === nextLink)!
            changes.push(`关联参评账号 ${emp.name}（${emp.account}），其打分时自动回避`)
          } else {
            changes.push('取消参评账号关联')
          }
        }
      }

      const staff = db.staff.map((s) =>
        s.id === staffId ? { ...s, name, job: patch.job ?? s.job, employeeId: nextLink } : s,
      )
      let next: DB = { ...db, staff }
      if (changes.length) {
        next = pushLog(next, currentUser.name, '修改岗位人员', `${target.name}：${changes.join('；')}。`)
        persist(next)
      }
      return { ok: true }
    },
    [db, currentUser, persist, pushLog],
  )

  const removeStaff = useCallback(
    (staffId: string) => {
      if (!currentUser || currentUser.role !== 'admin') return { ok: false, error: '无权限操作。' }
      const target = db.staff.find((s) => s.id === staffId)
      if (!target) return { ok: false, error: '岗位人员不存在。' }
      if (db.submissions.some((s) => s.staffId === staffId)) {
        return { ok: false, error: '该人员已收到历史评价，为保证数据完整不可删除；下周期不再使用时可在新周期启动前调整。' }
      }
      let next: DB = { ...db, staff: db.staff.filter((s) => s.id !== staffId) }
      next = pushLog(next, currentUser.name, '删除岗位人员', `删除被评对象 ${target.name}（${JOB_LABELS[target.job]}）。`)
      persist(next)
      return { ok: true }
    },
    [db, currentUser, persist, pushLog],
  )

  /* ---------------- Excel 历史数据导入 ---------------- */

  const importHistory = useCallback(
    (payload: ImportPayload) => {
      const empty = { months: 0, skipped: [] as string[] }
      if (!currentUser || currentUser.role !== 'admin') return { ok: false, error: '无权限操作。', ...empty }

      const months = [
        ...new Set([
          ...payload.scores.map((r) => r.month),
          ...payload.participations.map((r) => r.month),
          ...payload.summaries.map((r) => r.month),
        ]),
      ].sort()
      const skipped = months.filter((m) => db.cycles.some((c) => c.month === m))
      const toImport = months.filter((m) => !skipped.includes(m))
      if (!toImport.length) {
        return { ok: false, error: '文件中的月份均已存在，没有可导入的数据。', ...empty, skipped }
      }

      const next: DB = {
        ...db,
        employees: [...db.employees],
        staff: [...db.staff],
        cycles: [...db.cycles],
        submissions: [...db.submissions],
        participations: [...db.participations],
        summaries: { ...db.summaries },
      }

      let newEmployees = 0
      let newStaff = 0
      let subCount = 0
      let paCount = 0

      for (const month of toImport) {
        const [y, m] = month.split('-').map(Number)
        const cycle: Cycle = {
          id: uid('cy'),
          month,
          status: 'published',
          startedAt: new Date(y, m - 1, 1, 9, 0).getTime(),
          closedAt: new Date(y, m - 1, 25, 18, 0).getTime(),
          publishedAt: new Date(y, m - 1, 26, 9, 30).getTime(),
        }
        next.cycles.push(cycle)

        // 月度得分 → 生成等价的匿名评分记录（权重按 1.00 计入，历史不追溯权重）
        for (const row of payload.scores.filter((r) => r.month === month)) {
          let st =
            next.staff.find((s) => s.name === row.staffName && s.job === row.job) ??
            next.staff.find((s) => s.name === row.staffName)
          if (!st) {
            st = { id: uid('st'), name: row.staffName, job: row.job }
            next.staff.push(st)
            newStaff++
          }
          const target = st
          for (let i = 0; i < row.count; i++) {
            next.submissions.push({
              id: uid('sub'),
              cycleId: cycle.id,
              staffId: target.id,
              job: target.job,
              scores: [row.avg],
              avg: row.avg,
              weight: 1,
              comment: row.comments[i],
              at: new Date(y, m - 1, 3 + (i % 20), 10, (i * 7) % 60).getTime(),
            })
            subCount++
          }
        }

        // 参与情况 → 参与记录；工号不存在且提供姓名时自动建档（初始密码 123456）
        for (const row of payload.participations.filter((r) => r.month === month && r.joined)) {
          let emp = next.employees.find((e) => e.account === row.account)
          if (!emp && row.name) {
            emp = {
              id: uid('emp'),
              name: row.name,
              account: row.account,
              password: '123456',
              role: 'employee',
              weight: WEIGHT_RULE.base,
            }
            next.employees.push(emp)
            newEmployees++
          }
          if (emp && !next.participations.some((p) => p.cycleId === cycle.id && p.employeeId === emp!.id)) {
            next.participations.push({
              id: uid('pa'),
              cycleId: cycle.id,
              employeeId: emp.id,
              at: new Date(y, m - 1, 15, 10, 0).getTime(),
            })
            paCount++
          }
        }

        // 周期点评：优先使用导入内容，缺省时自动生成
        const sm = payload.summaries.find((r) => r.month === month)
        const text = sm?.text?.trim()
        next.summaries[cycle.id] = text || buildSummaryText(next, cycle.id)
      }

      const logged = pushLog(
        next,
        currentUser.name,
        '导入历史数据',
        `通过 Excel 导入 ${toImport.length} 个历史月份（${toImport.join('、')}）：${subCount} 条评分、${paCount} 条参与记录` +
          `${newStaff ? `、新建岗位人员 ${newStaff} 人` : ''}${newEmployees ? `、新建员工账号 ${newEmployees} 个（初始密码 123456）` : ''}` +
          `。导入月份直接置为已公示，历史数据不追溯权重调整。` +
          `${skipped.length ? `已跳过系统中存在的月份：${skipped.join('、')}。` : ''}`,
      )
      persist(logged)
      return { ok: true, months: toImport.length, skipped }
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
      addStaff,
      updateStaff,
      removeStaff,
      importHistory,
    }),
    [db, session, currentUser, login, logout, submitEvaluation, closeCycle, publishCycle, startCycle, resetDemo, addLog, addEmployee, removeEmployee, updateEmployee, addStaff, updateStaff, removeStaff, importHistory],
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
