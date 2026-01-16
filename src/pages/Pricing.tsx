import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, GraduationCap, Sparkles, CreditCard, Calendar, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type BillingPeriod = "monthly" | "quarterly" | "yearly";

interface PlanOption {
  price: number;
  credits: number;
  durationDays: number;
}

interface SelectedPurchase {
  planType: string;
  price: number;
  credits: number;
  durationDays: number;
}

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<SelectedPurchase | null>(null);
  
  // Get pre-selected values from URL params (for renewals)
  const preSelectedPlan = searchParams.get("plan") as "pro" | "scholar" | null;
  const preSelectedBilling = searchParams.get("billing") as BillingPeriod | null;
  
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(preSelectedBilling || "monthly");

  useEffect(() => {
    loadPaystackScript();
    getUserEmail();
  }, []);

  const loadPaystackScript = () => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);
  };

  const getUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || "");
    }
  };

  const openConfirmModal = (planType: string, price: number, credits: number, durationDays: number) => {
    if (!userEmail) {
      toast.error("Please log in to purchase credits");
      navigate("/auth");
      return;
    }
    setSelectedPurchase({ planType, price, credits, durationDays });
    setShowConfirmModal(true);
  };

  const confirmPurchase = () => {
    if (!selectedPurchase) return;
    setShowConfirmModal(false);
    handlePurchase(selectedPurchase.planType, selectedPurchase.price, selectedPurchase.credits, selectedPurchase.durationDays);
  };

  const handlePurchase = async (planType: string, price: number, credits: number, durationDays: number) => {
    setIsLoading(true);

    try {
      // @ts-ignore - Paystack is loaded via script
      const handler = window.PaystackPop.setup({
        key: "pk_test_c815d1b343e5d4087eeb23e833437334270ca6b6",
        email: userEmail,
        amount: price * 100, // Amount in kobo
        currency: "NGN",
        metadata: {
          plan_type: planType,
          credits: credits,
          duration_days: durationDays,
          billing_period: billingPeriod,
        },
        callback: function(response: any) {
          // Redirect to checkout success page with reference
          navigate(`/checkout-success?reference=${response.reference}`);
        },
        onClose: function() {
          setIsLoading(false);
          toast.info("Payment cancelled");
        },
      });
      handler.openIframe();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to initiate payment");
      setIsLoading(false);
    }
  };

  // Base monthly prices and credits
  const baseProPlans = [
    { price: 10000, credits: 120 },
    { price: 20000, credits: 240 },
    { price: 40000, credits: 480 },
    { price: 80000, credits: 960 },
  ];

  const baseScholarPlans = [
    { price: 15000, credits: 120 },
    { price: 30000, credits: 240 },
    { price: 60000, credits: 480 },
    { price: 120000, credits: 960 },
  ];

  // Calculate plans based on billing period
  const getPlans = (basePlans: { price: number; credits: number }[]): PlanOption[] => {
    switch (billingPeriod) {
      case "quarterly":
        return basePlans.map(plan => ({
          price: Math.round(plan.price * 3 * 0.9), // 10% discount
          credits: plan.credits * 3,
          durationDays: 90,
        }));
      case "yearly":
        return basePlans.map(plan => ({
          price: Math.round(plan.price * 12 * 0.8), // 20% discount
          credits: plan.credits * 12,
          durationDays: 365,
        }));
      default:
        return basePlans.map(plan => ({
          price: plan.price,
          credits: plan.credits,
          durationDays: 30,
        }));
    }
  };

  const proPlans = getPlans(baseProPlans);
  const scholarPlans = getPlans(baseScholarPlans);

  const scholarFeatures = [
    "PowerPoint presentation generator",
    "Advanced paraphraser tool",
    "Document upload & editing",
  ];

  const getBillingLabel = () => {
    switch (billingPeriod) {
      case "quarterly": return "3 months";
      case "yearly": return "year";
      default: return "month";
    }
  };

  const getMonthlyEquivalent = (price: number) => {
    switch (billingPeriod) {
      case "quarterly": return Math.round(price / 3);
      case "yearly": return Math.round(price / 12);
      default: return price;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Pricing | ScholarAI Hub"
        description="Choose the perfect plan for your academic journey. Get credits for AI-powered project assistance, from free to Scholar plans."
        keywords="academic writing pricing, AI assistant plans, research credits, thesis writing subscription"
      />
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold">ScholarAI Hub</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            {preSelectedPlan ? "Renew Your Plan" : "Choose Your Plan"}
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            {preSelectedPlan 
              ? `Renewing your ${preSelectedPlan.toUpperCase()} plan` 
              : "Select the perfect plan for your academic journey"}
          </p>
          
          {/* Billing Period Toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={billingPeriod === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingPeriod("monthly")}
              className="relative"
            >
              Monthly
            </Button>
            <Button
              variant={billingPeriod === "quarterly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingPeriod("quarterly")}
              className="relative"
            >
              3 Months
              <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs px-1 py-0">
                -10%
              </Badge>
            </Button>
            <Button
              variant={billingPeriod === "yearly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingPeriod("yearly")}
              className="relative"
            >
              Yearly
              <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs px-1 py-0">
                -20%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Free Plan */}
        <Card className="mb-8 max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Free Plan</CardTitle>
                <CardDescription>Perfect for trying out ScholarAI</CardDescription>
              </div>
              <Badge className="rounded-full">Current</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">₦0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-secondary" />
                  <span>8 credits per day</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-secondary" />
                  <span>40 credits per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-secondary" />
                  <span>Basic AI features</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Pro Plans */}
        <div className={`mb-8 ${preSelectedPlan === "pro" ? "ring-2 ring-primary ring-offset-4 rounded-xl p-4" : ""}`}>
          <h2 className="text-3xl font-bold text-center mb-6">
            Pro Plans
            {preSelectedPlan === "pro" && (
              <Badge className="ml-2 rounded-full">Recommended</Badge>
            )}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {proPlans.map((plan, index) => (
              <Card key={index} className="hover:shadow-lg transition-all hover:scale-[1.02]">
                <CardHeader>
                  <CardTitle className="text-2xl">₦{plan.price.toLocaleString()}</CardTitle>
                  <CardDescription>
                    {plan.credits} credits / {getBillingLabel()}
                    {billingPeriod !== "monthly" && (
                      <span className="block text-xs mt-1">
                        ₦{getMonthlyEquivalent(plan.price).toLocaleString()}/mo
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    onClick={() => openConfirmModal("pro", plan.price, plan.credits, plan.durationDays)}
                    disabled={isLoading}
                  >
                    {preSelectedPlan === "pro" ? "Renew" : "Purchase"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Scholar Plans */}
        <div className={`mb-8 ${preSelectedPlan === "scholar" ? "ring-2 ring-primary ring-offset-4 rounded-xl p-4" : ""}`}>
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <h2 className="text-3xl font-bold">
                Scholar Plans
                {preSelectedPlan === "scholar" && (
                  <Badge className="ml-2 rounded-full">Recommended</Badge>
                )}
              </h2>
            </div>
            <p className="text-muted-foreground">Includes all Pro features plus:</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {scholarFeatures.map((feature) => (
                <Badge key={feature} variant="outline" className="rounded-full">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {scholarPlans.map((plan, index) => (
              <Card key={index} variant="glass" className="hover:shadow-xl transition-all hover:scale-[1.02]">
                <CardHeader>
                  <CardTitle className="text-2xl">₦{plan.price.toLocaleString()}</CardTitle>
                  <CardDescription>
                    {plan.credits} credits / {getBillingLabel()}
                    {billingPeriod !== "monthly" && (
                      <span className="block text-xs mt-1">
                        ₦{getMonthlyEquivalent(plan.price).toLocaleString()}/mo
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="gradient"
                    className="w-full" 
                    onClick={() => openConfirmModal("scholar", plan.price, plan.credits, plan.durationDays)}
                    disabled={isLoading}
                  >
                    {preSelectedPlan === "scholar" ? "Renew" : "Purchase"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Features Comparison */}
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" />
                <span>Generate project topics and proposals</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" />
                <span>Write Chapters 1-5 with AI assistance</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" />
                <span>Edit and improve existing chapters</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" />
                <span>Generate academic references</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" />
                <span>24/7 AI assistance</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>

      {/* Purchase Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Confirm Purchase
            </DialogTitle>
            <DialogDescription>
              Review your order before proceeding to payment
            </DialogDescription>
          </DialogHeader>
          
          {selectedPurchase && (
            <div className="space-y-4">
              {/* Plan Type */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plan</span>
                <Badge variant={selectedPurchase.planType === "scholar" ? "default" : "secondary"}>
                  {selectedPurchase.planType.toUpperCase()}
                </Badge>
              </div>
              
              <Separator />
              
              {/* Billing Period */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Billing Period
                </span>
                <span className="font-medium">
                  {billingPeriod === "monthly" ? "Monthly" : 
                   billingPeriod === "quarterly" ? "3 Months" : "Yearly"}
                </span>
              </div>
              
              {/* Duration */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{selectedPurchase.durationDays} days</span>
              </div>
              
              {/* Credits */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Credits
                </span>
                <span className="font-medium">{selectedPurchase.credits.toLocaleString()}</span>
              </div>
              
              <Separator />
              
              {/* Total Cost */}
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary">
                  ₦{selectedPurchase.price.toLocaleString()}
                </span>
              </div>
              
              {/* Monthly equivalent for non-monthly billing */}
              {billingPeriod !== "monthly" && (
                <p className="text-sm text-muted-foreground text-center">
                  (₦{getMonthlyEquivalent(selectedPurchase.price).toLocaleString()}/month equivalent)
                </p>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmPurchase} disabled={isLoading}>
              {isLoading ? "Processing..." : "Proceed to Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pricing;
