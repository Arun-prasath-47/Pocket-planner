const STYLE_KEY = "pocket-planner-style";
const MODE_KEY = "pocket-planner-mode";

export type ThemeStyle = "soft" | "oled" | "bento" | "gold";
export type ThemeMode = "light" | "dark" | "system";

export const THEME_STYLES: {
  id: ThemeStyle;
  name: string;
  description: string;
  preview: string[];
}[] = [
  {
    id: "soft",
    name: "Soft UI",
    description: "Clean light surfaces, trust-blue primary — calm, professional.",
    preview: ["#f4f6f9", "#1e40af", "#059669"],
  },
  {
    id: "oled",
    name: "OLED Dark",
    description: "Deep navy + blue/green glow — high-contrast night mode.",
    preview: ["#0f172a", "#3b82f6", "#10b981"],
  },
  {
    id: "bento",
    name: "Premium Bento",
    description: "Apple-style modular cards, black + gold accent.",
    preview: ["#fafaf9", "#1c1917", "#a16207"],
  },
  {
    id: "gold",
    name: "Gold Minimal",
    description: "Bold gold + charcoal on navy, oversized typography.",
    preview: ["#0f172a", "#f59e0b", "#8b5cf6"],
  },
];

export function getStoredStyle(): ThemeStyle {
  const stored = localStorage.getItem(STYLE_KEY);
  if (stored === "soft" || stored === "oled" || stored === "bento" || stored === "gold") {
    return stored;
  }
  return "soft";
}

export function getStoredMode(): ThemeMode {
  const legacy = localStorage.getItem("pocket-planner-theme");
  if (legacy === "light" || legacy === "dark" || legacy === "system") {
    localStorage.removeItem("pocket-planner-theme");
    localStorage.setItem(MODE_KEY, legacy);
    return legacy;
  }
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(style: ThemeStyle, mode: ThemeMode) {
  const el = document.documentElement;
  for (const s of THEME_STYLES) el.classList.toggle(`theme-${s.id}`, s.id === style);
  el.classList.toggle("dark", resolveMode(mode) === "dark");
}

export function setStyle(style: ThemeStyle) {
  localStorage.setItem(STYLE_KEY, style);
  applyTheme(style, getStoredMode());
}

export function setMode(mode: ThemeMode) {
  localStorage.setItem(MODE_KEY, mode);
  applyTheme(getStoredStyle(), mode);
}

export function initTheme() {
  applyTheme(getStoredStyle(), getStoredMode());
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener?.("change", () => {
    if (getStoredMode() === "system") applyTheme(getStoredStyle(), "system");
  });
}
