import { useAppSettings } from "@/hooks/useAppSettings";
import { AlertTriangle } from "lucide-react";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
}

export const FeatureGate = ({ feature, children }: FeatureGateProps) => {
  const { isLoading, isFeatureEnabled } = useAppSettings();

  if (isLoading) return null;

  if (!isFeatureEnabled(feature)) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-50 blur-[2px]">
          {children}
        </div>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-8 max-w-md mx-4 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Feature Unavailable</h2>
            <p className="text-muted-foreground">
              This feature is currently disabled by the administrator. Please check back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
