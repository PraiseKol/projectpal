import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Coins, Wallet, TrendingUp, CheckCircle2, Clock, XCircle } from "lucide-react";
import { TableRowSkeleton } from "@/components/skeletons/TableRowSkeleton";
import { translateError, logError } from "@/utils/errorMessages";

interface Ambassador {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  isActive: boolean;
  totalReferrals: number;
  pendingCommission: number;
  claimedCommission: number;
  paidCommission: number;
  totalEarnings: number;
}

interface Payout {
  id: string;
  ambassador_user_id: string;
  ambassador_name: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  admin_notes: string | null;
  payment_method: string | null;
  payment_reference: string | null;
}

interface Summary {
  totalAmbassadors: number;
  totalReferrals: number;
  totalCommissions: number;
  pendingPayouts: number;
}

interface AmbassadorManagementProps {
  emailMap: Record<string, string>;
}

export const AmbassadorManagement = ({ emailMap }: AmbassadorManagementProps) => {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<string>("approved");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState("pending");

  useEffect(() => {
    loadData();
  }, [payoutFilter]);

  const callAdminOperation = async (action: string, params: Record<string, any> = {}) => {
    const response = await supabase.functions.invoke("admin-operations", {
      body: { action, ...params },
    });
    if (response.error) throw response.error;
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  };

  const loadData = async () => {
    try {
      const [overviewData, payoutsData] = await Promise.all([
        callAdminOperation("getAmbassadorOverview"),
        callAdminOperation("getPayoutRequests", { status: payoutFilter }),
      ]);

      // Add emails to ambassadors
      const ambassadorsWithEmails = overviewData?.ambassadors?.map((a: Ambassador) => ({
        ...a,
        email: emailMap[a.id] || ""
      })) || [];

      setAmbassadors(ambassadorsWithEmails);
      setSummary(overviewData?.summary || null);
      setPayouts(payoutsData?.payouts || []);
    } catch (error) {
      logError("AmbassadorManagement:loadData", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessPayout = async () => {
    if (!selectedPayout) return;

    setIsProcessing(true);
    try {
      await callAdminOperation("processPayoutRequest", {
        payoutId: selectedPayout.id,
        newStatus: payoutStatus,
        notes: payoutNotes,
        paymentMethod,
        paymentReference
      });

      toast.success(`Payout ${payoutStatus === "paid" ? "marked as paid" : payoutStatus}`);
      setPayoutDialogOpen(false);
      setSelectedPayout(null);
      resetPayoutForm();
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to process payout");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPayoutForm = () => {
    setPayoutStatus("approved");
    setPayoutNotes("");
    setPaymentMethod("");
    setPaymentReference("");
  };

  const openPayoutDialog = (payout: Payout) => {
    setSelectedPayout(payout);
    setPayoutDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-blue-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "paid":
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-md rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Ambassadors</p>
                <p className="text-3xl font-bold">{summary?.totalAmbassadors || 0}</p>
              </div>
              <Users className="h-10 w-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-3xl font-bold">{summary?.totalReferrals || 0}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Commissions</p>
                <p className="text-3xl font-bold">₦{(summary?.totalCommissions || 0).toLocaleString()}</p>
              </div>
              <Coins className="h-10 w-10 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-3xl font-bold">₦{(summary?.pendingPayouts || 0).toLocaleString()}</p>
              </div>
              <Wallet className="h-10 w-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ambassadors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ambassadors">Ambassadors</TabsTrigger>
          <TabsTrigger value="payouts">Payout Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="ambassadors">
          <Card className="shadow-md rounded-2xl">
            <CardHeader>
              <CardTitle>All Ambassadors</CardTitle>
              <CardDescription>Manage ambassador accounts and view their performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Referrals</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Total Earned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRowSkeleton columns={7} rows={5} />
                    ) : ambassadors.length > 0 ? (
                      ambassadors.map((ambassador) => (
                        <TableRow key={ambassador.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{ambassador.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{ambassador.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{ambassador.referralCode}</TableCell>
                          <TableCell>{ambassador.totalReferrals}</TableCell>
                          <TableCell>₦{ambassador.pendingCommission.toLocaleString()}</TableCell>
                          <TableCell>₦{ambassador.paidCommission.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">₦{ambassador.totalEarnings.toLocaleString()}</TableCell>
                          <TableCell>
                            {ambassador.isActive ? (
                              <Badge className="bg-green-600">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No ambassadors yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card className="shadow-md rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payout Requests</CardTitle>
                  <CardDescription>Review and process ambassador payout requests</CardDescription>
                </div>
                <Select value={payoutFilter} onValueChange={setPayoutFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ambassador</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRowSkeleton columns={6} rows={5} />
                    ) : payouts.length > 0 ? (
                      payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell className="font-medium">{payout.ambassador_name}</TableCell>
                          <TableCell className="font-semibold">₦{payout.amount.toLocaleString()}</TableCell>
                          <TableCell>{getStatusBadge(payout.status)}</TableCell>
                          <TableCell>{new Date(payout.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {payout.processed_at ? new Date(payout.processed_at).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {payout.status === "pending" && (
                              <Button size="sm" onClick={() => openPayoutDialog(payout)}>
                                Process
                              </Button>
                            )}
                            {payout.status === "approved" && (
                              <Button size="sm" variant="outline" onClick={() => openPayoutDialog(payout)}>
                                Mark Paid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No payout requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Payout Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payout Request</DialogTitle>
            <DialogDescription>
              {selectedPayout && (
                <>
                  Review and process the payout request of ₦{selectedPayout.amount.toLocaleString()} 
                  from {selectedPayout.ambassador_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Status</Label>
              <Select value={payoutStatus} onValueChange={setPayoutStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedPayout?.status === "pending" && (
                    <>
                      <SelectItem value="approved">Approve</SelectItem>
                      <SelectItem value="paid">Mark as Paid</SelectItem>
                      <SelectItem value="rejected">Reject</SelectItem>
                    </>
                  )}
                  {selectedPayout?.status === "approved" && (
                    <SelectItem value="paid">Mark as Paid</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {payoutStatus === "paid" && (
              <>
                <div>
                  <Label>Payment Method</Label>
                  <Input
                    placeholder="e.g., Bank Transfer, PayPal"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Payment Reference</Label>
                  <Input
                    placeholder="Transaction reference or ID"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about this payout..."
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleProcessPayout} disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
