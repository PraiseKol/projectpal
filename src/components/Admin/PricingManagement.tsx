import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { translateError, logError } from "@/utils/errorMessages";

interface TierConfig {
  price: string;
  originalPrice: string;
  credits: number;
}

const DEFAULT_PRO: TierConfig[] = [
  { price: "5000", originalPrice: "7500", credits: 120 },
  { price: "10000", originalPrice: "15000", credits: 240 },
  { price: "20000", originalPrice: "30000", credits: 480 },
  { price: "40000", originalPrice: "60000", credits: 960 },
];

const DEFAULT_SCHOLAR: TierConfig[] = [
  { price: "7500", originalPrice: "11250", credits: 120 },
  { price: "15000", originalPrice: "22500", credits: 240 },
  { price: "30000", originalPrice: "45000", credits: 480 },
  { price: "60000", originalPrice: "90000", credits: 960 },
];

export const PricingManagement = () => {
  const [proTiers, setProTiers] = useState<TierConfig[]>(DEFAULT_PRO);
  const [scholarTiers, setScholarTiers] = useState<TierConfig[]>(DEFAULT_SCHOLAR);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "pricing_%");

      if (error) throw error;

      if (data && data.length > 0) {
        const map: Record<string, string> = {};
        data.forEach((s) => (map[s.key] = s.value));

        const loadTiers = (prefix: string, defaults: TierConfig[]): TierConfig[] =>
          defaults.map((d, i) => ({
            price: map[`${prefix}_${i + 1}_price`] || d.price,
            originalPrice: map[`${prefix}_${i + 1}_original`] || d.originalPrice,
            credits: d.credits,
          }));

        setProTiers(loadTiers("pricing_pro", DEFAULT_PRO));
        setScholarTiers(loadTiers("pricing_scholar", DEFAULT_SCHOLAR));
      }
    } catch (error) {
      logError("PricingManagement:load", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings: { key: string; value: string }[] = [];

      proTiers.forEach((t, i) => {
        settings.push({ key: `pricing_pro_${i + 1}_price`, value: t.price });
        settings.push({ key: `pricing_pro_${i + 1}_original`, value: t.originalPrice });
      });
      scholarTiers.forEach((t, i) => {
        settings.push({ key: `pricing_scholar_${i + 1}_price`, value: t.price });
        settings.push({ key: `pricing_scholar_${i + 1}_original`, value: t.originalPrice });
      });

      // Use edge function for upserts
      for (const s of settings) {
        const response = await supabase.functions.invoke("admin-operations", {
          body: { action: "updateAppSetting", key: s.key, value: s.value, reason: "Pricing update" },
        });
        if (response.error) throw response.error;
      }

      toast.success("Pricing updated successfully");
    } catch (error) {
      logError("PricingManagement:save", error);
      toast.error(translateError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const updateTier = (
    plan: "pro" | "scholar",
    index: number,
    field: "price" | "originalPrice",
    value: string,
  ) => {
    const setter = plan === "pro" ? setProTiers : setScholarTiers;
    setter((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const calcQuarterly = (price: number) => Math.round(price * 3 * 0.9);
  const calcYearly = (price: number) => Math.round(price * 12 * 0.8);

  const renderTable = (label: string, tiers: TierConfig[], plan: "pro" | "scholar") => (
    <Card className="shadow-md rounded-2xl">
      <CardHeader>
        <CardTitle>{label} Plans</CardTitle>
        <CardDescription>Edit base monthly prices. Quarterly (−10%) and Yearly (−20%) auto-calculate.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credits</TableHead>
                <TableHead>Monthly Price (₦)</TableHead>
                <TableHead>Original Price (₦)</TableHead>
                <TableHead>Quarterly</TableHead>
                <TableHead>Yearly</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier, i) => {
                const price = parseInt(tier.price) || 0;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant="outline">{tier.credits}</Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={tier.price}
                        onChange={(e) => updateTier(plan, i, "price", e.target.value)}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={tier.originalPrice}
                        onChange={(e) => updateTier(plan, i, "originalPrice", e.target.value)}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      ₦{calcQuarterly(price).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      ₦{calcYearly(price).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderTable("Pro", proTiers, "pro")}
      {renderTable("Scholar", scholarTiers, "scholar")}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Pricing
        </Button>
      </div>
    </div>
  );
};
