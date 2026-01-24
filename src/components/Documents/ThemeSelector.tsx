import { useState } from "react";
import { PPT_THEMES, THEME_CATEGORIES, ThemeCategory } from "@/data/pptThemes";
import { ThemePreviewCard } from "./ThemePreviewCard";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ThemeSelectorProps {
  selectedTheme: string;
  onThemeSelect: (themeId: string) => void;
}

export const ThemeSelector = ({ selectedTheme, onThemeSelect }: ThemeSelectorProps) => {
  const [activeCategory, setActiveCategory] = useState<ThemeCategory>("all");

  const filteredThemes = activeCategory === "all"
    ? PPT_THEMES
    : PPT_THEMES.filter((theme) => theme.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {THEME_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              activeCategory === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Theme Grid */}
      <ScrollArea className="h-[320px] pr-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Random option - always first */}
          <ThemePreviewCard
            theme={null}
            isSelected={selectedTheme === "random"}
            onSelect={() => onThemeSelect("random")}
          />

          {/* Theme cards */}
          {filteredThemes.map((theme) => (
            <ThemePreviewCard
              key={theme.id}
              theme={theme}
              isSelected={selectedTheme === theme.id}
              onSelect={() => onThemeSelect(theme.id)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Selected theme info */}
      {selectedTheme !== "random" && (
        <p className="text-xs text-muted-foreground text-center">
          Selected: <span className="font-medium text-foreground">
            {PPT_THEMES.find(t => t.id === selectedTheme)?.name || selectedTheme}
          </span>
        </p>
      )}
    </div>
  );
};
