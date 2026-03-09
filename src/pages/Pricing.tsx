import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowLeft, Sparkles, CreditCard, Calendar, Coins, Info, GraduationCap, Tag } from "lucide-react";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { translateError, logError } from "@/utils/errorMessages";

type BillingPeriod = "monthly" | "quarterly" | "yearly";

interface PlanOption {
  price: number;
  credits: number;
  durationDays: number;
  originalPrice: number;
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
  const [paystackKey, setPaystackKey] = useState<string | undefined>(
    import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined,
  );
  const [hasReferralDiscount, setHasReferralDiscount] = useState(false);
  const [freeDaily, setFreeDaily] = useState("8");
  const [freeMonthly, setFreeMonthly] = useState("40");

  // Get pre-selected values from URL params (for renewals)
  const preSelectedPlan = searchParams.get("plan") as "pro" | "scholar" | null;
  const preSelectedBilling = searchParams.get("billing") as BillingPeriod | null;

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(preSelectedBilling || "monthly");

  useEffect(() => {
    loadPaystackScript();
    getUserEmail();
    loadPaystackKey();
    checkReferralDiscount();
    loadCreditSettings();
  }, []);

  const loadPaystackKey = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "PAYSTACK_PUBLIC_KEY")
        .maybeSingle();
      if (!error && data?.value) {
        setPaystackKey(data.value);
      }
    } catch (e) {
      // Fall back to env variable (already set as default)
    }
  };

  const loadPaystackScript = () => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);
  };

  const getUserEmail = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || "");
    }
  };

  const checkReferralDiscount = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("referred_by").eq("id", user.id).single();

      if (!profile?.referred_by) return;

      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "success");

      setHasReferralDiscount((count ?? 0) === 0);
    } catch (error) {
      logError("Pricing:checkReferralDiscount", error);
    }
  };

  const loadCreditSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["default_daily_credits", "default_monthly_credits"]);
      if (!error && data) {
        data.forEach((s) => {
          if (s.key === "default_daily_credits") setFreeDaily(s.value);
          if (s.key === "default_monthly_credits") setFreeMonthly(s.value);
        });
      }
    } catch (e) {
      // fallback to defaults
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
    const finalPrice = hasReferralDiscount ? Math.round(selectedPurchase.price * 0.95) : selectedPurchase.price;
    handlePurchase(selectedPurchase.planType, finalPrice, selectedPurchase.credits, selectedPurchase.durationDays);
  };

  const handlePurchase = async (planType: string, price: number, credits: number, durationDays: number) => {
    if (!paystackKey) {
      toast.error("Payment system not configured");
      return;
    }

    setIsLoading(true);

    try {
      // @ts-ignore - Paystack is loaded via script
      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: userEmail,
        amount: price * 100, // Amount in kobo
        currency: "NGN",
        metadata: {
          plan_type: planType,
          credits: credits,
          duration_days: durationDays,
          billing_period: billingPeriod,
          ...(hasReferralDiscount && { referral_discount: true, original_amount: selectedPurchase?.price }),
        },
        callback: function (response: any) {
          navigate(`/checkout-success?reference=${response.reference}`);
        },
        onClose: function () {
          setIsLoading(false);
          toast.info("Payment cancelled");
        },
      });
      handler.openIframe();
    } catch (error) {
      logError("Pricing:initializePayment", error);
      toast.error(translateError(error));
      setIsLoading(false);
    }
  };

  // Base monthly prices and credits
  const baseProPlans = [
    { price: 5000, credits: 120, originalPrice: 7500 },
    { price: 10000, credits: 240, originalPrice: 15000 },
    { price: 20000, credits: 480, originalPrice: 30000 },
    { price: 40000, credits: 960, originalPrice: 60000 },
  ];

  const baseScholarPlans = [
    { price: 7500, credits: 120, originalPrice: 11250 },
    { price: 15000, credits: 240, originalPrice: 22500 },
    { price: 30000, credits: 480, originalPrice: 45000 },
    { price: 60000, credits: 960, originalPrice: 90000 },
  ];

  // Calculate plans based on billing period
  const getPlans = (basePlans: { price: number; credits: number; originalPrice: number }[]): PlanOption[] => {
    switch (billingPeriod) {
      case "quarterly":
        return basePlans.map((plan) => ({
          price: Math.round(plan.price * 3 * 0.9),
          originalPrice: Math.round(plan.originalPrice * 3 * 0.9),
          credits: plan.credits * 3,
          durationDays: 90,
        }));
      case "yearly":
        return basePlans.map((plan) => ({
          price: Math.round(plan.price * 12 * 0.8),
          originalPrice: Math.round(plan.originalPrice * 12 * 0.8),
          credits: plan.credits * 12,
          durationDays: 365,
        }));
      default:
        return basePlans.map((plan) => ({
          price: plan.price,
          originalPrice: plan.originalPrice,
          credits: plan.credits,
          durationDays: 30,
        }));
    }
  };

  const proPlans = getPlans(baseProPlans);
  const scholarPlans = getPlans(baseScholarPlans);

  const scholarFeatures = ["PowerPoint presentation generator", "Data Analysis"];

  const getBillingLabel = () => {
    switch (billingPeriod) {
      case "quarterly":
        return "3 months";
      case "yearly":
        return "year";
      default:
        return "month";
    }
  };

  const getMonthlyEquivalent = (price: number) => {
    switch (billingPeriod) {
      case "quarterly":
        return Math.round(price / 3);
      case "yearly":
        return Math.round(price / 12);
      default:
        return price;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing | ProjectPal"
        description="Choose the perfect plan for your academic journey. Get credits for AI-powered project assistance, from free to Scholar plans."
        keywords="academic writing pricing, AI assistant plans, research credits, thesis writing subscription"
      />
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ProjectPalLogo size="sm" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            {preSelectedPlan ? "Renew Your Plan" : "Choose Your Plan"}
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            {preSelectedPlan
              ? `Renewing your ${preSelectedPlan.toUpperCase()} plan`
              : "Select the perfect plan for your academic journey"}
          </p>

          {/* Limited Time Discount Banner */}
          <div className="inline-flex items-center gap-2 px-5 py-3 mb-4 bg-gradient-to-r from-primary/15 to-secondary/15 border border-primary/20 rounded-xl text-sm font-semibold animate-pulse">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>🎉 Limited Time Offer — Current prices are discounted! Prices will be restored in 1-2 months.</span>
          </div>

          {/* Referral Discount Banner */}
          {hasReferralDiscount && (
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium">
              <Tag className="h-4 w-4 text-primary" />
              <span>5% referral discount applied to your first purchase!</span>
            </div>
          )}

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
                <CardDescription>Perfect for trying out ProjectPal</CardDescription>
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
                  <span>{freeDaily} credits per day</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-secondary" />
                  <span>{freeMonthly} credits per month</span>
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
            {preSelectedPlan === "pro" && <Badge className="ml-2 rounded-full">Recommended</Badge>}
          </h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {proPlans.map((plan, index) => (
              <Card key={index} className="hover:shadow-lg transition-all hover:scale-[1.02]">
                <CardHeader>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground line-through">₦{plan.originalPrice.toLocaleString()}</span>
                    <CardTitle className="text-2xl text-primary">₦{plan.price.toLocaleString()}</CardTitle>
                  </div>
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
        <div
          className={`mb-8 ${preSelectedPlan === "scholar" ? "ring-2 ring-primary ring-offset-4 rounded-xl p-4" : ""}`}
        >
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <h2 className="text-3xl font-bold">
                Scholar Plans
                {preSelectedPlan === "scholar" && <Badge className="ml-2 rounded-full">Recommended</Badge>}
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
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {scholarPlans.map((plan, index) => (
              <Card key={index} variant="glass" className="hover:shadow-xl transition-all hover:scale-[1.02]">
                <CardHeader>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground line-through">₦{plan.originalPrice.toLocaleString()}</span>
                    <CardTitle className="text-2xl text-primary">₦{plan.price.toLocaleString()}</CardTitle>
                  </div>
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

        {/* Comprehensive Plan Comparison Table */}
        <Card className="max-w-5xl mx-auto mb-8">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl">Plan Comparison</CardTitle>
                <CardDescription>Compare all features and perks across plans</CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Info className="h-4 w-4" />
                      Credit Info
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Daily Credits:</strong> Reset at midnight each day (subscribers only)
                      </p>
                      <p>
                        <strong>Monthly Cap:</strong> Maximum credits per month for free users
                      </p>
                      <p>
                        <strong>Paid Credits:</strong> Pool of credits from subscription, valid until expiry
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-6">
              {[
                {
                  name: "Free",
                  badge: "Basic",
                  dailyCredits: `${freeDaily} credits/day`,
                  monthlyCap: `${freeMonthly} total`,
                  paidCredits: "None",
                  creditsReset: "Monthly",
                  features: {
                    chat: true,
                    topics: true,
                    proposal: true,
                    chapters: true,
                    references: true,
                    documents: false,
                    ppt: false,
                    paraphraser: false,
                    support: "Basic",
                  },
                },
                {
                  name: "Pro",
                  badge: "Popular",
                  dailyCredits: `${freeDaily} credits/day`,
                  monthlyCap: "No cap",
                  paidCredits: "Based on plan",
                  creditsReset: "Daily",
                  features: {
                    chat: true,
                    topics: true,
                    proposal: true,
                    chapters: true,
                    references: true,
                    documents: false,
                    ppt: false,
                    paraphraser: false,
                    support: "Priority",
                  },
                },
                {
                  name: "Scholar",
                  badge: "Best Value",
                  dailyCredits: `${freeDaily} credits/day`,
                  monthlyCap: "No cap",
                  paidCredits: "Based on plan",
                  creditsReset: "Daily",
                  features: {
                    chat: true,
                    topics: true,
                    proposal: true,
                    chapters: true,
                    references: true,
                    documents: true,
                    ppt: true,
                    paraphraser: true,
                    support: "Priority",
                  },
                },
              ].map((plan) => (
                <Card
                  key={plan.name}
                  variant={plan.name === "Scholar" ? "glass" : "default"}
                  className="overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <Badge variant={plan.name === "Scholar" ? "default" : "secondary"} className="rounded-full">
                        {plan.badge}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Credits Info */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground text-xs">Daily Credits</p>
                        <p className="font-semibold">{plan.dailyCredits}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground text-xs">Monthly Cap</p>
                        <p className="font-semibold">{plan.monthlyCap}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground text-xs">Paid Credits</p>
                        <p className="font-semibold">{plan.paidCredits}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground text-xs">Credits Reset</p>
                        <p className="font-semibold">{plan.creditsReset}</p>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Features</p>
                      <div className="grid gap-2">
                        {[
                          { label: "AI Chat Assistance", value: plan.features.chat },
                          { label: "Project Topics", value: plan.features.topics },
                          { label: "Proposal Writing", value: plan.features.proposal },
                          { label: "Chapter Writing", value: plan.features.chapters },
                          { label: "Academic References", value: plan.features.references },
                          { label: "Document Upload", value: plan.features.documents },
                          { label: "PowerPoint Generator", value: plan.features.ppt },
                          { label: "Advanced Paraphraser", value: plan.features.paraphraser },
                          { label: "Data Analysis", value: plan.name === "Free" ? "1/month" : true },
                        ].map((feature) => (
                          <div key={feature.label} className="flex items-center justify-between text-sm">
                            <span>{feature.label}</span>
                            {typeof feature.value === "string" ? (
                              <Badge variant="outline" className="text-xs">
                                {feature.value}
                              </Badge>
                            ) : feature.value ? (
                              <Check className="h-4 w-4 text-secondary" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-sm">
                          <span>Support</span>
                          <Badge variant="outline" className="text-xs">
                            {plan.features.support}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Feature</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span>Free</span>
                        <Badge variant="outline" className="text-xs">
                          Basic
                        </Badge>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span>Pro</span>
                        <Badge variant="secondary" className="text-xs">
                          Popular
                        </Badge>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span>Scholar</span>
                        <Badge className="text-xs">Best Value</Badge>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Credits Section */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Credits & Limits
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Daily Credits</TableCell>
                    <TableCell className="text-center">{freeDaily} credits/day</TableCell>
                    <TableCell className="text-center">{freeDaily} credits/day</TableCell>
                    <TableCell className="text-center">{freeDaily} credits/day</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        Monthly Credit Cap
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Free users are limited to {freeMonthly} credits per month total</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{freeMonthly} total</TableCell>
                    <TableCell className="text-center font-medium text-secondary">No cap</TableCell>
                    <TableCell className="text-center font-medium text-secondary">No cap</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Paid Credits Pool</TableCell>
                    <TableCell className="text-center text-muted-foreground">None</TableCell>
                    <TableCell className="text-center">Based on plan</TableCell>
                    <TableCell className="text-center">Based on plan</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        Credits Reset
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Subscribers get fresh daily credits until subscription expires</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">Monthly ({freeMonthly} cap)</TableCell>
                    <TableCell className="text-center font-medium text-secondary">Daily (until expiry)</TableCell>
                    <TableCell className="text-center font-medium text-secondary">Daily (until expiry)</TableCell>
                  </TableRow>

                  {/* AI Features Section */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Features
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>AI Chat Assistance</TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Project Topics Generation</TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Proposal Writing</TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Chapter Writing (1-5)</TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Academic References</TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>

                  {/* Scholar-Only Features */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Scholar-Exclusive Features
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Document Upload & Editing</TableCell>
                    <TableCell className="text-center">
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>PowerPoint Generator</TableCell>
                    <TableCell className="text-center">
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Advanced Paraphraser</TableCell>
                    <TableCell className="text-center">
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        Data Analysis Tool
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Upload survey data and run statistical analyses for Chapter 4</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">1/month (Basic)</TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Check className="h-4 w-4 text-secondary mx-auto" />
                    </TableCell>
                  </TableRow>

                  {/* Support */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      Support
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Support Level</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">Basic</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">Priority</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge>Priority</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Info Notes */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                How Credits Work
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • <strong>Free users:</strong> Get {freeDaily} credits per day, up to {freeMonthly} credits per month
                  total. Credits reset monthly.
                </li>
                <li>
                  • <strong>Active subscribers:</strong> Get {freeDaily} fresh credits every day (no monthly cap) + your
                  paid credits pool until subscription expires.
                </li>
                <li>
                  • <strong>Expired subscriptions:</strong> Revert to free user limits ({freeDaily} daily, {freeMonthly}{" "}
                  monthly cap).
                </li>
              </ul>
            </div>
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
            <DialogDescription>Review your order before proceeding to payment</DialogDescription>
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
                  {billingPeriod === "monthly" ? "Monthly" : billingPeriod === "quarterly" ? "3 Months" : "Yearly"}
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
              {hasReferralDiscount ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm flex items-center gap-2">
                      <Tag className="h-3 w-3" />
                      Original Price
                    </span>
                    <span className="text-muted-foreground line-through">
                      ₦{selectedPurchase.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Total (5% off)</span>
                    <span className="font-bold text-primary">
                      ₦{Math.round(selectedPurchase.price * 0.95).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary">₦{selectedPurchase.price.toLocaleString()}</span>
                </div>
              )}

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
