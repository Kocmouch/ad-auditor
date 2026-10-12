import React from "react"

type Theme = {
  background: string
  surface: string
  text: string
  textMuted: string
  shadowLight: string
  shadowDark: string
  accent: string
}

type Option<T> = {
  value: T
  label: string
  description: string
  badge: string
}

type OptionCardsProps<T extends string> = {
  options: Array<Option<T>>
  selectedValue: T
  onSelect: (value: T) => void
  ariaLabel: string
  theme: Theme
}

export function OptionCards<T extends string>({
  options,
  selectedValue,
  onSelect,
  ariaLabel,
  theme
}: OptionCardsProps<T>) {
  return (
    <div
      aria-label={ariaLabel}
      role="radiogroup"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map((option) => {
        const selected = selectedValue === option.value

        return (
          <button
            aria-checked={selected}
            aria-label={option.label}
            key={option.value}
            onClick={() => onSelect(option.value)}
            role="radio"
            type="button"
            style={{
              display: "flex",
              gap: 10,
              width: "100%",
              padding: 10,
              borderRadius: 12,
              background: theme.surface,
              color: theme.text,
              alignItems: "flex-start",
              cursor: "pointer",
              textAlign: "left" as const,
              border: selected
                ? `1px solid ${theme.accent}`
                : "1px solid transparent",
              boxShadow: selected
                ? `inset 6px 6px 12px ${theme.shadowDark}, inset -6px -6px 12px ${theme.shadowLight}`
                : `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
            }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: selected ? theme.surface : theme.textMuted,
                background: selected ? theme.accent : theme.background,
                boxShadow: selected
                  ? `inset 2px 2px 4px ${theme.shadowDark}, inset -2px -2px 4px ${theme.shadowLight}`
                  : `2px 2px 5px ${theme.shadowDark}, -2px -2px 5px ${theme.shadowLight}`
              }}>
              {option.badge}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {option.label}
              </span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>
                {option.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
