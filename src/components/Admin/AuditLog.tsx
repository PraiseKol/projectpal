import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { History, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { translateError, logError } from "@/utils/errorMessages";

interface AuditEntry {
  id: string;
  admin_user_id: string;
  action_type: string;
  target_user_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

interface AuditLogProps {
  emailMap: Record<string, string>;
}

export const AuditLog = ({ emailMap }: AuditLogProps) => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-operations", {
        body: { action: "getAuditLog", limit: 100 },
      });

      if (response.error) throw response.error;
      setLogs(response.data?.logs || []);
    } catch (error) {
      logError("AuditLog:loadLogs", error);
      toast.error(translateError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const getUserDisplay = (userId: string | null) => {
    if (!userId) return "—";
    const email = emailMap[userId];
    if (email) return email;
    return userId.slice(0, 8) + "...";
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case "adjust_credits":
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Credits</Badge>;
      case "update_plan":
        return <Badge variant="outline" className="text-purple-600 border-purple-300">Plan</Badge>;
      case "toggle_status":
        return <Badge variant="outline" className="text-orange-600 border-orange-300">Status</Badge>;
      case "assign_role":
        return <Badge variant="outline" className="text-green-600 border-green-300">Role +</Badge>;
      case "remove_role":
        return <Badge variant="outline" className="text-red-600 border-red-300">Role -</Badge>;
      case "update_setting":
        return <Badge variant="outline" className="text-gray-600 border-gray-300">Setting</Badge>;
      default:
        return <Badge variant="secondary">{actionType}</Badge>;
    }
  };

  const formatDetails = (details: Record<string, any> | null) => {
    if (!details) return "No details";
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <Card className="shadow-md rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Admin Audit Log
            </CardTitle>
            <CardDescription>History of all administrative actions</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <Collapsible key={log.id} asChild>
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => toggleRow(log.id)}
                            >
                              {expandedRows.has(log.id) 
                                ? <ChevronUp className="h-4 w-4" />
                                : <ChevronDown className="h-4 w-4" />
                              }
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getUserDisplay(log.admin_user_id)}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action_type)}</TableCell>
                        <TableCell className="text-sm">
                          {getUserDisplay(log.target_user_id)}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="py-3">
                            <div className="text-sm">
                              <span className="font-medium">Details: </span>
                              <code className="bg-muted px-2 py-1 rounded text-xs">
                                {formatDetails(log.details)}
                              </code>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No audit logs yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
