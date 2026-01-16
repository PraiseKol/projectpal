import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Receipt, Settings, LogOut, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MobileNavProps {
  isAdmin?: boolean;
}

export const MobileNav = ({ isAdmin }: MobileNavProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast.success("Signed out successfully");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isAdmin && (
          <DropdownMenuItem onClick={() => { navigate("/admin"); setOpen(false); }}>
            <Shield className="h-4 w-4 mr-2" />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { navigate("/transactions"); setOpen(false); }}>
          <Receipt className="h-4 w-4 mr-2" />
          Transactions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { navigate("/settings"); setOpen(false); }}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
