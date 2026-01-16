import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, CreditCard, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const Admin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    freeUsers: 0,
    proUsers: 0,
    scholarUsers: 0,
    totalRevenue: 0,
    totalTransactions: 0
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

      // Check if user is admin
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      await loadAdminData();
    } catch (error) {
      console.error("Error checking admin access:", error);
      toast.error("Failed to verify admin access");
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      // Load all users with their profiles
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load all transactions
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
        totalTransactions: transactionsData?.length || 0
      });
    } catch (error) {
      console.error("Error loading admin data:", error);
      toast.error("Failed to load admin data");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-64 w-64" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
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
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                Total payment records
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="shadow-md rounded-2xl">
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Manage user accounts and plans</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Daily Credits</TableHead>
                        <TableHead>Paid Credits</TableHead>
                        <TableHead>Credits Expiry</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-mono text-xs">
                            {user.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge>{user.plan_type.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>{user.daily_credits}</TableCell>
                          <TableCell>{user.paid_credits || 0}</TableCell>
                          <TableCell>
                            {user.credits_expiry_date 
                              ? new Date(user.credits_expiry_date).toLocaleDateString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                        <TableHead>User ID</TableHead>
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
                          <TableCell>
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {transaction.user_id.slice(0, 8)}...
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
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
