import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

const DepartmentTopics = () => {
  const { department } = useParams();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<any[]>([]);
  const [deptName, setDeptName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    if (!department) return;
    setLoading(true);
    setError(false);
    supabase
      .from("project_topics")
      .select("*")
      .eq("department", department)
      .then(({ data, error: err }) => {
        if (err) {
          setError(true);
        } else {
          setTopics(data || []);
          if (data && data[0]) setDeptName(data[0].department_name);
        }
        setLoading(false);
      });
  };

  useEffect(load, [department]);

  const title = deptName ? `${topics.length} ${deptName} Project Topics for Nigerian Students` : "Project Topics";
  const desc = `Browse ${topics.length} approved final year project topics for ${deptName} students in Nigeria. Updated for ${new Date().getFullYear()}.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${title} | ProjectPal`} description={desc} canonical={`/topics/${department}`} />
      <header className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2"><ProjectPalLogo size="sm" /></Link>
        <Button variant="ghost" asChild>
          <Link to="/topics"><ArrowLeft className="h-4 w-4 mr-2" />All departments</Link>
        </Button>
      </header>
      <section className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground mb-10">
          Pick a topic below, then use ProjectPal to generate your full proposal, chapters, and references.
        </p>
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">We couldn't load these topics right now.</p>
            <Button onClick={load}>Try again</Button>
          </div>
        ) : topics.length === 0 ? (
          <p className="text-muted-foreground">No topics yet for this department.</p>
        ) : (
          <div className="space-y-3">
            {topics.map((t, i) => (
              <Card key={t.id} className="p-4 flex items-start gap-3 rounded-xl">
                <span className="text-sm font-bold text-primary min-w-[2rem]">{i + 1}.</span>
                <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                <p className="text-base flex-1">{t.topic}</p>
              </Card>
            ))}
          </div>
        )}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 text-center">
          <h3 className="text-2xl font-bold mb-2">Like a topic? Write it with ProjectPal</h3>
          <p className="text-muted-foreground mb-4">Generate chapters, references, and slides in minutes.</p>
          <Button variant="gradient" size="lg" onClick={() => navigate("/auth?mode=signup")}>Start Free</Button>
        </div>
      </section>
    </div>
  );
};

export default DepartmentTopics;
