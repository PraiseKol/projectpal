import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Sparkles, CheckCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SEO } from "@/components/SEO";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { SocialProof } from "@/components/Landing/SocialProof";
import { UniversityLogos } from "@/components/Landing/UniversityLogos";

const Index = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setIsAuthenticated(true);
      navigate("/dashboard");
    }
  };

  const features = [
    "Generate project topics instantly",
    "Write comprehensive proposals",
    "Create chapters 1-5 with AI assistance",
    "Get accurate academic references",
    "Edit, improve, and paraphrase your work",
    "Fully wrap your project with preliminary pages and references",
    "Analyze research data with built-in statistical tools",
    "Build custom questionnaires for your research",
    "Generate PowerPoint presentations from your documents",
    "AI-powered document editor with grammar, clarity, and tone tools",
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="ProjectPal - AI Powered Academic Project Assistant"
        description="Complete your academic projects faster with ProjectPal. Generate topics, write proposals, create chapters, and get AI-powered assistance for your research."
        keywords="academic writing, AI assistant, research projects, thesis writing, proposal generator, chapter writing, academic references"
      />
      {/* Header */}
      <header className="container mx-auto px-4 py-4 flex justify-end">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/blog")}>Blog</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/topics")}>Topics</Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-8 animate-scale-in">
          <ProjectPalLogo size="lg" showText={false} />
        </div>
        <h1 className="text-3xl xs:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-fade-in">ProjectPal</h1>
        <p className="text-base sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in">
          Your AI powered academic project assistant. Complete your research projects faster with intelligent writing
          assistance.
        </p>
        <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 justify-center animate-fade-in">
          <Button size="lg" variant="gradient" onClick={() => navigate("/auth?mode=signup")}>
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}>
            View Pricing
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-6 animate-fade-in">
          Free accounts start with daily credits — no card required. <Button variant="link" className="px-1 underline h-auto p-0 text-sm" onClick={() => navigate("/auth")}>Sign in</Button> if you already have an account.
        </p>
      </section>

      <UniversityLogos />
      <SocialProof />


      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="p-8 hover:shadow-lg transition-all hover:scale-[1.02] animate-scale-in">
            <BookOpen className="h-12 w-12 mb-4 text-primary" />
            <h3 className="text-2xl font-bold mb-3">Academic Writing</h3>
            <p className="text-muted-foreground">
              Generate proposals, write chapters, and create comprehensive academic content with AI assistance.
            </p>
          </Card>
          <Card className="p-8 hover:shadow-lg transition-all hover:scale-[1.02] animate-scale-in">
            <Sparkles className="h-12 w-12 mb-4 text-secondary" />
            <h3 className="text-2xl font-bold mb-3">Smart Assistance</h3>
            <p className="text-muted-foreground">
              Get intelligent suggestions, edit your work, and generate proper academic references automatically.
            </p>
          </Card>
        </div>

        {/* Features List */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">What You Can Do</h2>
          <div className="space-y-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-3 p-4 bg-accent/50 rounded-2xl border border-border/50 hover:bg-accent/70 transition-colors"
              >
                <CheckCircle className="h-6 w-6 flex-shrink-0 mt-0.5 text-secondary" />
                <span className="text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="p-6 sm:p-8 md:p-12 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20 hover:shadow-xl transition-shadow">
          <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join ProjectPal today and transform your academic writing experience.
          </p>
          <Button size="lg" variant="gradient" onClick={() => navigate("/auth?mode=signup")}>
            Create Free Account
          </Button>
        </Card>
      </section>
    </div>
  );
};

export default Index;
