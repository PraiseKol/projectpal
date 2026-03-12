import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle2, XCircle, Star, Link, BarChart3, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateError, logError } from "@/utils/errorMessages";
import { AmbassadorRequestModal } from "./AmbassadorRequestModal";

interface AmbassadorRequestCardProps {
  userId: string;
  isAmbassador: boolean;
  planType: string;
  creditsExpiry: string | null;
}

export const AmbassadorRequestCard = ({ userId, isAmbassador, planType, creditsExpiry }: AmbassadorRequestCardProps) => {
  const navigate = useNavigate();
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const isActivePaidUser = () => {
    if (planType === 'free') return false;
    if (!creditsExpiry) return false;
    return new Date(creditsExpiry) > new Date();
  };

  useEffect(() => {
    loadRequestStatus();
  }, [userId]);

  const loadRequestStatus = async () => {
    try {
      const response = await supabase.functions.invoke("ambassador-operations", {
        body: { action: "getMyAmbassadorRequest" },
      });
      if (response.data?.request) {
        setRequestStatus(response.data.request.status);
      }
    } catch (error) {
      logError("AmbassadorRequestCard:load", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAmbassador || isLoading) return null;

  const canRequest = !requestStatus || requestStatus === "declined" || (requestStatus === "approved" && !isAmbassador);
  const paidUser = isActivePaidUser();

  const ambassadorPerks = [
    { icon: Coins, text: "Earn 10% commission on referral subscriptions" },
    { icon: Link, text: "Get a unique shareable referral code" },
    { icon: BarChart3, text: "Access to the Ambassador Portal with analytics" },
    { icon: Star, text: "Track referrals and earnings in real-time" },
  ];

  return (
    <>
      <Card className="mb-6 shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Become an Ambassador
          </CardTitle>
          <CardDescription>
            Earn 10% commission on all subscriptions made by users who sign up with your referral code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!paidUser && canRequest ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {ambassadorPerks.map((perk, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <perk.icon className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{perk.text}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => navigate("/pricing")} className="w-full rounded-xl">
                Upgrade to a Paid Plan to Request
              </Button>
            </div>
          ) : (
            <>
              {requestStatus === "pending" && (
                <div className="flex items-center gap-2 p-4 bg-accent rounded-xl">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Request Pending</p>
                    <p className="text-sm text-muted-foreground">Your ambassador request is being reviewed by an admin.</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">Pending</Badge>
                </div>
              )}
              {requestStatus === "approved" && !isAmbassador && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-4 bg-accent rounded-xl">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">Ambassador Status Revoked</p>
                      <p className="text-sm text-muted-foreground">Your ambassador role was removed. You can request again below.</p>
                    </div>
                  </div>
                  <Button onClick={() => setShowModal(true)} className="w-full rounded-xl">
                    Request Ambassador Role Again
                  </Button>
                </div>
              )}
              {requestStatus === "declined" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-4 bg-accent rounded-xl">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">Request Declined</p>
                      <p className="text-sm text-muted-foreground">Your previous request was not approved. You can try again.</p>
                    </div>
                  </div>
                  <Button onClick={() => setShowModal(true)} className="w-full rounded-xl">
                    Request Ambassador Role Again
                  </Button>
                </div>
              )}
              {!requestStatus && (
                <Button onClick={() => setShowModal(true)} className="w-full rounded-xl">
                  Request Ambassador Role
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AmbassadorRequestModal
        open={showModal}
        onOpenChange={setShowModal}
        onSuccess={() => setRequestStatus("pending")}
      />
    </>
  );
};
