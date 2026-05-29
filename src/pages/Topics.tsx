import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { ArrowLeft, BookOpen } from "lucide-react";

const Topics = () => {
  const [depts, setDepts] = useState<{ department: string; department_name: string; count: number }[]>([]);

  useEffect(() => {
    supabase
      .from("project_topics")
      .select("department,department_name")
      .limit(1000)
      .then(({ data }) => {
        const map = new Map<string, { department_name: string; count: number }>();
        (data || []).forEach((r: any) => {
          const cur = map.get(r.department);
          if (cur) cur.count += 1;
          else map.set(r.department, { department_name: r.department_name, count: 1 });
        });
        setDepts(
          Array.from(map.entries()).map(([department, v]) => ({
            department,
            department_name: v.department_name,
            count: v.count,
          }))
        );
      });
  }, []);

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
      </section>
    </div>
  );
};

export default Topics;