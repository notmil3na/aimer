---
name: MiMalla
colors:
  starlight-gold: "#c8a96e"
  antique-copper: "#8b6f3a"
  nebula-night: "#0e0a18"
  lilac-paper: "#f8f4fc"
  glass-surface: "rgba(255,255,255,0.045)"
  glass-surface-bright: "rgba(255,255,255,0.075)"
  glass-line: "rgba(255,255,255,0.10)"
  moonbeam-text: "#f4f1fb"
  hazy-lilac: "#9b93b8"
  night-ink: "#241f33"
  lavender-ink: "#756c8f"
  deep-nebula: "#1e1a2e"
typography:
  display:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.1
    fontStyle: "normal"
  displayItalic:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontWeight: 500
    lineHeight: 1.1
    fontStyle: "italic"
    color: "var(--accent)"
  numeral:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontVariantNumeric: "tabular-nums"
  body:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
    fontSize: "13px"
  label:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontWeight: 600
    fontSize: "11px"
    letterSpacing: "0.08em"
    textTransform: "uppercase"
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "26px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.starlight-gold}"
    textColor: "#14101f"
    rounded: "{rounded.sm}"
    padding: "9px 20px"
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.moonbeam-text}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
    border: "1px solid {colors.glass-line}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.hazy-lilac}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.starlight-gold}"
    textColor: "#16121f"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.moonbeam-text}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    border: "1px solid {colors.glass-line}"
  chip:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.hazy-lilac}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
    border: "1px solid {colors.glass-line}"
  input:
    backgroundColor: "{colors.glass-surface-bright}"
    textColor: "{colors.moonbeam-text}"
    rounded: "{rounded.sm}"
    padding: "11px 14px"
    border: "1px solid {colors.glass-line}"
