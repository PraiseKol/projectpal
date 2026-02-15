import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, BarChart3, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityMonitorProps {
  recentActivity: {
    recentDocuments: Array<{
      id: string;
      user_id: string;
      file_name: string;
      document_type: string;
      created_at: string;
    }>;
    recentChats: Array<{
      id: string;
      user_id: string;
      title: string;
      created_at: string;
    }>;
    recentAnalyses: Array<{
      id: string;
      user_id: string;
      file_name: string;
      analyses_run: any;
      created_at: string;
    }>;
  } | null;
  emailMap: Record<string, string>;
}

export const ActivityMonitor = ({ recentActivity, emailMap }: ActivityMonitorProps) => {
  const formatTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const getUserDisplay = (userId: string) => {
    const email = emailMap[userId];
    if (email) return email;
    return userId.slice(0, 8) + "...";
  };

  // Create unified activity feed
  const activityFeed = recentActivity ? [
    ...(recentActivity.recentDocuments || []).map(d => ({
      type: 'document' as const,
      id: d.id,
      user_id: d.user_id,
      title: d.file_name,
      subtext: d.document_type || 'document',
      created_at: d.created_at
    })),
    ...(recentActivity.recentChats || []).map(c => ({
      type: 'chat' as const,
      id: c.id,
      user_id: c.user_id,
      title: c.title,
      subtext: 'chat session',
      created_at: c.created_at
    })),
    ...(recentActivity.recentAnalyses || []).map(a => ({
      type: 'analysis' as const,
      id: a.id,
      user_id: a.user_id,
      title: a.file_name,
      subtext: Array.isArray(a.analyses_run) ? `${a.analyses_run.length} analyses` : 'data analysis',
      created_at: a.created_at
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100) : [];

  const getActivityIcon = (type: 'document' | 'chat' | 'analysis') => {
    switch (type) {
      case 'document':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'chat':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'analysis':
        return <BarChart3 className="h-4 w-4 text-purple-500" />;
    }
  };

  const getActivityBadge = (type: 'document' | 'chat' | 'analysis') => {
    switch (type) {
      case 'document':
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Document</Badge>;
      case 'chat':
        return <Badge variant="outline" className="text-green-600 border-green-300">Chat</Badge>;
      case 'analysis':
        return <Badge variant="outline" className="text-purple-600 border-purple-300">Analysis</Badge>;
    }
  };

  return (
    <Tabs defaultValue="feed" className="space-y-4">
      <TabsList>
        <TabsTrigger value="feed">Activity Feed</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="chats">Chats</TabsTrigger>
        <TabsTrigger value="analyses">Analyses</TabsTrigger>
      </TabsList>

      <TabsContent value="feed">
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Real-time platform activity feed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {activityFeed.length > 0 ? (
                activityFeed.map((activity) => (
                  <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="mt-1">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {getUserDisplay(activity.user_id)} • {activity.subtext}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getActivityBadge(activity.type)}
                      <span className="text-xs text-muted-foreground">
                        {formatTime(activity.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="documents">
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Documents generated by users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity?.recentDocuments?.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.file_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.document_type || "document"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{getUserDisplay(doc.user_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(doc.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(!recentActivity?.recentDocuments || recentActivity.recentDocuments.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No documents found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="chats">
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle>Recent Chat Sessions</CardTitle>
            <CardDescription>AI chat conversations started by users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity?.recentChats?.map((chat) => (
                    <TableRow key={chat.id}>
                      <TableCell className="font-medium">{chat.title}</TableCell>
                      <TableCell className="text-sm">{getUserDisplay(chat.user_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(chat.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(!recentActivity?.recentChats || recentActivity.recentChats.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No chat sessions found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="analyses">
        <Card className="shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle>Recent Data Analyses</CardTitle>
            <CardDescription>Statistical analyses performed by users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Analyses</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity?.recentAnalyses?.map((analysis) => (
                    <TableRow key={analysis.id}>
                      <TableCell className="font-medium">{analysis.file_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {Array.isArray(analysis.analyses_run) 
                            ? `${analysis.analyses_run.length} types`
                            : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{getUserDisplay(analysis.user_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(analysis.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(!recentActivity?.recentAnalyses || recentActivity.recentAnalyses.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No analyses found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
