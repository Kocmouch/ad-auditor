import React from "react"

import type { Theme } from "~lib/ui/theme"

type CdpStatus = "idle" | "loading" | "attached" | "fallback" | "error"

type CdpStatusDisplayProps = {
  status: CdpStatus
  reason: string
  theme: Theme
}

const getStatusUI = (status: CdpStatus, theme: Theme) => {
  switch (status) {
    case "attached":
      return { color: "#34d399", label: "Attached" }
    case "fallback":
      return { color: "#f59e0b", label: "Fallback" }
    case "error":
      return { color: "#ef4444", label: "Error" }
    case "loading":
      return { color: theme.textMuted, label: "Checking..." }
    default:
      return { color: theme.textMuted, label: "Disabled" }
  }
}

export const CdpStatusDisplay: React.FC<CdpStatusDisplayProps> = ({
  status,
  reason,
  theme
}) => {
  const statusUI = getStatusUI(status, theme)

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 12,
        padding: "10px 12px",
        border: `1px solid ${theme.accent}`,
        background: theme.surface,
        boxShadow: `inset 4px 4px 8px ${theme.shadowDark}, inset -4px -4px 8px ${theme.shadowLight}`
      }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
        CDP status:{" "}
        <span style={{ color: statusUI.color }}>{statusUI.label}</span>
      </p>
      {reason && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: theme.textMuted }}>
          {reason}
        </p>
      )}
    </div>
  )
}
