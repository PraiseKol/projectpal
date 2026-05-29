import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  context?: "ppt" | "chapter" | "generic";
  compact?: boolean;
}

export const ShareWithClassmates = ({ context = "generic", compact = false }: Props) => {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (data) setCode(data.code);
    })();
  }, []);

  if (!code) return null;

  const link = `https://projectpal.site/auth?ref=${code}`;
  const contextLine =
    context === "ppt"
      ? "I just generated my project slides with ProjectPal! 🎯"
      : context === "chapter"
        ? "I just finished a project chapter with ProjectPal in minutes! 📝"
        : "I'm using ProjectPal for my final year project! 🎓";
  const message = `${contextLine}\n\nGet 10% off your first 3 purchases with my code: ${code}\n👉 ${link}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Copied! Paste anywhere.");
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <Button size="sm" variant="outline" asChild>
        <a href={waLink} target="_blank" rel="noopener noreferrer">
          <Share2 className="h-4 w-4 mr-2" />
          Share with classmates
        </a>
      </Button>
    );
  }

  return (
    <Card className="p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
      <div className="flex items-start gap-3 mb-3">
        <Share2 className="h-5 w-5 text-green-600 mt-0.5" />
        <div>
          <h4 className="font-semibold">Share with classmates</h4>
          <p className="text-sm text-muted-foreground">They get 10% off their first 3 purchases — you earn bonus credits.</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild className="flex-1 bg-green-600 hover:bg-green-700 text-white">
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <Share2 className="h-4 w-4 mr-2" />
            Share on WhatsApp
          </a>
        </Button>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          Copy
        </Button>
      </div>
    </Card>
  );
};