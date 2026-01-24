import { PPTTheme } from "@/data/pptThemes";
import { Check, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemePreviewCardProps {
  theme: PPTTheme | null; // null for random option
  isSelected: boolean;
  onSelect: () => void;
}

const getBulletChar = (style: string): string => {
  const bullets: Record<string, string> = {
    circle: "•",
    square: "■",
    dash: "—",
    arrow: "→",
    check: "✓",
    diamond: "◆",
    number: "1.",
  };
  return bullets[style] || "•";
};

export const ThemePreviewCard = ({ theme, isSelected, onSelect }: ThemePreviewCardProps) => {
  // Random theme card
  if (!theme) {
    return (
      <button
        onClick={onSelect}
        className={cn(
          "group relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200",
          "hover:shadow-md hover:scale-[1.02]",
          isSelected
            ? "border-primary bg-primary/5 shadow-md"
            : "border-border hover:border-primary/50"
        )}
      >
        <div className="w-full aspect-[16/10] rounded-lg bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 flex items-center justify-center mb-2 overflow-hidden">
          <Shuffle className="h-8 w-8 text-primary/60" />
        </div>
        <span className="text-xs font-medium text-center truncate w-full">
          🎲 Random
        </span>
        {isSelected && (
          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </button>
    );
  }

  const { colors, design, name } = theme;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200",
        "hover:shadow-md hover:scale-[1.02]",
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Mini Slide Preview */}
      <div
        className="w-full aspect-[16/10] rounded-lg overflow-hidden mb-2 relative"
        style={{ backgroundColor: colors.background }}
      >
        {/* Header styles */}
        {design.headerStyle === "top-bar" && (
          <div
            className="absolute top-0 left-0 right-0 h-[20%]"
            style={{ backgroundColor: colors.headerBg }}
          />
        )}
        {design.headerStyle === "left-sidebar" && (
          <div
            className="absolute top-0 left-0 bottom-0 w-[15%]"
            style={{ backgroundColor: colors.headerBg }}
          />
        )}
        {design.headerStyle === "corner-accent" && (
          <div
            className="absolute top-0 left-0 w-0 h-0"
            style={{
              borderLeft: "24px solid " + colors.primary,
              borderBottom: "24px solid transparent",
            }}
          />
        )}
        {design.headerStyle === "full-banner" && (
          <div
            className="absolute top-0 left-0 right-0 h-[35%]"
            style={{ backgroundColor: colors.headerBg }}
          />
        )}
        {design.headerStyle === "underline" && (
          <div
            className="absolute top-[28%] left-[10%] right-[10%] h-[2px]"
            style={{ backgroundColor: colors.accent }}
          />
        )}
        {design.headerStyle === "gradient-bar" && (
          <div
            className="absolute top-0 left-0 right-0 h-[15%]"
            style={{
              background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
            }}
          />
        )}

        {/* Title area */}
        <div
          className="absolute left-[10%] right-[10%]"
          style={{
            top: design.headerStyle === "full-banner" ? "12%" : "25%",
          }}
        >
          <div
            className="h-1.5 rounded-full mb-1"
            style={{
              backgroundColor:
                design.headerStyle === "full-banner" ? "#ffffff" : colors.text,
              width: "60%",
            }}
          />
          <div
            className="h-1 rounded-full opacity-60"
            style={{
              backgroundColor:
                design.headerStyle === "full-banner" ? "#ffffff" : colors.text,
              width: "40%",
            }}
          />
        </div>

        {/* Bullet points */}
        <div
          className="absolute left-[12%] right-[10%] space-y-1"
          style={{
            top: design.headerStyle === "full-banner" ? "50%" : "55%",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className="text-[6px] leading-none"
                style={{ color: colors.accent }}
              >
                {getBulletChar(design.bulletStyle)}
              </span>
              <div
                className="h-0.5 rounded-full"
                style={{
                  backgroundColor: colors.text,
                  width: `${70 - i * 15}%`,
                  opacity: 0.6,
                }}
              />
            </div>
          ))}
        </div>

        {/* Bottom accent for some styles */}
        {design.style === "elegant" && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[3%]"
            style={{ backgroundColor: colors.accent }}
          />
        )}
      </div>

      {/* Theme Name */}
      <span
        className="text-xs font-medium text-center truncate w-full"
        style={{ color: undefined }}
      >
        {name}
      </span>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};
