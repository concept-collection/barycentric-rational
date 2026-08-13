import type { CSSProperties, ReactNode } from 'react'

interface Props {
  /** the series colour from the palette; the swatch and the on-state carry it */
  color: string
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  children: ReactNode
}

/**
 * A toggle for drawing an extra curve. The swatch shows the colour the curve
 * will have before it is turned on, so the button reads as "add this series"
 * rather than as an anonymous checkbox.
 */
export default function SeriesToggle({ color, on, onChange, disabled, children }: Props) {
  return (
    <button
      className={`chip tone ${on ? 'on' : ''}`}
      style={{ '--tone': color } as CSSProperties}
      aria-pressed={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="swatch" aria-hidden="true" />
      {children}
    </button>
  )
}
