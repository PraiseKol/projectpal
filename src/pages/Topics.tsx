import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { ArrowLeft, BookOpen, AlertCircle } from "lucide-react";

const Topics = () => {
  const [depts, setDepts] = useState<{ department: string; department_name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    // Server-side aggregate counts — no more 1000-row client-side tally
    supabase
      .rpc("get_topic_department_counts")
      .then(({ data, error: err }) => {
        if (err) {
          setError(true);
          setLoading(false);
          return;
        }
        setDepts(
          (data || []).map((r: any) => ({
            department: r.department,
            department_name: r.department_name,
            count: Number(r.topic_count),
          }))
        );
        setLoading(false);
      });
  };

  useEffect(load, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Final Year Project Topics for Nigerian Students | ProjectPal"
        description="Browse hundreds of approved final year project topics across Computer Science, Mass Comm, Accounting, Nursing, Education and more. Free for Nigerian undergraduates."
        keywords="final year project topics, project topics Nigeria, undergraduate project ideas"
        canonical="/topics"
      />
      <header className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2"><ProjectPalLogo size="sm" /></Link>
        <Button variant="ghost" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Home</Link>
        </Button>
      </header>
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Project Topics by Department</h1>
        <p className="text-lg text-muted-foreground mb-10">
          Hundreds of vetted final year project topics for Nigerian undergraduates.
        </p>
        {loading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">We couldn't load the topics right now.</p>
            <Button onClick={load}>Try again</Button>
          </div>
        ) : depts.length === 0 ? (
          <p className="text-muted-foreground">No topics yet. Check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {depts.map((d) => (
              <Link key={d.department} to={`/topics/${d.department}`}>
                <Card className="p-6 hover:shadow-lg transition-all hover:scale-[1.02] rounded-2xl">
                  <BookOpen className="h-8 w-8 text-primary mb-3" />
                  <h2 className="font-bold text-lg mb-1">{d.department_name}</h2>
                  <p className="text-sm text-muted-foreground">{d.count} topics</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Topics;
