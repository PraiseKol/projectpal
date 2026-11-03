import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, BarChart3, GraduationCap } from "lucide-react";

export const SocialProof = () => {
  const [stats, setStats] = useState<{
    students: number;
    projects: number;
    analyses: number;
    loaded: boolean;
  }>({ students: 0, projects: 0, analyses: 0, loaded: false });

  useEffect(() => {
    (async () => {
      const [{ count: students }, { count: projects }, { count: analyses }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("documents").select("*", { count: "exact", head: true }),
        supabase.from("analysis_sessions").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        students: students || 0,
        projects: projects || 0,
        analyses: analyses || 0,
        loaded: true,
      });
    })();
  }, []);

  // Show only real, non-zero numbers — no inflated floors or hard-coded claims.
  const items = [
    stats.students > 0 && { icon: Users, label: "Students signed up", value: stats.students.toLocaleString() },
    stats.projects > 0 && { icon: FileText, label: "Documents created", value: stats.projects.toLocaleString() },
    stats.analyses > 0 && { icon: BarChart3, label: "Data analyses run", value: stats.analyses.toLocaleString() },
  ].filter(Boolean) as { icon: typeof Users; label: string; value: string }[];

  if (!stats.loaded || items.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((s) => (
          <div key={s.label} className="text-center p-5 rounded-2xl bg-accent/40 border border-border/50">
            <s.icon className="h-7 w-7 text-primary mx-auto mb-2" />
            <p className="text-2xl md:text-3xl font-bold">{s.value}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
        <div className="text-center p-5 rounded-2xl bg-accent/40 border border-border/50">
          <GraduationCap className="h-7 w-7 text-primary mx-auto mb-2" />
          <p className="text-2xl md:text-3xl font-bold">APA 7</p>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Verified citations, every time</p>
        </div>
      </div>
    </section>
  );
};
