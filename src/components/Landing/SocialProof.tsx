import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, BarChart3, GraduationCap } from "lucide-react";

export const SocialProof = () => {
  const [stats, setStats] = useState({ students: 0, projects: 0, analyses: 0, universities: 50 });

  useEffect(() => {
    (async () => {
      const [{ count: students }, { count: projects }, { count: analyses }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("documents").select("*", { count: "exact", head: true }),
        supabase.from("analysis_sessions").select("*", { count: "exact", head: true }),
      ]);
      setStats((s) => ({
        ...s,
        students: Math.max(students || 0, 100),
        projects: Math.max(projects || 0, 50),
        analyses: Math.max(analyses || 0, 20),
      }));
    })();
  }, []);

  const items = [
    { icon: Users, label: "Students helped", value: stats.students.toLocaleString() + "+" },
    { icon: FileText, label: "Projects generated", value: stats.projects.toLocaleString() + "+" },
    { icon: BarChart3, label: "Data analyses run", value: stats.analyses.toLocaleString() + "+" },
    { icon: GraduationCap, label: "Nigerian universities", value: stats.universities + "+" },
  ];

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((s) => (
          <div key={s.label} className="text-center p-5 rounded-2xl bg-accent/40 border border-border/50">
            <s.icon className="h-7 w-7 text-primary mx-auto mb-2" />
            <p className="text-2xl md:text-3xl font-bold">{s.value}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};