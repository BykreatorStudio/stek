'use client'

export function formatAmount(raw: string): string {
  let s = raw.replace(/\./g, '')
  // Allow only digits and comma
  s = s.replace(/[^\d,]/g, '')
  // Only one comma allowed
  const commaIdx = s.indexOf(',')
  if (commaIdx !== -1) {
    s = s.slice(0, commaIdx + 1) + s.slice(commaIdx + 1).replace(/,/g, '').slice(0, 2)
  }
  const [intPart, decPart] = s.split(',')
  const formatted = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart !== undefined ? `${formatted},${decPart}` : formatted
}

export function parseAmount(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0
}

export default function AmountInput({
  value,
  onChange,
  placeholder,
  readOnly,
  autoFocus,
  style,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  autoFocus?: boolean
  style?: React.CSSProperties
  className?: string
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(formatAmount(e.target.value))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      readOnly={readOnly}
      autoFocus={autoFocus}
      style={style}
      className={className}
    />
  )
}
