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
      if (import.meta.env.DEV) console.error("Verification error:", error);
      setStatus("error");
      setMessage("Payment verification failed. Please contact support if credits weren't added.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === "verifying" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-primary/20 to-accent/10 rounded-2xl border border-primary/20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Verifying Payment</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-primary/20 to-accent/10 rounded-2xl border border-primary/20">
                <CheckCircle className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate("/dashboard")} variant="gradient" className="w-full">
              Go to Dashboard
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-2xl border border-destructive/20">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/dashboard")} variant="outline" className="flex-1">
                Back to Dashboard
              </Button>
              <Button onClick={() => navigate("/pricing")} variant="gradient" className="flex-1">
                Try Again
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
