import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreditOperation {
  key: string;
  label: string;
  defaultCost: number;
  category: string;
}

const CREDIT_OPERATIONS: CreditOperation[] = [
  { key: "credit_cost_simple_chat", label: "Simple Chat", defaultCost: 1, category: "Basic" },
  { key: "credit_cost_article_search", label: "Article Search", defaultCost: 1, category: "Basic" },
  { key: "credit_cost_grammar_fix", label: "Fix Grammar / Improve Clarity", defaultCost: 2, category: "Editing" },
  { key: "credit_cost_suggestions", label: "Suggestions (Academic Tone, Topics, Outlines)", defaultCost: 2, category: "Editing" },
  { key: "credit_cost_paraphraser", label: "Paraphraser", defaultCost: 2, category: "Editing" },
  { key: "credit_cost_analysis", label: "Summarize / Extract Key Points", defaultCost: 4, category: "Analysis" },
  { key: "credit_cost_chapter_1", label: "Chapter 1 (Introduction)", defaultCost: 5, category: "Writing" },
  { key: "credit_cost_chapter_5", label: "Chapter 5 (Conclusion)", defaultCost: 5, category: "Writing" },
  { key: "credit_cost_questionnaire_chat", label: "Questionnaire Chat", defaultCost: 2, category: "Questionnaire" },
  { key: "credit_cost_questionnaire_build", label: "Questionnaire Build", defaultCost: 5, category: "Questionnaire" },
  { key: "credit_cost_questionnaire_export", label: "Questionnaire Export", defaultCost: 5, category: "Questionnaire" },
  { key: "credit_cost_chapter_2", label: "Chapter 2 (Literature Review)", defaultCost: 10, category: "Writing" },
  { key: "credit_cost_ppt_base", label: "PowerPoint Generator", defaultCost: 10, category: "Tools" },
  { key: "credit_cost_ppt_images", label: "PowerPoint + Images", defaultCost: 15, category: "Tools" },
  { key: "credit_cost_humanizer", label: "AI Humanizer", defaultCost: 5, category: "Tools" },
  { key: "credit_cost_chapter_5_alt", label: "Chapter 5 (Advanced)", defaultCost: 15, category: "Writing" },
  { key: "credit_cost_research_proposal", label: "Research Proposal", defaultCost: 20, category: "Writing" },
  { key: "credit_cost_journal_paper", label: "Journal Paper", defaultCost: 20, category: "Writing" },
  { key: "credit_cost_chapter_3", label: "Chapter 3 (Methodology)", defaultCost: 25, category: "Writing" },
  { key: "credit_cost_data_analysis", label: "Data Analysis", defaultCost: 30, category: "Analysis" },
  { key: "credit_cost_chapter_4", label: "Chapter 4 (Results)", defaultCost: 50, category: "Writing" },
  { key: "credit_cost_full_wrap", label: "Fully Wrap Project", defaultCost: 50, category: "Writing" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Basic: "default",
  Editing: "secondary",
  Analysis: "outline",
  Writing: "default",
  Questionnaire: "secondary",
  Tools: "outline",
};

export const CreditCostsSettings = () => {
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [editedCosts, setEditedCosts] = useState<Record<string, number>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCosts();
  }, []);

  const loadCosts = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "credit_cost_%");

      if (error) throw error;

      const map: Record<string, number> = {};
      data?.forEach((s) => {
        map[s.key] = parseInt(s.value, 10);
      });
      setCosts(map);
      setEditedCosts({});
    } catch (error) {
      console.error("Failed to load credit costs:", error);
      toast.error("Failed to load credit costs");
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentValue = (op: CreditOperation) => {
    if (editedCosts[op.key] !== undefined) return editedCosts[op.key];
    if (costs[op.key] !== undefined) return costs[op.key];
    return op.defaultCost;
  };

  const handleChange = (key: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setEditedCosts((prev) => ({ ...prev, [key]: num }));
    }
  };

  const isModified = (key: string) => {
    if (editedCosts[key] === undefined) return false;
    const saved = costs[key];
    return saved !== undefined ? editedCosts[key] !== saved : true;
  };

  const handleSave = async (op: CreditOperation) => {
    const value = getCurrentValue(op);
    setSavingKey(op.key);

    try {
      // Upsert: check if exists first
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", op.key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: value.toString(), updated_at: new Date().toISOString() })
          .eq("key", op.key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key: op.key, value: value.toString() });
        if (error) throw error;
      }

      setCosts((prev) => ({ ...prev, [op.key]: value }));
      setEditedCosts((prev) => {
        const next = { ...prev };
        delete next[op.key];
        return next;
      });
      toast.success(`Updated ${op.label} to ${value} credits`);
    } catch (error) {
      console.error("Failed to save credit cost:", error);
      toast.error("Failed to save credit cost");
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-md rounded-2xl">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md rounded-2xl">
      <CardHeader>
        <CardTitle>Credit Costs</CardTitle>
        <CardDescription>
          Manage the credit cost for each AI operation. Changes here are enforced dynamically across all features — edge functions read these values at runtime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-[100px]">Default</TableHead>
                <TableHead className="w-[140px]">Current Cost</TableHead>
                <TableHead className="w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CREDIT_OPERATIONS.map((op) => (
                <TableRow key={op.key}>
                  <TableCell className="font-medium">{op.label}</TableCell>
                  <TableCell>
                    <Badge variant={CATEGORY_COLORS[op.category] as any || "default"}>
                      {op.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{op.defaultCost}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={getCurrentValue(op)}
                      onChange={(e) => handleChange(op.key, e.target.value)}
                      className="w-24 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isModified(op.key) ? "default" : "ghost"}
                      disabled={!isModified(op.key) || savingKey === op.key}
                      onClick={() => handleSave(op)}
                      className="h-8"
                    >
                      {savingKey === op.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
