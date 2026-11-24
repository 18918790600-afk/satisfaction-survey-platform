import { useMemo, useState } from 'react'
import { ScrollText, Search } from 'lucide-react'
import { useStore, fmtTime } from '../../lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'

export default function Logs() {
  const { db } = useStore()
  const [kw, setKw] = useState('')

  const logs = useMemo(() => {
    const sorted = [...db.logs].sort((a, b) => b.at - a.at)
    if (!kw.trim()) return sorted
    const k = kw.trim()
    return sorted.filter(
      (l) => l.actor.includes(k) || l.action.includes(k) || l.detail.includes(k),
    )
  }, [db, kw])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">操作日志</h1>
          <p className="text-sm text-muted-foreground mt-1">
            超级管理员及系统的全部后台操作永久留痕，可追溯、可核查、可审计。
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索操作人 / 动作 / 内容"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            全部操作记录
            <Badge variant="secondary" className="num">{logs.length} 条</Badge>
          </CardTitle>
          <CardDescription>按时间倒序排列，记录不可删除、不可篡改。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">时间</TableHead>
                <TableHead className="w-28">操作人</TableHead>
                <TableHead className="w-40">动作</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="num text-muted-foreground">{fmtTime(l.at)}</TableCell>
                  <TableCell>
                    <Badge variant={l.actor === '系统' ? 'secondary' : 'default'}>{l.actor}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{l.action}</TableCell>
                  <TableCell className="text-muted-foreground leading-relaxed">{l.detail}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    没有匹配的日志记录
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
