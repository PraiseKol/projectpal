import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { TransactionHistorySkeleton } from "@/components/skeletons/TransactionHistorySkeleton";
import { translateError, logError } from "@/utils/errorMessages";

const TransactionHistory = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      logError("TransactionHistory:loadTransactions", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const formatBillingPeriod = (period: string | null) => {
    switch (period) {
      case 'quarterly': return '3 Months';
      case 'yearly': return 'Yearly';
      default: return 'Monthly';
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "Reference", "Amount", "Plan", "Credits", "Billing Period", "Duration", "Status"];
    const rows = transactions.map(t => [
      new Date(t.created_at).toLocaleDateString(),
      t.reference,
      `₦${t.amount.toLocaleString()}`,
      t.plan_type,
      t.credits_purchased,
      formatBillingPeriod(t.billing_period),
      `${t.duration_days || 30} days`,
      t.status
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Transactions exported");
  };

  if (isLoading) {
    return <TransactionHistorySkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Transaction History</CardTitle>
                <CardDescription>View all your credit purchases and payments</CardDescription>
              </div>
              {transactions.length > 0 && (
                <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2 rounded-xl">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No transactions yet</p>
                <Button onClick={() => navigate("/pricing")} className="mt-4 rounded-xl">
                  Purchase Credits
                </Button>
              </div>
            ) : (
              <div className="relative">
                {/* Mobile scroll indicator */}
                <div className="md:hidden text-xs text-muted-foreground text-center pb-2">
                  ← Swipe to see more →
                </div>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {transaction.reference}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₦{transaction.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {transaction.plan_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.credits_purchased} credits</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {formatBillingPeriod(transaction.billing_period)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {transaction.duration_days || 30} days
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.status === "success" ? "default" : "destructive"}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TransactionHistory;
