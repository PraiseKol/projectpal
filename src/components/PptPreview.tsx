import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScreenshotShield } from "@/components/ScreenshotShield";
import { UpgradeDialog } from "@/components/UpgradeDialog";

export interface PptPreviewSlide {
  type: "title" | "content" | "section" | "table" | "conclusion" | "references" | "thankyou";
  title: string;
  subtitle?: string;
  bullets?: string[];
  tableData?: { headers: string[]; rows: string[][] };
}

export interface PptPreviewData {
  title: string;
  theme: {
    name: string;
    primary: string;
    secondary: string;
    background: string;
    headerBg: string;
    text: string;
    accent: string;
  };
  slides: PptPreviewSlide[];
}

const hex = (c: string) => (c?.startsWith("#") ? c : `#${c}`);

const SlideCard = ({ slide, index, total, theme }: { slide: PptPreviewSlide; index: number; total: number; theme: PptPreviewData["theme"] }) => {
  const isCover = slide.type === "title" || slide.type === "section" || slide.type === "thankyou";
  const bg = isCover ? hex(theme.headerBg || theme.primary) : hex(theme.background);
  const fg = isCover ? "#ffffff" : hex(theme.text);

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        Slide {index + 1} of {total}
      </p>
      <div
        className="aspect-video w-full rounded-xl border shadow-sm overflow-hidden flex flex-col p-5 sm:p-8"
        style={{ background: bg, color: fg }}
      >
        <h3
          className={`font-bold leading-tight ${isCover ? "text-xl sm:text-3xl my-auto text-center" : "text-base sm:text-xl mb-3"}`}
          style={!isCover ? { color: hex(theme.primary) } : undefined}
        >
          {slide.title}
        </h3>
        {isCover && slide.subtitle && <p className="text-center text-xs sm:text-sm opacity-90 mb-auto">{slide.subtitle}</p>}

        {!isCover && slide.bullets && slide.bullets.length > 0 && (
          <ul className="space-y-1.5 text-xs sm:text-sm">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span style={{ color: hex(theme.accent) }}>•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {!isCover && slide.tableData && (
          <div className="overflow-x-auto text-[10px] sm:text-xs mt-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {slide.tableData.headers.map((h, i) => (
                    <th key={i} className="border px-2 py-1 text-left text-white" style={{ background: hex(theme.primary) }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.tableData.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci} className="border px-2 py-1">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const PptPreview = ({ data }: { data: PptPreviewData }) => {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Your free preview is ready
            </h3>
            <p className="text-sm text-muted-foreground">
              This is the structure of your deck. Scholar turns it into a downloadable PowerPoint with the full
              design and AI images. The preview is watermarked with your account email.
            </p>
          </div>
          <Button variant="gradient" onClick={() => setShowUpgrade(true)}>
            <Lock className="h-4 w-4 mr-2" />
            Download PowerPoint
          </Button>
        </div>
      </Card>

      <ScreenshotShield enabled>
        <div className="grid gap-5 sm:grid-cols-2 p-1">
          {data.slides.map((s, i) => (
            <SlideCard key={i} slide={s} index={i} total={data.slides.length} theme={data.theme} />
          ))}
        </div>
      </ScreenshotShield>

      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        featureName="Download PowerPoint"
        featureDescription="Download this presentation as a PowerPoint file, with the full template design and AI-generated images."
        requiredPlan="scholar"
        currentPlan="free"
      />
    </div>
  );
};
