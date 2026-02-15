import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Shield, Ban, User } from "lucide-react";

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  plan_type: string;
  daily_credits: number;
  paid_credits: number;
  credits_expiry_date: string | null;
  created_at: string;
  status?: string;
}

interface UserDetailModalProps {
  user: User;
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export const UserDetailModal = ({ user, email, open, onOpenChange, onRefresh }: UserDetailModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [creditType, setCreditType] = useState<"daily" | "monthly" | "paid">("paid");
  const [creditReason, setCreditReason] = useState("");
  const [newPlan, setNewPlan] = useState(user.plan_type);
  const [planReason, setPlanReason] = useState("");
  const defaultExpiry = new Date();
  defaultExpiry.setDate(defaultExpiry.getDate() + 30);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry.toISOString().split("T")[0]);

  const callAdminOperation = async (action: string, params: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await supabase.functions.invoke("admin-operations", {
      body: { action, ...params },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  const handleAdjustCredits = async () => {
    if (creditAmount === 0) {
      toast.error("Please enter a credit amount");
      return;
    }

    setIsLoading(true);
    try {
      await callAdminOperation("adjustCredits", {
        targetUserId: user.id,
        creditAmount,
        creditType,
        reason: creditReason || "Admin adjustment"
      });
      
      toast.success(`Credits ${creditAmount > 0 ? "added" : "removed"} successfully`);
      setCreditAmount(0);
      setCreditReason("");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to adjust credits");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (newPlan === user.plan_type) {
      toast.error("Please select a different plan");
      return;
    }

    setIsLoading(true);
    try {
      await callAdminOperation("updatePlan", {
        targetUserId: user.id,
        newPlan,
        expiryDate: newPlan !== "free" ? expiryDate : null,
        reason: planReason || "Admin update"
      });
      
      toast.success(`Plan updated to ${newPlan}`);
      setPlanReason("");
      onRefresh();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update plan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    
    setIsLoading(true);
    try {
      await callAdminOperation("toggleUserStatus", {
        targetUserId: user.id,
        newStatus,
        reason: `Admin ${newStatus === "suspended" ? "suspended" : "activated"} account`
      });
      
      toast.success(`User ${newStatus === "suspended" ? "suspended" : "activated"} successfully`);
      onRefresh();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to toggle status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </DialogTitle>
          <DialogDescription>
            Manage user account and permissions
          </DialogDescription>
        </DialogHeader>

        {/* User Info Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">
              {user.first_name || user.last_name 
                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{email || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Plan</p>
            <Badge className="mt-1">{user.plan_type.toUpperCase()}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge 
              variant={user.status === "suspended" ? "destructive" : "outline"}
              className={user.status !== "suspended" ? "text-green-600 border-green-600" : ""}
            >
              {user.status || "Active"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Daily Credits</p>
            <p className="font-medium">{user.daily_credits}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Paid Credits</p>
            <p className="font-medium">{user.paid_credits || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Credits Expiry</p>
            <p className="font-medium">
              {user.credits_expiry_date 
                ? new Date(user.credits_expiry_date).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Joined</p>
            <p className="font-medium">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="credits">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="credits">
              <CreditCard className="h-4 w-4 mr-2" />
              Credits
            </TabsTrigger>
            <TabsTrigger value="plan">
              <Shield className="h-4 w-4 mr-2" />
              Plan
            </TabsTrigger>
            <TabsTrigger value="status">
              <Ban className="h-4 w-4 mr-2" />
              Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credits" className="space-y-4 pt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Credit Type</Label>
                  <Select value={creditType} onValueChange={(v: "daily" | "monthly" | "paid") => setCreditType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily Credits</SelectItem>
                      <SelectItem value="monthly">Monthly Credits</SelectItem>
                      <SelectItem value="paid">Paid Credits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount (+ to add, - to remove)</Label>
                  <Input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                    placeholder="e.g., 50 or -10"
                  />
                </div>
              </div>
              <div>
                <Label>Reason (optional)</Label>
                <Input
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="Reason for adjustment"
                />
              </div>
              <Button onClick={handleAdjustCredits} disabled={isLoading}>
                {isLoading ? "Processing..." : "Adjust Credits"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="plan" className="space-y-4 pt-4">
            <div className="grid gap-4">
              <div>
                <Label>New Plan</Label>
                <Select value={newPlan} onValueChange={setNewPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="scholar">Scholar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newPlan !== "free" && (
                <div>
                  <Label>Expiry Date (default: 30 days)</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label>Reason (optional)</Label>
                <Input
                  value={planReason}
                  onChange={(e) => setPlanReason(e.target.value)}
                  placeholder="Reason for plan change"
                />
              </div>
              <Button onClick={handleUpdatePlan} disabled={isLoading || newPlan === user.plan_type}>
                {isLoading ? "Processing..." : "Update Plan"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4 pt-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">
                {user.status === "suspended" ? "Activate Account" : "Suspend Account"}
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                {user.status === "suspended" 
                  ? "This will restore the user's access to the platform."
                  : "This will prevent the user from accessing the platform."}
              </p>
              <Button 
                onClick={handleToggleStatus} 
                disabled={isLoading}
                variant={user.status === "suspended" ? "default" : "destructive"}
              >
                {isLoading 
                  ? "Processing..." 
                  : user.status === "suspended" 
                    ? "Activate Account" 
                    : "Suspend Account"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
