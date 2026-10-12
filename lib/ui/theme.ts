export type Theme = {
  background: string
  surface: string
  text: string
  textMuted: string
  shadowLight: string
  shadowDark: string
  accent: string
}

export const getDarkTheme = (): Theme => ({
  background: "#2a2f3a",
  surface: "#313745",
  text: "#f3f5f9",
  textMuted: "#b5bdcd",
  shadowLight: "rgba(255, 255, 255, 0.05)",
  shadowDark: "rgba(15, 18, 24, 0.6)",
  accent: "#7dff6a"
})

export const getLightTheme = (): Theme => ({
  background: "#e8edf7",
  surface: "#e8edf7",
  text: "#1f2937",
  textMuted: "#4b5563",
  shadowLight: "rgba(255, 255, 255, 0.95)",
  shadowDark: "rgba(154, 170, 207, 0.6)",
  accent: "#0f7f5f"
})

export const getTheme = (isDark: boolean): Theme =>
  isDark ? getDarkTheme() : getLightTheme()
