import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../lib/utils'

const LABELS = ['非常不满意', '不满意', '一般', '满意', '非常满意']

export function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number
  onChange: (v: number) => void
  size?: 'md' | 'lg'
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const starCls = size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="评分">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={`${v} 分，${LABELS[v - 1]}`}
          className="p-0.5 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer transition-transform hover:scale-110"
          onMouseEnter={() => setHover(v)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(v)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(v)}
        >
          <Star
            className={cn(
              starCls,
              'transition-colors',
              v <= shown ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300',
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground min-w-16">
        {shown ? `${shown} 分 · ${LABELS[shown - 1]}` : '请打分'}
      </span>
    </div>
  )
}

export function ScoreStars({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`得分 ${value}`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className={cn(
            'w-4 h-4',
            v <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300',
          )}
        />
      ))}
    </div>
  )
}
