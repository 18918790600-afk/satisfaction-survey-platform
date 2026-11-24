export type JobType = 'platform' | 'network' | 'complaint'

export const JOB_LABELS: Record<JobType, string> = {
  platform: '平台运营支撑',
  network: '网络终端技术支撑',
  complaint: '投诉管理（班长）',
}

export const JOB_ORDER: JobType[] = ['platform', 'network', 'complaint']

export interface Employee {
  id: string
  name: string
  account: string
  password: string
  role: 'admin' | 'employee'
  weight: number
}

export interface SupportStaff {
  id: string
  name: string
  job: JobType
  /**
   * 若该被评对象同时拥有参评员工账号（同一人在不同周期身份不同），
   * 在此关联其 Employee.id；打分时系统自动回避，本人无法对自己评分。
   */
  employeeId?: string
}

export interface Question {
  id: string
  job: JobType
  dimension: string
  text: string
}

export type CycleStatus = 'active' | 'closed' | 'published'

export interface Cycle {
  id: string
  month: string // e.g. '2026-11'
  status: CycleStatus
  startedAt: number
  closedAt?: number
  publishedAt?: number
}

/**
 * 匿名提交记录：刻意不包含任何评价人身份字段，
 * 参与情况单独存于 Participation，与打分明细完全隔离。
 */
export interface Submission {
  id: string
  cycleId: string
  staffId: string
  job: JobType
  scores: number[]
  avg: number
  weight: number // 提交时评价人的权重快照
  comment?: string
  at: number
}

export interface Participation {
  id: string
  cycleId: string
  employeeId: string
  at: number
}

export interface WeightChange {
  id: string
  employeeId: string
  cycleId: string
  delta: number
  after: number
  reason: string
  at: number
}

export interface LogEntry {
  id: string
  at: number
  actor: string
  action: string
  detail: string
}

/** 周期关闭时自动生成的点评 */
export type Summaries = Record<string, string>

export interface DB {
  version: number
  employees: Employee[]
  staff: SupportStaff[]
  questions: Question[]
  cycles: Cycle[]
  submissions: Submission[]
  participations: Participation[]
  weightChanges: WeightChange[]
  logs: LogEntry[]
  summaries: Summaries
}

export const WEIGHT_RULE = {
  base: 1.0,
  stepUp: 0.05,
  stepDown: 0.1,
  max: 1.5,
  min: 0.3,
}

export interface StaffResult {
  staffId: string
  job: JobType
  weightedAvg: number
  rawAvg: number
  count: number
  comments: string[]
}
