import { useAppSettings } from "@/hooks/useAppSettings";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
}

export const FeatureGate = ({ feature, children }: FeatureGateProps) => {
  const { isLoading, isFeatureEnabled } = useAppSettings();
  const navigate = useNavigate();

  if (isLoading) return null;

  if (!isFeatureEnabled(feature)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-4">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Feature Unavailable</h1>
          <p className="text-muted-foreground">
            This feature is currently disabled by the administrator.
          </p>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
