import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, UserCog, CreditCard, Shield, Ban } from "lucide-react";
import { UserDetailModal } from "./UserDetailModal";

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

interface UserManagementProps {
  users: User[];
  emailMap: Record<string, string>;
  onRefresh: () => void;
}

export const UserManagement = ({ users, emailMap, onRefresh }: UserManagementProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredUsers = users.filter(user => {
    const email = emailMap[user.id] || "";
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    const matchesSearch = 
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullName.includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = planFilter === "all" || user.plan_type === planFilter;
    const matchesStatus = statusFilter === "all" || (user.status || "active") === statusFilter;
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const getStatusBadge = (status: string = "active") => {
    if (status === "suspended") {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "pro":
        return <Badge className="bg-primary">PRO</Badge>;
      case "scholar":
        return <Badge className="bg-accent text-accent-foreground">SCHOLAR</Badge>;
      default:
        return <Badge variant="secondary">FREE</Badge>;
    }
  };

  return (
    <>
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Search, filter, and manage user accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="scholar">Scholar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredUsers.length} of {users.length} users
          </p>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Daily Credits</TableHead>
                  <TableHead className="text-right">Paid Credits</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {user.first_name || user.last_name 
                            ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                            : "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {emailMap[user.id] || user.id.slice(0, 8) + "..."}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(user.plan_type)}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="text-right">{user.daily_credits}</TableCell>
                    <TableCell className="text-right">{user.paid_credits || 0}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                            <UserCog className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Adjust Credits
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                            <Shield className="h-4 w-4 mr-2" />
                            Change Plan
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleViewDetails(user)}
                            className="text-destructive"
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            {user.status === "suspended" ? "Activate" : "Suspend"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          email={emailMap[selectedUser.id] || ""}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
};
