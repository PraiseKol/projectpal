import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, GraduationCap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";

const Pricing = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  const handlePurchase = async (planType: string, price: number, credits: number) => {
    if (!userEmail) {
      toast.error("Please log in to purchase credits");
      navigate("/auth");
      return;
    }

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

  const proPlans = [
    { price: 10000, credits: 120 },
    { price: 20000, credits: 240 },
    { price: 40000, credits: 480 },
    { price: 80000, credits: 960 },
  ];

  const scholarPlans = [
    { price: 15000, credits: 120 },
    { price: 30000, credits: 240 },
    { price: 60000, credits: 480 },
    { price: 120000, credits: 960 },
  ];

  const scholarFeatures = [
    "PowerPoint presentation generator",
    "Advanced paraphraser tool",
    "Document upload & editing",
  ];

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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground">Select the perfect plan for your academic journey</p>
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-center mb-6">Pro Plans</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {proPlans.map((plan) => (
              <Card key={plan.price} className="hover:shadow-lg transition-all hover:scale-[1.02]">
                <CardHeader>
                  <CardTitle className="text-2xl">₦{plan.price.toLocaleString()}</CardTitle>
                  <CardDescription>{plan.credits} credits</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    onClick={() => handlePurchase("pro", plan.price, plan.credits)}
                    disabled={isLoading}
                  >
                    Purchase
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Scholar Plans */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <h2 className="text-3xl font-bold">Scholar Plans</h2>
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
            {scholarPlans.map((plan) => (
              <Card key={plan.price} variant="glass" className="hover:shadow-xl transition-all hover:scale-[1.02]">
                <CardHeader>
                  <CardTitle className="text-2xl">₦{plan.price.toLocaleString()}</CardTitle>
                  <CardDescription>{plan.credits} credits</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="gradient"
                    className="w-full" 
                    onClick={() => handlePurchase("scholar", plan.price, plan.credits)}
                    disabled={isLoading}
                  >
                    Purchase
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
    </div>
  );
};

export default Pricing;
