export interface PPTThemeDesign {
  style: "classic" | "modern" | "minimal" | "bold" | "elegant" | "creative";
  headerStyle: "top-bar" | "left-sidebar" | "corner-accent" | "full-banner" | "underline" | "gradient-bar" | "none";
  bulletStyle: "circle" | "square" | "dash" | "arrow" | "check" | "diamond" | "number";
}

export interface PPTTheme {
  id: string;
  name: string;
  category: "classic" | "dark" | "light" | "creative";
  colors: {
    primary: string;
    secondary: string;
    background: string;
    headerBg: string;
    text: string;
    accent: string;
  };
  design: PPTThemeDesign;
}

export const PPT_THEMES: PPTTheme[] = [
  // ============== CLASSIC/ACADEMIC TEMPLATES (0-5) ==============
  {
    id: "academic-blue",
    name: "Academic Blue",
    category: "classic",
    colors: {
      primary: "#1A365D",
      secondary: "#F5A962",
      background: "#0F172A",
      headerBg: "#1E3A5F",
      text: "#FFFFFF",
      accent: "#F97316",
    },
    design: {
      style: "classic",
      headerStyle: "top-bar",
      bulletStyle: "circle",
    },
  },
  {
    id: "professional-teal",
    name: "Professional Teal",
    category: "classic",
    colors: {
      primary: "#0D9488",
      secondary: "#14B8A6",
      background: "#042F2E",
      headerBg: "#115E59",
      text: "#FFFFFF",
      accent: "#2DD4BF",
    },
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      bulletStyle: "arrow",
    },
  },
  {
    id: "classic-red-orange",
    name: "Classic Red-Orange",
    category: "classic",
    colors: {
      primary: "#DC2626",
      secondary: "#F97316",
      background: "#7F1D1D",
      headerBg: "#991B1B",
      text: "#FFFFFF",
      accent: "#FCD34D",
    },
    design: {
      style: "bold",
      headerStyle: "full-banner",
      bulletStyle: "square",
    },
  },
  {
    id: "warm-gradient",
    name: "Warm Gradient",
    category: "light",
    colors: {
      primary: "#92400E",
      secondary: "#F59E0B",
      background: "#FFFBEB",
      headerBg: "#F59E0B",
      text: "#1F2937",
      accent: "#7C3AED",
    },
    design: {
      style: "elegant",
      headerStyle: "underline",
      bulletStyle: "diamond",
    },
  },
  {
    id: "formal-green",
    name: "Formal Green",
    category: "light",
    colors: {
      primary: "#166534",
      secondary: "#F59E0B",
      background: "#F0FDF4",
      headerBg: "#166534",
      text: "#1F2937",
      accent: "#15803D",
    },
    design: {
      style: "classic",
      headerStyle: "left-sidebar",
      bulletStyle: "check",
    },
  },
  {
    id: "modern-purple",
    name: "Modern Purple",
    category: "dark",
    colors: {
      primary: "#7C3AED",
      secondary: "#A78BFA",
      background: "#1E1B4B",
      headerBg: "#4C1D95",
      text: "#FFFFFF",
      accent: "#C4B5FD",
    },
    design: {
      style: "modern",
      headerStyle: "corner-accent",
      bulletStyle: "dash",
    },
  },

  // ============== DARK/PROFESSIONAL TEMPLATES (6-10) ==============
  {
    id: "midnight-navy",
    name: "Midnight Navy",
    category: "dark",
    colors: {
      primary: "#0F172A",
      secondary: "#FBBF24",
      background: "#020617",
      headerBg: "#1E3A8A",
      text: "#FFFFFF",
      accent: "#FCD34D",
    },
    design: {
      style: "elegant",
      headerStyle: "top-bar",
      bulletStyle: "diamond",
    },
  },
  {
    id: "slate-charcoal",
    name: "Slate Charcoal",
    category: "dark",
    colors: {
      primary: "#334155",
      secondary: "#22D3EE",
      background: "#1E293B",
      headerBg: "#475569",
      text: "#FFFFFF",
      accent: "#06B6D4",
    },
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      bulletStyle: "arrow",
    },
  },
  {
    id: "deep-crimson",
    name: "Deep Crimson",
    category: "dark",
    colors: {
      primary: "#881337",
      secondary: "#FB7185",
      background: "#1C1917",
      headerBg: "#9F1239",
      text: "#FFFFFF",
      accent: "#FDA4AF",
    },
    design: {
      style: "bold",
      headerStyle: "full-banner",
      bulletStyle: "square",
    },
  },
  {
    id: "forest-night",
    name: "Forest Night",
    category: "dark",
    colors: {
      primary: "#14532D",
      secondary: "#84CC16",
      background: "#052E16",
      headerBg: "#166534",
      text: "#FFFFFF",
      accent: "#A3E635",
    },
    design: {
      style: "classic",
      headerStyle: "left-sidebar",
      bulletStyle: "circle",
    },
  },
  {
    id: "royal-indigo",
    name: "Royal Indigo",
    category: "dark",
    colors: {
      primary: "#3730A3",
      secondary: "#A78BFA",
      background: "#1E1B4B",
      headerBg: "#4338CA",
      text: "#FFFFFF",
      accent: "#C4B5FD",
    },
    design: {
      style: "elegant",
      headerStyle: "corner-accent",
      bulletStyle: "diamond",
    },
  },

  // ============== LIGHT/CLEAN TEMPLATES (11-15) ==============
  {
    id: "clean-white",
    name: "Clean White",
    category: "light",
    colors: {
      primary: "#0369A1",
      secondary: "#0EA5E9",
      background: "#FFFFFF",
      headerBg: "#0284C7",
      text: "#1F2937",
      accent: "#38BDF8",
    },
    design: {
      style: "minimal",
      headerStyle: "underline",
      bulletStyle: "dash",
    },
  },
  {
    id: "soft-lavender",
    name: "Soft Lavender",
    category: "light",
    colors: {
      primary: "#7C3AED",
      secondary: "#A78BFA",
      background: "#F5F3FF",
      headerBg: "#8B5CF6",
      text: "#1F2937",
      accent: "#C4B5FD",
    },
    design: {
      style: "elegant",
      headerStyle: "top-bar",
      bulletStyle: "circle",
    },
  },
  {
    id: "mint-fresh",
    name: "Mint Fresh",
    category: "light",
    colors: {
      primary: "#059669",
      secondary: "#34D399",
      background: "#ECFDF5",
      headerBg: "#10B981",
      text: "#1F2937",
      accent: "#6EE7B7",
    },
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      bulletStyle: "check",
    },
  },
  {
    id: "warm-sand",
    name: "Warm Sand",
    category: "light",
    colors: {
      primary: "#B45309",
      secondary: "#F59E0B",
      background: "#FFFBEB",
      headerBg: "#D97706",
      text: "#1F2937",
      accent: "#FBBF24",
    },
    design: {
      style: "classic",
      headerStyle: "left-sidebar",
      bulletStyle: "arrow",
    },
  },
  {
    id: "sky-blue",
    name: "Sky Blue",
    category: "light",
    colors: {
      primary: "#0284C7",
      secondary: "#38BDF8",
      background: "#F0F9FF",
      headerBg: "#0369A1",
      text: "#1F2937",
      accent: "#7DD3FC",
    },
    design: {
      style: "minimal",
      headerStyle: "none",
      bulletStyle: "dash",
    },
  },

  // ============== SPECIALTY/CREATIVE TEMPLATES (16-20) ==============
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    category: "creative",
    colors: {
      primary: "#EA580C",
      secondary: "#FB923C",
      background: "#431407",
      headerBg: "#C2410C",
      text: "#FFFFFF",
      accent: "#FDBA74",
    },
    design: {
      style: "creative",
      headerStyle: "full-banner",
      bulletStyle: "arrow",
    },
  },
  {
    id: "ocean-deep",
    name: "Ocean Deep",
    category: "creative",
    colors: {
      primary: "#0E7490",
      secondary: "#22D3EE",
      background: "#083344",
      headerBg: "#0891B2",
      text: "#FFFFFF",
      accent: "#67E8F9",
    },
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      bulletStyle: "circle",
    },
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    category: "creative",
    colors: {
      primary: "#BE185D",
      secondary: "#F472B6",
      background: "#FDF2F8",
      headerBg: "#DB2777",
      text: "#1F2937",
      accent: "#F9A8D4",
    },
    design: {
      style: "elegant",
      headerStyle: "corner-accent",
      bulletStyle: "diamond",
    },
  },
  {
    id: "electric-blue",
    name: "Electric Blue",
    category: "creative",
    colors: {
      primary: "#2563EB",
      secondary: "#60A5FA",
      background: "#172554",
      headerBg: "#1D4ED8",
      text: "#FFFFFF",
      accent: "#93C5FD",
    },
    design: {
      style: "bold",
      headerStyle: "top-bar",
      bulletStyle: "square",
    },
  },
  {
    id: "emerald-prestige",
    name: "Emerald Prestige",
    category: "creative",
    colors: {
      primary: "#047857",
      secondary: "#FBBF24",
      background: "#022C22",
      headerBg: "#059669",
      text: "#FFFFFF",
      accent: "#FCD34D",
    },
    design: {
      style: "elegant",
      headerStyle: "left-sidebar",
      bulletStyle: "diamond",
    },
  },
];

export const THEME_CATEGORIES = [
  { id: "all", label: "All Themes" },
  { id: "classic", label: "Classic" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "creative", label: "Creative" },
] as const;

export type ThemeCategory = typeof THEME_CATEGORIES[number]["id"];
