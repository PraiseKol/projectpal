import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LayoutDashboard, Users, CreditCard, Activity, Shield, Settings, History, UserCheck, Mail, Coins, MessageSquare, Tag } from "lucide-react";
import { toast } from "sonner";
import { StatsOverview } from "@/components/Admin/StatsOverview";
import { AdminCharts } from "@/components/Admin/AdminCharts";
import { UserManagement } from "@/components/Admin/UserManagement";
import { ActivityMonitor } from "@/components/Admin/ActivityMonitor";
import { RoleManagement } from "@/components/Admin/RoleManagement";
import { AppSettings } from "@/components/Admin/AppSettings";
import { AuditLog } from "@/components/Admin/AuditLog";
import { AmbassadorManagement } from "@/components/Admin/AmbassadorManagement";
import { MessagesManagement } from "@/components/Admin/MessagesManagement";
import { EmailCampaigns } from "@/components/Admin/EmailCampaigns";
import { CreditCostsSettings } from "@/components/Admin/CreditCostsSettings";
import { PricingManagement } from "@/components/Admin/PricingManagement";
import { AdminSkeleton } from "@/components/skeletons/AdminSkeleton";
import { translateError, logError } from "@/utils/errorMessages";

const Admin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [activityStats, setActivityStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any>(null);
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    freeUsers: 0,
    proUsers: 0,
    scholarUsers: 0,
    totalRevenue: 0,
    totalTransactions: 0,
    totalCommission: 0
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
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
        .in("role", ["admin", "super_admin"]);

      if (roleError || !roleData || roleData.length === 0) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      const roles = roleData.map(r => r.role);
      setIsSuperAdmin(roles.includes("super_admin"));
      setIsAdmin(true);
      await loadAdminData();
    } catch (error) {
      logError("Admin:checkAdminAccess", error);
      toast.error(translateError(error));
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const callAdminOperation = async (action: string, params: Record<string, any> = {}) => {
    const response = await supabase.functions.invoke("admin-operations", {
      body: { action, ...params },
    });
    if (response.error) throw response.error;
    return response.data;
  };

  const loadAdminData = async () => {
    try {
      // Load profiles via edge function (bypasses RLS)
      const profilesResult = await callAdminOperation("getAllProfiles");
      const usersData = profilesResult?.profiles || [];
      setUsers(usersData);

      // Load transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);

      // Calculate stats
      const freeUsers = usersData?.filter(u => u.plan_type === "free").length || 0;
      const proUsers = usersData?.filter(u => u.plan_type === "pro").length || 0;
      const scholarUsers = usersData?.filter(u => u.plan_type === "scholar").length || 0;
      const totalRevenue = transactionsData?.reduce((sum, t) => sum + t.amount, 0) || 0;

      setStats({
        totalUsers: usersData?.length || 0,
        freeUsers,
        proUsers,
        scholarUsers,
        totalRevenue,
        totalTransactions: transactionsData?.length || 0,
        totalCommission: 0
      });

      // Load additional data via edge function
      try {
        const [emailData, activityData, recentData, growthData, revData, ambassadorData] = await Promise.all([
          callAdminOperation("getUserEmails"),
          callAdminOperation("getActivityStats"),
          callAdminOperation("getRecentActivity"),
          callAdminOperation("getUserGrowthData"),
          callAdminOperation("getRevenueData"),
          callAdminOperation("getAmbassadorOverview"),
        ]);

        setEmailMap(emailData?.emailMap || {});
        setActivityStats(activityData);
        setRecentActivity(recentData);
        setUserGrowthData(growthData?.growthData || []);
        setRevenueData(revData?.revenueData || []);
        
        // Update stats with commission data
        const totalCommission = ambassadorData?.summary?.totalCommissions || 0;
        setStats(prev => ({ ...prev, totalCommission }));
      } catch (fnError) {
        logError("Admin:loadAdminFunctionsData", fnError);
      }
    } catch (error) {
      logError("Admin:loadAdminData", error);
      toast.error(translateError(error));
    }
  };

  if (isLoading) {
    return <AdminSkeleton />;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-nowrap overflow-x-auto w-full justify-start">
            <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="users"><Users className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Users</span></TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="transactions"><CreditCard className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Transactions</span></TabsTrigger>}
            <TabsTrigger value="activity"><Activity className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Activity</span></TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="roles"><Shield className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Roles</span></TabsTrigger>}
            <TabsTrigger value="ambassadors"><UserCheck className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Ambassadors</span></TabsTrigger>
            <TabsTrigger value="emails"><Mail className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Emails</span></TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Settings</span></TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="credits"><Coins className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Credit Costs</span></TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="pricing"><Tag className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Pricing</span></TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Messages</span></TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="audit"><History className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Audit</span></TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <StatsOverview stats={stats} activityStats={activityStats} />
            <AdminCharts 
              stats={stats} 
              userGrowthData={userGrowthData} 
              revenueData={revenueData}
              activityStats={activityStats}
            />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="users">
              <UserManagement users={users} emailMap={emailMap} onRefresh={loadAdminData} />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="transactions">
              <Card className="shadow-md rounded-2xl">
                <CardHeader>
                  <CardTitle>All Transactions</CardTitle>
                  <CardDescription>View all system-wide payments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{new Date(transaction.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm">{emailMap[transaction.user_id] || transaction.user_id.slice(0, 8) + "..."}</TableCell>
                            <TableCell className="font-mono text-xs">{transaction.reference}</TableCell>
                            <TableCell className="font-semibold">₦{transaction.amount.toLocaleString()}</TableCell>
                            <TableCell><Badge variant="outline">{transaction.plan_type.toUpperCase()}</Badge></TableCell>
                            <TableCell>{transaction.credits_purchased}</TableCell>
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
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="activity">
            <ActivityMonitor recentActivity={recentActivity} emailMap={emailMap} />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="roles">
              <RoleManagement emailMap={emailMap} users={users} />
            </TabsContent>
          )}

          <TabsContent value="ambassadors">
            <AmbassadorManagement emailMap={emailMap} />
          </TabsContent>

          <TabsContent value="emails">
            <EmailCampaigns />
          </TabsContent>

          <TabsContent value="settings">
            <AppSettings />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="credits">
              <CreditCostsSettings />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="pricing">
              <PricingManagement />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="messages">
              <MessagesManagement emailMap={emailMap} />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="audit">
              <AuditLog emailMap={emailMap} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
