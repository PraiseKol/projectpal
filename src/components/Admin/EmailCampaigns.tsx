import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Plus, Send, Eye, Trash2, Loader2, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateError, logError } from "@/utils/errorMessages";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  email_type: string;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  recipients_count: number;
  created_at: string;
}

interface EmailLog {
  id: string;
  campaign_id: string;
  email: string;
  status: string;
  sent_at: string;
  error_message: string | null;
}

export const EmailCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const [newCampaign, setNewCampaign] = useState({
    name: "",
    subject: "",
    content: "",
    email_type: "marketing",
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("email_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);

      const { data: logsData, error: logsError } = await supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setEmailLogs(logsData || []);
    } catch (error) {
      logError("EmailCampaigns:loadCampaigns", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.content) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("email_campaigns")
        .insert({
          name: newCampaign.name,
          subject: newCampaign.subject,
          content: newCampaign.content,
          email_type: newCampaign.email_type,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success("Campaign created");
      setShowCreateDialog(false);
      setNewCampaign({ name: "", subject: "", content: "", email_type: "marketing" });
      loadCampaigns();
    } catch (error: any) {
      logError("EmailCampaigns:createCampaign", error);
      toast.error(translateError(error));
    } finally {
      setIsCreating(false);
    }
  };

  const sendCampaign = async (campaign: Campaign) => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: {
          type: campaign.email_type,
          campaignId: campaign.id,
        },
      });

      if (error) throw error;

      toast.success(`Campaign sent! ${data.sent} emails delivered, ${data.failed} failed`);
      loadCampaigns();
    } catch (error: any) {
      logError("EmailCampaigns:sendCampaign", error);
      toast.error(translateError(error));
    } finally {
      setIsSending(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail || !selectedCampaign) {
      toast.error("Please enter a test email address");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("send-newsletter", {
        body: {
          type: selectedCampaign.email_type,
          testEmail: testEmail,
        },
      });

      if (error) throw error;

      toast.success(`Test email sent to ${testEmail}`);
      setTestEmail("");
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(error.message || "Failed to send test email");
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const { error } = await supabase
        .from("email_campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Campaign deleted");
      loadCampaigns();
    } catch (error: any) {
      console.error("Error deleting campaign:", error);
      toast.error(error.message || "Failed to delete campaign");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Sent</Badge>;
      case "scheduled":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Scheduled</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "marketing": return "Marketing";
      case "activity": return "Activity Reminder";
      case "usage": return "Usage Report";
      case "reengagement": return "Re-engagement";
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Campaigns
            </CardTitle>
            <CardDescription>Create and manage email campaigns for your users</CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>Create a new email campaign to send to your users</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Campaign Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., January Newsletter"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Email Type</Label>
                    <Select
                      value={newCampaign.email_type}
                      onValueChange={(value) => setNewCampaign({ ...newCampaign, email_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marketing">Marketing & Promotional</SelectItem>
                        <SelectItem value="activity">Activity Reminder</SelectItem>
                        <SelectItem value="usage">Usage Report</SelectItem>
                        <SelectItem value="reengagement">Re-engagement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    placeholder="e.g., 🎉 New Features in ProjectPal!"
                    value={newCampaign.subject}
                    onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Email Content (HTML)</Label>
                  <Textarea
                    id="content"
                    placeholder="<h2>Hello!</h2><p>Your email content here...</p>"
                    rows={10}
                    value={newCampaign.content}
                    onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={createCampaign} disabled={isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Campaign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No campaigns yet. Create your first campaign!
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-sm text-muted-foreground">{campaign.subject}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(campaign.email_type)}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {campaign.recipients_count}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setShowPreviewDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {campaign.status === "draft" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => sendCampaign(campaign)}
                            disabled={isSending}
                          >
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        )}
                        {campaign.status === "draft" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteCampaign(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Preview</DialogTitle>
            <DialogDescription>{selectedCampaign?.name}</DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Subject:</p>
                <p className="font-medium">{selectedCampaign.subject}</p>
              </div>
              <div className="border rounded-lg p-4">
                <div dangerouslySetInnerHTML={{ __html: selectedCampaign.content }} />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter test email address"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button onClick={sendTestEmail}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Email Logs</CardTitle>
          <CardDescription>Track email delivery status</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No email logs yet
                  </TableCell>
                </TableRow>
              ) : (
                emailLogs.slice(0, 20).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.email}</TableCell>
                    <TableCell>
                      {log.status === "sent" || log.status === "delivered" ? (
                        <Badge variant="default">{log.status}</Badge>
                      ) : (
                        <Badge variant="destructive">{log.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(log.sent_at).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
