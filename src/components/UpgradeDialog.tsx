import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles, Crown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  featureDescription: string;
  requiredPlan: 'pro' | 'scholar';
  currentPlan: string;
}

const planDetails = {
  pro: {
    name: 'Pro',
    icon: Sparkles,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  scholar: {
    name: 'Scholar',
    icon: Crown,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
  },
};

export const UpgradeDialog = ({
  open,
  onOpenChange,
  featureName,
  featureDescription,
  requiredPlan,
  currentPlan,
}: UpgradeDialogProps) => {
  const navigate = useNavigate();
  const planInfo = planDetails[requiredPlan];
  const PlanIcon = planInfo.icon;

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/pricing?plan=${requiredPlan}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-muted w-fit">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <DialogTitle className="text-xl">{featureName}</DialogTitle>
          <DialogDescription className="text-base mt-2">
            {featureDescription}
          </DialogDescription>
        </DialogHeader>

        <div className={`p-4 rounded-xl ${planInfo.bgColor} border border-border/50 my-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-background`}>
              <PlanIcon className={`h-5 w-5 ${planInfo.color}`} />
            </div>
            <div>
              <p className="font-medium">
                Requires <Badge variant="secondary">{planInfo.name}</Badge> Plan
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentPlan === 'free' 
                  ? `Upgrade from Free to ${planInfo.name} to unlock this feature`
                  : `Upgrade to ${planInfo.name} to unlock this feature`
                }
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleUpgrade} className="w-full gap-2" variant="gradient">
            Upgrade to {planInfo.name}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
