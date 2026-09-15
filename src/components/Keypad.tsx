'use client'

import type { Answer } from '@/lib/curriculum/types'

/**
 * Big targets: this is used by five-year-olds on tablets. Nothing here decides
 * anything — key rules live in `@/lib/session/keypad`.
 */

const KEY = 'h-16 rounded-2xl text-2xl font-semibold transition active:scale-95 ' +
  'bg-slate-100 text-slate-900 hover:bg-slate-200 ' +
  'dark:bg-slate-700 dark:text-slate-50 dark:hover:bg-slate-600'

type Props = {
  answer: Answer
  onKey: (key: string) => void
  onSubmit: () => void
  canSubmit: boolean
  disabled: boolean
}

export function Keypad({ answer, onKey, onSubmit, canSubmit, disabled }: Props) {
  // Comparison and yes/no need buttons, not digits.
  if (answer.kind === 'choice') {
    return (
      <div className="grid grid-cols-3 gap-3" role="group" aria-label="Choose an answer">
        {answer.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onKey(`choice:${option}`)}
            className={`${KEY} col-span-1 disabled:opacity-40`}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  const needsMinus = answer.kind === 'integer'
  const needsPoint = answer.kind === 'decimal'
  const needsSlash = answer.kind === 'fraction' || answer.kind === 'mixed'
  // A quotient-and-remainder or a ratio needs the key that joins its two parts.
  const separator = answer.kind === 'parts' ? answer.separator : undefined

  return (
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" disabled={disabled} onClick={() => onKey(d)} className={`${KEY} disabled:opacity-40`}>
          {d}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onKey(separator ?? (needsSlash ? '/' : needsPoint ? '.' : needsMinus ? '-' : 'clear'))}
        className={`${KEY} disabled:opacity-40`}
        aria-label={
          separator === 'r' ? 'Remainder'
          : separator === ':' ? 'Ratio separator'
          : needsSlash ? 'Divide, for a fraction'
          : needsPoint ? 'Decimal point'
          : needsMinus ? 'Minus' : 'Clear'
        }
      >
        {separator ?? (needsSlash ? '/' : needsPoint ? '.' : needsMinus ? '−' : 'C')}
      </button>

      <button type="button" disabled={disabled} onClick={() => onKey('0')} className={`${KEY} disabled:opacity-40`}>
        0
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onKey('back')}
        className={`${KEY} disabled:opacity-40`}
        aria-label="Delete"
      >
        ⌫
      </button>

      <button
        type="button"
        disabled={disabled || !canSubmit}
        onClick={onSubmit}
        className="col-span-3 h-16 rounded-2xl bg-emerald-500 text-2xl font-bold text-white
                   transition active:scale-95 hover:bg-emerald-600 disabled:opacity-30"
      >
        Check
      </button>
    </div>
  )
}
