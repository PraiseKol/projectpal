import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateError, logError } from "@/utils/errorMessages";

interface AmbassadorRequestCardProps {
  userId: string;
  isAmbassador: boolean;
}

export const AmbassadorRequestCard = ({ userId, isAmbassador }: AmbassadorRequestCardProps) => {
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleRequest = async () => {
    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke("ambassador-operations", {
        body: { action: "requestAmbassadorRole" },
      });
      if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        toast.success("Ambassador request submitted!");
        setRequestStatus("pending");
      }
    } catch (error) {
      logError("AmbassadorRequestCard:request", error);
      toast.error(translateError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAmbassador || isLoading) return null;

  // Show the request button if: no request yet, declined, or was approved but role was revoked (not currently ambassador)
  const canRequest = !requestStatus || requestStatus === "declined" || (requestStatus === "approved" && !isAmbassador);

  return (
    <Card className="mb-6 shadow-lg rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Become an Ambassador
        </CardTitle>
        <CardDescription>
          Earn 5% commission on all subscriptions made by users who sign up with your referral code.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            <Button onClick={handleRequest} disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? "Submitting..." : "Request Ambassador Role Again"}
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
            <Button onClick={handleRequest} disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? "Submitting..." : "Request Ambassador Role Again"}
            </Button>
          </div>
        )}
        {!requestStatus && (
          <Button onClick={handleRequest} disabled={isSubmitting} className="w-full rounded-xl">
            {isSubmitting ? "Submitting..." : "Request Ambassador Role"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
