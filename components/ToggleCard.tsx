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

type ToggleCardProps = {
  value: boolean
  onToggle: () => void
  title: string
  description: string
  theme: Theme
}

export const ToggleCard: React.FC<ToggleCardProps> = ({
  value,
  onToggle,
  title,
  description,
  theme
}) => (
  <button
    aria-pressed={value}
    onClick={onToggle}
    style={{
      display: "flex",
      width: "100%",
      marginTop: 10,
      border: `1px solid ${value ? theme.accent : "transparent"}`,
      borderRadius: 12,
      padding: "10px 12px",
      background: theme.surface,
      color: theme.text,
      cursor: "pointer",
      textAlign: "left",
      boxShadow: value
        ? `inset 6px 6px 12px ${theme.shadowDark}, inset -6px -6px 12px ${theme.shadowLight}`
        : `6px 6px 12px ${theme.shadowDark}, -6px -6px 12px ${theme.shadowLight}`
    }}
    type="button">
    <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12, color: theme.textMuted }}>{description}</span>
    </span>
    <span
      style={{
        marginLeft: "auto",
        width: 44,
        height: 24,
        borderRadius: 999,
        background: value ? theme.accent : theme.background,
        boxShadow: `inset 2px 2px 4px ${theme.shadowDark}, inset -2px -2px 4px ${theme.shadowLight}`,
        position: "relative",
        flexShrink: 0
      }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: theme.surface,
          boxShadow: `2px 2px 4px ${theme.shadowDark}, -2px -2px 4px ${theme.shadowLight}`,
          position: "absolute",
          top: 3,
          left: value ? 23 : 3,
          transition: "left 120ms ease-out"
        }}
      />
    </span>
  </button>
)
