import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X } from "lucide-react";

interface TourStep {
  /** data-tour attribute of the highlighted element; null = centered card */
  targetId: string | null;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaRoute?: string;
}

const STEPS: TourStep[] = [
  {
    targetId: null,
    title: "Welcome to ProjectPal",
    body: "This 4-step tour shows you where everything is. It takes less than a minute.",
  },
  {
    targetId: "tour-start-card",
    title: "Start here",
    body: "Pick a starting point — generate a topic, write a chapter, or just ask a question. Your first steps cost only a credit or two.",
  },
  {
    targetId: "tour-credits-card",
    title: "Your free credits",
    body: "New accounts start with daily credits drawn from a monthly pool. Ask a question right now — bigger jobs like full chapters may need a paid plan.",
  },
  {
    targetId: "tour-tools-grid",
    title: "Everything you need",
    body: "Writing, paraphrasing and humanizing are ready to use. PowerPoint generation and data analysis unlock on the Scholar plan.",
  },
  {
    targetId: null,
    title: "You're all set",
    body: "Open your first chat and watch ProjectPal get to work on your project.",
    ctaLabel: "Start my first chat",
    ctaRoute: "/chat",
  },
];

const STORAGE_PREFIX = "projectpal_dashboard_tour_completed_";

export const DashboardTour = ({ userId }: { userId: string | null }) => {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  // Auto-start once per user
  useEffect(() => {
    if (!userId) return;
    const seen = localStorage.getItem(STORAGE_PREFIX + userId) === "true";
    if (seen) return;
    const timer = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(timer);
  }, [userId]);

  const updateRect = () => {
    if (!step.targetId) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.targetId}"]`);
    setTargetRect(el ? el.getBoundingClientRect() : null);
  };

  useEffect(() => {
    if (!active) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    const interval = setInterval(updateRect, 200);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  const finish = () => {
    setActive(false);
    if (userId) localStorage.setItem(STORAGE_PREFIX + userId, "true");
  };

  const restart = () => {
    setStepIndex(0);
    setActive(true);
  };

  const tooltipPos = useMemo(() => {
    if (!targetRect) return null;
    const width = 320;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, targetRect.left + targetRect.width / 2 - width / 2));
    let top = targetRect.bottom + 12;
    if (top + 220 > window.innerHeight) top = Math.max(12, targetRect.top - 232);
    return { left, top, width };
  }, [targetRect]);

  if (!active) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Show the dashboard tour again"
        className="hidden md:inline-flex text-muted-foreground"
        onClick={restart}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
    );
  }

  const tooltip = step.targetId && tooltipPos
    ? { ...tooltipPos }
    : null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dimmed backdrop; clicking it is not a skip — use the explicit buttons */}
      <div className="absolute inset-0 bg-black/60" />

      {step.targetId && targetRect && (
        <div
          className="absolute border-2 border-primary rounded-xl shadow-lg shadow-primary/40 transition-all duration-200 pointer-events-none"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {tooltip ? (
        <Card
          className="absolute p-4 rounded-2xl shadow-xl animate-fade-in"
          style={{ left: tooltip.left, top: tooltip.top, width: tooltip.width }}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base">{step.title}</h3>
            <button
              onClick={finish}
              aria-label="Skip tour"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{step.body}</p>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              {stepIndex + 1} of {STEPS.length}
            </span>
            <div className="flex gap-2">
              {stepIndex > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setStepIndex(stepIndex - 1)}>
                  Back
                </Button>
              )}
              <Button variant="gradient" size="sm" onClick={() => (isLast ? finish() : setStepIndex(stepIndex + 1))}>
                {isLast ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 rounded-2xl shadow-xl animate-fade-in">
            <div className="flex items-start justify-between gap-2">
              <div className="p-2.5 bg-gradient-to-br from-primary to-secondary rounded-xl">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <button
                onClick={finish}
                aria-label="Skip tour"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="font-semibold text-lg mt-4">{step.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{step.body}</p>
            <div className="flex items-center justify-between mt-5">
              <span className="text-xs text-muted-foreground">
                {stepIndex + 1} of {STEPS.length}
              </span>
              <div className="flex gap-2">
                {stepIndex > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setStepIndex(stepIndex - 1)}>
                    Back
                  </Button>
                )}
                {isLast && step.ctaRoute ? (
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => {
                      finish();
                      navigate(step.ctaRoute!);
                    }}
                  >
                    {step.ctaLabel}
                  </Button>
                ) : (
                  <Button variant="gradient" size="sm" onClick={() => setStepIndex(stepIndex + 1)}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DashboardTour;
