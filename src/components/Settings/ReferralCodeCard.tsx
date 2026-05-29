import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Tag, Copy, Check, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateError, logError } from "@/utils/errorMessages";
import { useEffect } from "react";
import { ShareWithClassmates } from "@/components/ShareWithClassmates";

interface ReferralCodeCardProps {
  referredBy: string | null;
  onUpdate: () => void;
}

export const ReferralCodeCard = ({ referredBy, onUpdate }: ReferralCodeCardProps) => {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (data) setMyCode(data.code);
    })();
  }, []);

  const copyCode = async () => {
    if (!myCode) return;
    await navigator.clipboard.writeText(myCode);
    setCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setCopied(false), 1500);
  };

  const myCodeBlock = myCode && (
    <Card className="mb-6 shadow-lg rounded-2xl border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Your referral code
        </CardTitle>
        <CardDescription>
          Earn <strong>20 bonus credits</strong> when a friend signs up and <strong>100 credits</strong> when they make their first purchase. They also get 10% off their first 3 purchases.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input value={myCode} readOnly className="rounded-xl font-mono text-lg font-bold" />
          <Button onClick={copyCode} variant="outline" size="icon">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <ShareWithClassmates />
      </CardContent>
    </Card>
  );

  if (referredBy) {
    return (
      <>
        {myCodeBlock}
        <Card className="mb-6 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-4 bg-accent rounded-xl">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Referral code has been permanently set.</p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("Please enter a referral code");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke("ambassador-operations", {
        body: { action: "setReferralCode", code: code.trim() },
      });
      if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        toast.success("Referral code set successfully!");
        onUpdate();
      }
    } catch (error) {
      logError("ReferralCodeCard:submit", error);
      toast.error(translateError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    {myCodeBlock}
    <Card className="mb-6 shadow-lg rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Referral Code
        </CardTitle>
        <CardDescription>
          Were you referred by an ambassador? Enter their referral code to link your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Enter referral code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="rounded-xl"
        />
        <Button onClick={handleSubmit} disabled={isSubmitting} variant="outline" className="w-full rounded-xl">
          {isSubmitting ? "Setting..." : "Set Referral Code"}
        </Button>
      </CardContent>
    </Card>
    </>
  );
};
