import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Plus, Trash2, Search } from "lucide-react";
import { TableRowSkeleton } from "@/components/skeletons/TableRowSkeleton";

interface Role {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface RoleManagementProps {
  emailMap: Record<string, string>;
  users: Array<{ id: string; first_name: string | null; last_name: string | null }>;
}

export const RoleManagement = ({ emailMap, users }: RoleManagementProps) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "moderator" | "super_admin" | "ambassador">("moderator");
  const [userRoleHierarchy, setUserRoleHierarchy] = useState<{ isSuperAdmin: boolean }>({ isSuperAdmin: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRoles();
    loadRoleHierarchy();
  }, []);

  const loadRoleHierarchy = async () => {
    try {
      const response = await callAdminOperation("getRoleHierarchy", {});
      setUserRoleHierarchy({ isSuperAdmin: response.isSuperAdmin });
    } catch (error) {
      console.error("Error loading role hierarchy:", error);
    }
  };

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error("Error loading roles:", error);
      toast.error("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  const callAdminOperation = async (action: string, params: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await supabase.functions.invoke("admin-operations", {
      body: { action, ...params },
    });

    if (response.error) throw response.error;
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  };

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    setIsSubmitting(true);
    try {
      await callAdminOperation("assignRole", {
        targetUserId: selectedUserId,
        role: selectedRole,
        reason: "Assigned via admin panel"
      });
      
      toast.success("Role assigned successfully");
      setIsAddDialogOpen(false);
      setSelectedUserId("");
      loadRoles();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveRole = async (role: Role) => {
    if (!confirm(`Are you sure you want to remove the ${role.role} role from this user?`)) {
      return;
    }

    try {
      await callAdminOperation("removeRole", {
        targetUserId: role.user_id,
        role: role.role,
        reason: "Removed via admin panel"
      });
      
      toast.success("Role removed successfully");
      loadRoles();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove role");
    }
  };

  const getUserDisplay = (userId: string) => {
    const email = emailMap[userId];
    const user = users.find(u => u.id === userId);
    const name = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "";
    
    if (email && name) return `${name} (${email})`;
    if (email) return email;
    if (name) return name;
    return userId.slice(0, 8) + "...";
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">Super Admin</Badge>;
      case "admin":
        return <Badge className="bg-destructive">Admin</Badge>;
      case "moderator":
        return <Badge className="bg-primary">Moderator</Badge>;
      case "ambassador":
        return <Badge className="bg-green-600">Ambassador</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const filteredRoles = roles.filter(role => {
    const userDisplay = getUserDisplay(role.user_id).toLowerCase();
    return userDisplay.includes(searchTerm.toLowerCase()) || 
           role.role.includes(searchTerm.toLowerCase());
  });

  // Users without special roles for assignment dropdown
  const usersWithoutRole = users.filter(u => 
    !roles.some(r => r.user_id === u.id && r.role === selectedRole)
  );

  return (
    <Card className="shadow-md rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Management
            </CardTitle>
            <CardDescription>Assign and manage user roles and permissions</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Assign Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Role to User</DialogTitle>
                <DialogDescription>
                  Select a user and the role you want to assign
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
              <div>
                  <Label>Role</Label>
                  <Select 
                    value={selectedRole} 
                    onValueChange={(v: "admin" | "moderator" | "super_admin" | "ambassador") => setSelectedRole(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambassador">Ambassador</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {userRoleHierarchy.isSuperAdmin && (
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {usersWithoutRole.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {getUserDisplay(user.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleAssignRole} 
                  disabled={isSubmitting || !selectedUserId}
                  className="w-full"
                >
                  {isSubmitting ? "Assigning..." : "Assign Role"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRowSkeleton columns={4} rows={5} />
              ) : filteredRoles.length > 0 ? (
                filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      {getUserDisplay(role.user_id)}
                    </TableCell>
                    <TableCell>{getRoleBadge(role.role)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(role.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRole(role)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No roles found matching your search" : "No roles assigned yet"}
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
