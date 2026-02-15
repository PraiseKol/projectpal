import { useAppSettings } from "@/hooks/useAppSettings";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
}

export const FeatureGate = ({ feature, children }: FeatureGateProps) => {
  const { isLoading, isFeatureEnabled } = useAppSettings();

  if (isLoading) return null;

  if (!isFeatureEnabled(feature)) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-8 max-w-md mx-4 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Feature Unavailable</h2>
            <p className="text-muted-foreground">
              This feature is currently disabled by the administrator. Please check back later.
            </p>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
};
