import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logError } from "@/utils/errorMessages";

interface BankDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const BankDetailsModal = ({ open, onOpenChange, onSuccess }: BankDetailsModalProps) => {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      toast.error("Please fill in all bank details");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          bank_name: bankName.trim(),
          bank_account_number: accountNumber.trim(),
          bank_account_holder_name: accountHolder.trim(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Bank details saved successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      logError("BankDetailsModal:submit", error);
      toast.error("Failed to save bank details");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Up Bank Details</DialogTitle>
          <DialogDescription>
            Please provide your bank account details for receiving commission payouts. This is required before you can proceed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              placeholder="e.g. First Bank, GTBank, Access Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="e.g. 0123456789"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountHolder">Account Holder Name</Label>
            <Input
              id="accountHolder"
              placeholder="e.g. John Doe"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : "Save Bank Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
