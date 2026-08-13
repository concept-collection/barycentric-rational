import type { ReactNode } from 'react'

/**
 * A closed-by-default disclosure holding the paper-level detail: equation and
 * theorem numbers, table references, the finer print. The one plain sentence
 * that precedes it is what a first-time visitor reads.
 */
export default function More({ label = 'from the paper', children }: { label?: string; children: ReactNode }) {
  return (
    <details className="more">
      <summary>{label}</summary>
      <div className="more-body">{children}</div>
    </details>
  )
}
