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
import { Users, Coins, Wallet, TrendingUp, CheckCircle2, Clock, XCircle, UserPlus, ShieldAlert, Settings, Upload, Image } from "lucide-react";
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
  phoneNumber: string;
  university: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolderName: string;
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
  payment_screenshot_url: string | null;
}

interface Summary {
  totalAmbassadors: number;
  totalReferrals: number;
  totalCommissions: number;
  pendingPayouts: number;
}

interface AmbassadorRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  phone_number: string;
  university: string;
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
  const [requests, setRequests] = useState<AmbassadorRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState("pending");
  const [isProcessingRequest, setIsProcessingRequest] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string>("open");
  const [isUpdatingClaimStatus, setIsUpdatingClaimStatus] = useState(false);
  const [isCheckingPerformance, setIsCheckingPerformance] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [payoutFilter, requestFilter]);

  useEffect(() => {
    loadClaimStatus();
  }, []);

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
      const [overviewData, payoutsData, requestsData] = await Promise.all([
        callAdminOperation("getAmbassadorOverview"),
        callAdminOperation("getPayoutRequests", { status: payoutFilter }),
        callAdminOperation("getAmbassadorRequests", { status: requestFilter }),
      ]);

      const ambassadorsWithEmails = overviewData?.ambassadors?.map((a: Ambassador) => ({
        ...a,
        email: emailMap[a.id] || ""
      })) || [];

      setAmbassadors(ambassadorsWithEmails);
      setSummary(overviewData?.summary || null);
      setPayouts(payoutsData?.payouts || []);
      setRequests(requestsData?.requests || []);
    } catch (error) {
      logError("AmbassadorManagement:loadData", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const loadClaimStatus = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ambassador_claim_status")
        .maybeSingle();
      if (data?.value) setClaimStatus(data.value);
    } catch (e) {
      // default open
    }
  };

  const handleUpdateClaimStatus = async (newStatus: string) => {
    setIsUpdatingClaimStatus(true);
    try {
      await callAdminOperation("updateAppSetting", {
        key: "ambassador_claim_status",
        value: newStatus,
        reason: `Claim status set to ${newStatus}`
      });
      setClaimStatus(newStatus);
      toast.success(`Claim status updated to "${newStatus}"`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update claim status");
    } finally {
      setIsUpdatingClaimStatus(false);
    }
  };

  const handleCheckPerformance = async () => {
    setIsCheckingPerformance(true);
    try {
      const result = await callAdminOperation("checkAmbassadorPerformance");
      if (result.removedCount > 0) {
        toast.success(`Removed ${result.removedCount} underperforming ambassador(s)`);
        await loadData();
      } else {
        toast.info("All ambassadors meet the performance threshold");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to check performance");
    } finally {
      setIsCheckingPerformance(false);
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const uploadScreenshot = async (payoutId: string): Promise<string | null> => {
    if (!screenshotFile) return null;
    setIsUploadingScreenshot(true);
    try {
      const ext = screenshotFile.name.split('.').pop() || 'png';
      const filePath = `${payoutId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("payment-screenshots")
        .upload(filePath, screenshotFile);
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("payment-screenshots")
        .getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      logError("AmbassadorManagement:uploadScreenshot", error);
      toast.error("Failed to upload screenshot");
      return null;
    } finally {
      setIsUploadingScreenshot(false);
    }
  };

  const handleProcessPayout = async () => {
    if (!selectedPayout) return;

    // Require screenshot when marking as paid
    if (payoutStatus === "paid" && !screenshotFile) {
      toast.error("Please upload a payment screenshot before marking as paid");
      return;
    }

    setIsProcessing(true);
    try {
      let screenshotUrl: string | null = null;
      if (payoutStatus === "paid" && screenshotFile) {
        screenshotUrl = await uploadScreenshot(selectedPayout.id);
        if (!screenshotUrl) {
          setIsProcessing(false);
          return;
        }
      }

      await callAdminOperation("processPayoutRequest", {
        payoutId: selectedPayout.id,
        newStatus: payoutStatus,
        notes: payoutNotes,
        paymentMethod,
        paymentReference,
        paymentScreenshotUrl: screenshotUrl,
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
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const openPayoutDialog = (payout: Payout) => {
    setSelectedPayout(payout);
    setPayoutDialogOpen(true);
    resetPayoutForm();
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

      {/* Admin Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-md rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Commission Claim Status
            </CardTitle>
            <CardDescription className="text-xs">Control whether ambassadors can claim commissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {[
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
                { value: "coming_soon", label: "Coming Soon" },
              ].map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={claimStatus === option.value ? "default" : "outline"}
                  disabled={isUpdatingClaimStatus}
                  onClick={() => handleUpdateClaimStatus(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Performance Check
            </CardTitle>
            <CardDescription className="text-xs">Remove ambassadors with fewer than 10 referrals in their last 30-day window</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="destructive"
              disabled={isCheckingPerformance}
              onClick={handleCheckPerformance}
            >
              {isCheckingPerformance ? "Checking..." : "Run Performance Check"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ambassadors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ambassadors">Ambassadors</TabsTrigger>
          <TabsTrigger value="requests">
            <UserPlus className="h-4 w-4 mr-1" />
            Requests
          </TabsTrigger>
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
                      <TableHead>Phone</TableHead>
                      <TableHead>University</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Referrals</TableHead>
                      <TableHead>Total Earned</TableHead>
                      <TableHead>Bank Details</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRowSkeleton columns={8} rows={5} />
                    ) : ambassadors.length > 0 ? (
                      ambassadors.map((ambassador) => (
                        <TableRow key={ambassador.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{ambassador.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{ambassador.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{ambassador.phoneNumber || "—"}</TableCell>
                          <TableCell className="text-sm">{ambassador.university || "—"}</TableCell>
                          <TableCell className="font-mono">{ambassador.referralCode}</TableCell>
                          <TableCell>{ambassador.totalReferrals}</TableCell>
                          <TableCell className="font-semibold">₦{ambassador.totalEarnings.toLocaleString()}</TableCell>
                          <TableCell>
                            {ambassador.bankName ? (
                              <div className="text-xs">
                                <p className="font-medium">{ambassador.bankName}</p>
                                <p className="text-muted-foreground">{ambassador.bankAccountNumber}</p>
                                <p className="text-muted-foreground">{ambassador.bankAccountHolderName}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not set</span>
                            )}
                          </TableCell>
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
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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

        <TabsContent value="requests">
          <Card className="shadow-md rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ambassador Requests</CardTitle>
                  <CardDescription>Review and approve ambassador role requests</CardDescription>
                </div>
                <Select value={requestFilter} onValueChange={setRequestFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
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
                      <TableHead>User</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>University</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRowSkeleton columns={6} rows={5} />
                    ) : requests.length > 0 ? (
                      requests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.user_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{request.user_email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{request.phone_number || "—"}</TableCell>
                          <TableCell className="text-sm">{request.university || "—"}</TableCell>
                          <TableCell>
                            {request.status === "pending" && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                            {request.status === "approved" && <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>}
                            {request.status === "declined" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>}
                          </TableCell>
                          <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            {request.status === "pending" && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  disabled={isProcessingRequest === request.id}
                                  onClick={async () => {
                                    setIsProcessingRequest(request.id);
                                    try {
                                      await callAdminOperation("approveAmbassadorRequest", { requestId: request.id });
                                      toast.success("Request approved!");
                                      await loadData();
                                    } catch (e: any) {
                                      toast.error(e.message || "Failed to approve");
                                    } finally {
                                      setIsProcessingRequest(null);
                                    }
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={isProcessingRequest === request.id}
                                  onClick={async () => {
                                    setIsProcessingRequest(request.id);
                                    try {
                                      await callAdminOperation("declineAmbassadorRequest", { requestId: request.id });
                                      toast.success("Request declined");
                                      await loadData();
                                    } catch (e: any) {
                                      toast.error(e.message || "Failed to decline");
                                    } finally {
                                      setIsProcessingRequest(null);
                                    }
                                  }}
                                >
                                  Decline
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No requests found
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
                      <TableHead>Proof</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRowSkeleton columns={7} rows={5} />
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
                          <TableCell>
                            {payout.payment_screenshot_url ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-xs"
                                onClick={() => setViewScreenshotUrl(payout.payment_screenshot_url)}
                              >
                                <Image className="h-3 w-3" />
                                View
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
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
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                <div>
                  <Label className="flex items-center gap-1">
                    <Upload className="h-4 w-4" />
                    Payment Screenshot <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="mt-1"
                  />
                  {screenshotPreview && (
                    <img
                      src={screenshotPreview}
                      alt="Payment screenshot preview"
                      className="mt-2 rounded-lg border border-border max-h-48 object-contain"
                    />
                  )}
                  {!screenshotFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a screenshot of the payment as proof
                    </p>
                  )}
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
              <Button
                onClick={handleProcessPayout}
                disabled={isProcessing || isUploadingScreenshot || (payoutStatus === "paid" && !screenshotFile)}
              >
                {isProcessing || isUploadingScreenshot ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Screenshot Dialog */}
      <Dialog open={!!viewScreenshotUrl} onOpenChange={() => setViewScreenshotUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          {viewScreenshotUrl && (
            <img
              src={viewScreenshotUrl}
              alt="Payment proof screenshot"
              className="w-full rounded-lg border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AmbassadorManagement;
