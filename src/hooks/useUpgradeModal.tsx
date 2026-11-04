import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { logError } from "@/utils/errorMessages";

type RequiredPlan = "pro" | "scholar";

interface UpgradeRequest {
  /** What the user was trying to do, e.g. "Copy your paraphrased text" */
  featureName: string;
  /** Short, friendly explanation of what upgrading unlocks */
  featureDescription: string;
  /** Lowest plan that unlocks the feature */
  requiredPlan: RequiredPlan;
}

interface UpgradeModalContextValue {
  /** Opens the unified upgrade dialog. One treatment for every paywall in the app. */
  showUpgrade: (request: UpgradeRequest) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null);

export const useUpgradeModal = () => {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error("useUpgradeModal must be used within UpgradeModalProvider");
  return ctx;
};

/**
 * Single reusable upgrade dialog. Replaces the scattered "upgrade" toasts so
 * every paywall in the app looks and behaves the same way.
 */
export const UpgradeModalProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [request, setRequest] = useState<UpgradeRequest | null>(null);

  const showUpgrade = useCallback((req: UpgradeRequest) => {
    setRequest(req);
    setOpen(true);
    // Always read the live plan so expired subscriptions are handled correctly
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan_type, credits_expiry_date")
          .eq("id", user.id)
          .single();
        if (!profile) return;
        const expired = profile.credits_expiry_date
          ? new Date(profile.credits_expiry_date) < new Date()
          : true;
        setCurrentPlan(profile.plan_type !== "free" && !expired ? profile.plan_type : "free");
      } catch (error) {
        logError("UpgradeModal:currentPlan", error);
      }
    })();
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ showUpgrade }}>
      {children}
      <UpgradeDialog
        open={open}
        onOpenChange={setOpen}
        featureName={request?.featureName ?? ""}
        featureDescription={request?.featureDescription ?? ""}
        requiredPlan={request?.requiredPlan ?? "pro"}
        currentPlan={currentPlan}
      />
    </UpgradeModalContext.Provider>
  );
};
