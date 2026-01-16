import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    const reference = searchParams.get("reference");
    
    if (!reference) {
      setStatus("error");
      setMessage("Payment reference not found");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference },
      });

      if (error) throw error;

      if (data.error) {
        setStatus("error");
        setMessage(data.error);
        return;
      }

      setStatus("success");
      setMessage(`Payment successful! You've received ${data.credits_added} credits.`);
    } catch (error: any) {
      console.error("Verification error:", error);
      setStatus("error");
      setMessage(error.message || "Failed to verify payment");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Verifying Payment</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="space-y-2">
              <Button onClick={() => navigate("/pricing")} className="w-full">
                Try Again
              </Button>
              <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
