import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Copy, Users, Coins, Wallet, TrendingUp, CheckCircle2, Clock, ExternalLink, Percent, CalendarDays, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AmbassadorSkeleton } from "@/components/skeletons/AmbassadorSkeleton";

interface ReferralCode {
  id: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

interface Referral {
  id: string;
  referred_user_id: string;
  referred_user_name: string;
  referred_user_plan: string;
  referral_code_used: string;
  created_at: string;
}

interface Commission {
  id: string;
  transaction_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
  referred_user_name?: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  admin_notes: string | null;
}

interface MonthlyEarning {
  month: string;
  earnings: number;
  pending: number;
  paid: number;
}

interface Stats {
  totalReferrals: number;
  subscribedReferrals: number;
  pendingCommission: number;
  claimedCommission: number;
  paidCommission: number;
  totalEarnings: number;
  conversionRate: number;
  averageCommission: number;
  thisMonthEarnings: number;
  totalTransactionValue: number;
  commissionCount: number;
  monthlyEarnings: MonthlyEarning[];
}

const Ambassador = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);

  useEffect(() => {
    checkAmbassadorAccess();
  }, []);

  const callAmbassadorOperation = async (action: string, params: Record<string, any> = {}) => {
    const response = await supabase.functions.invoke("ambassador-operations", {
      body: { action, ...params },
    });
    if (response.error) throw response.error;
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  };

  const checkAmbassadorAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "ambassador")
        .maybeSingle();

      if (roleError || !roleData) {
        toast.error("Access denied. Ambassador privileges required.");
        navigate("/dashboard");
        return;
      }

      setIsAmbassador(true);
      await loadAmbassadorData();
    } catch (error) {
      console.error("Error checking ambassador access:", error);
      toast.error("Failed to verify ambassador access");
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAmbassadorData = async () => {
    try {
      const [codeData, referralsData, commissionsData, payoutsData, statsData] = await Promise.all([
        callAmbassadorOperation("getMyReferralCode"),
        callAmbassadorOperation("getMyReferrals"),
        callAmbassadorOperation("getMyCommissions"),
        callAmbassadorOperation("getMyPayouts"),
        callAmbassadorOperation("getAmbassadorStats"),
      ]);

      setReferralCode(codeData?.referralCode || null);
      setReferrals(referralsData?.referrals || []);
      setCommissions(commissionsData?.commissions || []);
      setPayouts(payoutsData?.payouts || []);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading ambassador data:", error);
      toast.error("Failed to load ambassador data");
    }
  };

  const copyReferralLink = () => {
    if (!referralCode) return;
    const link = `${window.location.origin}/auth?ref=${referralCode.code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied to clipboard!");
  };

  const handleRequestPayout = async () => {
    setIsRequestingPayout(true);
    try {
      await callAmbassadorOperation("requestPayout");
      toast.success("Payout request submitted successfully!");
      setShowPayoutDialog(false);
      await loadAmbassadorData();
    } catch (error: any) {
      toast.error(error.message || "Failed to request payout");
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "claimed":
        return <Badge className="bg-primary"><Wallet className="h-3 w-3 mr-1" />Claimed</Badge>;
      case "paid":
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case "approved":
        return <Badge className="bg-blue-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "pro":
        return <Badge className="bg-primary">Pro</Badge>;
      case "scholar":
        return <Badge className="bg-secondary">Scholar</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  if (isLoading) {
    return <AmbassadorSkeleton />;
  }

  if (!isAmbassador) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Ambassador Portal</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Referral Code Section */}
        <Card className="shadow-md rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Referral Code
            </CardTitle>
            <CardDescription>
              Share this link with new users to earn 5% commission on their subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referralCode ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-background rounded-lg px-6 py-3 font-mono text-2xl font-bold tracking-wider border">
                  {referralCode.code}
                </div>
                <Button onClick={copyReferralLink} variant="outline" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Referral Link
                </Button>
                <Button
                  onClick={() => window.open(`${window.location.origin}/auth?ref=${referralCode.code}`, "_blank")}
                  variant="ghost"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">Loading referral code...</p>
            )}
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Referrals</p>
                  <p className="text-3xl font-bold">{stats?.totalReferrals || 0}</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Subscribed</p>
                  <p className="text-3xl font-bold">{stats?.subscribedReferrals || 0}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  <p className="text-3xl font-bold">{(stats?.conversionRate || 0).toFixed(1)}%</p>
                </div>
                <Percent className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-3xl font-bold">₦{(stats?.thisMonthEarnings || 0).toLocaleString()}</p>
                </div>
                <CalendarDays className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold">₦{(stats?.pendingCommission || 0).toLocaleString()}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-3xl font-bold">₦{(stats?.totalEarnings || 0).toLocaleString()}</p>
                </div>
                <Coins className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Earnings Chart & Performance Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="shadow-md rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Earnings
              </CardTitle>
              <CardDescription>Your commission earnings over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.monthlyEarnings && stats.monthlyEarnings.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.monthlyEarnings}>
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `₦${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Earnings']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="earnings" radius={[4, 4, 0, 0]}>
                      {stats.monthlyEarnings.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.earnings > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No earnings data yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Lifetime Performance
              </CardTitle>
              <CardDescription>Your overall ambassador impact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Users Referred</span>
                <span className="font-bold">{stats?.totalReferrals || 0}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Subscriptions Generated</span>
                <span className="font-bold">{stats?.subscribedReferrals || 0}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Total Transactions</span>
                <span className="font-bold">{stats?.commissionCount || 0}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Transaction Value</span>
                <span className="font-bold">₦{(stats?.totalTransactionValue || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Avg. Commission</span>
                <span className="font-bold">₦{(stats?.averageCommission || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 pt-4 bg-primary/10 -mx-6 px-6 rounded-lg">
                <span className="font-semibold">Your Earnings (5%)</span>
                <span className="font-bold text-lg text-primary">₦{(stats?.totalEarnings || 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claim Commission Section */}
        {(stats?.pendingCommission || 0) > 0 && (
          <Card className="shadow-md rounded-2xl border-primary/50">
            <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Ready to claim your commission?</p>
                <p className="text-muted-foreground">
                  You have ₦{(stats?.pendingCommission || 0).toLocaleString()} in pending commissions
                </p>
              </div>
              <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="gradient" className="gap-2">
                    <Wallet className="h-5 w-5" />
                    Claim Commission
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Payout</DialogTitle>
                    <DialogDescription>
                      Submit a request to receive your pending commission of ₦{(stats?.pendingCommission || 0).toLocaleString()}.
                      An admin will process your request and you'll be notified once it's approved.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowPayoutDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleRequestPayout} disabled={isRequestingPayout}>
                      {isRequestingPayout ? "Submitting..." : "Submit Request"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Earnings Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-500">₦{(stats?.pendingCommission || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">Claimed (Processing)</p>
              <p className="text-2xl font-bold text-blue-500">₦{(stats?.claimedCommission || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-md rounded-2xl">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">Paid Out</p>
              <p className="text-2xl font-bold text-green-500">₦{(stats?.paidCommission || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Referrals Table */}
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
            <CardDescription>Users who signed up using your referral code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.length > 0 ? (
                    referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">{referral.referred_user_name}</TableCell>
                        <TableCell>{getPlanBadge(referral.referred_user_plan)}</TableCell>
                        <TableCell>{new Date(referral.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No referrals yet. Share your code to get started!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Commissions Table */}
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle>Commission History</CardTitle>
            <CardDescription>Track your earnings from referral subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Referred User</TableHead>
                    <TableHead>Transaction Amount</TableHead>
                    <TableHead>Commission (5%)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.length > 0 ? (
                    commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>{new Date(commission.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground">{commission.referred_user_name || "User"}</TableCell>
                        <TableCell>₦{commission.transaction_amount.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">₦{commission.commission_amount.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(commission.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No commissions yet. Commissions are earned when your referrals subscribe.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Payout History */}
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>Track your payout requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.length > 0 ? (
                    payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>{new Date(payout.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-semibold">₦{payout.amount.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell>
                          {payout.processed_at ? new Date(payout.processed_at).toLocaleDateString() : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No payout requests yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Ambassador;
