import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, TrendingUp, FileText, MessageSquare, BarChart3, Sparkles, UserPlus, DollarSign, TrendingDown } from "lucide-react";

interface StatsOverviewProps {
  stats: {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    scholarUsers: number;
    totalRevenue: number;
    totalTransactions: number;
    totalCommission: number;
  };
  activityStats: {
    documentCount: number;
    chatCount: number;
    messageCount: number;
    analysisCount: number;
    paraphraseCount: number;
    recentSignups: number;
    activeUsers24h: number;
  } | null;
}

export const StatsOverview = ({ stats, activityStats }: StatsOverviewProps) => {
  const conversionRate = stats.totalUsers > 0 
    ? (((stats.proUsers + stats.scholarUsers) / stats.totalUsers) * 100).toFixed(1)
    : "0";

  const arpu = (stats.proUsers + stats.scholarUsers) > 0
    ? Math.round(stats.totalRevenue / (stats.proUsers + stats.scholarUsers))
    : 0;

  const netRevenue = stats.totalRevenue - stats.totalCommission;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Row 1: Core metrics */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalUsers}</div>
          <p className="text-xs text-muted-foreground">
            Free: {stats.freeUsers} | Pro: {stats.proUsers} | Scholar: {stats.scholarUsers}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₦{stats.totalRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            From {stats.totalTransactions} transactions
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{conversionRate}%</div>
          <p className="text-xs text-muted-foreground">
            Paid users / total users
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">ARPU</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₦{arpu.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Avg revenue per paying user
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₦{stats.totalCommission.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Ambassador commissions
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₦{netRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Revenue minus commissions
          </p>
        </CardContent>
      </Card>

      {/* Row 2: Activity metrics */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">New Signups (7d)</CardTitle>
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activityStats?.recentSignups || 0}</div>
          <p className="text-xs text-muted-foreground">
            Last 7 days
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Users (24h)</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activityStats?.activeUsers24h || 0}</div>
          <p className="text-xs text-muted-foreground">
            With activity in last 24h
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Documents</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activityStats?.documentCount || 0}</div>
          <p className="text-xs text-muted-foreground">
            Total documents generated
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activityStats?.chatCount || 0}</div>
          <p className="text-xs text-muted-foreground">
            {activityStats?.messageCount || 0} total messages
          </p>
        </CardContent>
      </Card>

      {/* Row 3: Feature usage */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Data Analyses</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activityStats?.analysisCount || 0}</div>
          <p className="text-xs text-muted-foreground">
            Statistical analyses run
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Paraphrases</CardTitle>
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activityStats?.paraphraseCount || 0}</div>
          <p className="text-xs text-muted-foreground">
            Text paraphrases made
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
