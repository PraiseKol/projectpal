import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Search, Edit, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateError, logError } from "@/utils/errorMessages";

interface Message {
  id: string;
  session_id: string;
  sender: "user" | "ai";
  content: string;
  created_at: string;
  chat_sessions: {
    user_id: string;
    title: string;
  };
}

interface MessagesManagementProps {
  emailMap: Record<string, string>;
}

export const MessagesManagement = ({ emailMap }: MessagesManagementProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [editMessage, setEditMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const perPage = 50;

  useEffect(() => {
    loadMessages();
  }, [page, search]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "getAllMessages", page, perPage, search },
      });
      if (error) throw error;
      setMessages(data?.messages || []);
      setTotal(data?.total || 0);
    } catch (error) {
      logError("MessagesManagement:load", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleEdit = async () => {
    if (!editMessage) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "updateMessage", messageId: editMessage.id, content: editContent },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Message updated");
        setEditMessage(null);
        loadMessages();
      }
    } catch (error) {
      logError("MessagesManagement:edit", error);
      toast.error(translateError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMessageId) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "deleteMessage", messageId: deleteMessageId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Message deleted");
        setDeleteMessageId(null);
        loadMessages();
      }
    } catch (error) {
      logError("MessagesManagement:delete", error);
      toast.error(translateError(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages Management
          </CardTitle>
          <CardDescription>View, edit and delete chat messages across all users ({total} total)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search message content..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Sender</TableHead>
                      <TableHead className="max-w-[300px]">Content</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No messages found
                        </TableCell>
                      </TableRow>
                    ) : (
                      messages.map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {new Date(msg.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {emailMap[msg.chat_sessions?.user_id] || msg.chat_sessions?.user_id?.slice(0, 8) + "..."}
                          </TableCell>
                          <TableCell className="text-sm max-w-[120px] truncate">
                            {msg.chat_sessions?.title || msg.session_id.slice(0, 8) + "..."}
                          </TableCell>
                          <TableCell>
                            <Badge variant={msg.sender === "user" ? "default" : "secondary"}>
                              {msg.sender}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm">
                            {msg.content.slice(0, 100)}{msg.content.length > 100 ? "..." : ""}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditMessage(msg);
                                  setEditContent(msg.content);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteMessageId(msg.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editMessage} onOpenChange={(open) => !open && setEditMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
            <DialogDescription>Modify the message content</DialogDescription>
          </DialogHeader>
          <Textarea rows={10} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMessage(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={(open) => !open && setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
