import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectPalLogoProps {
  showText?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "p-1.5",
    icon: "h-4 w-4",
    text: "text-lg",
  },
  default: {
    container: "p-2",
    icon: "h-5 w-5",
    text: "text-xl",
  },
  lg: {
    container: "p-3",
    icon: "h-8 w-8",
    text: "text-2xl",
  },
};

export const ProjectPalLogo = ({
  showText = true,
  size = "default",
  className,
}: ProjectPalLogoProps) => {
  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-md",
          config.container
        )}
      >
        <GraduationCap className={cn("text-primary-foreground", config.icon)} />
      </div>
      {showText && (
        <span
          className={cn(
            "font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent",
            config.text
          )}
        >
          ProjectPal
        </span>
      )}
    </div>
  );
};
