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
import { translateError, logError } from "@/utils/errorMessages";

interface AmbassadorRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AmbassadorRequestModal = ({ open, onOpenChange, onSuccess }: AmbassadorRequestModalProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [university, setUniversity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!phoneNumber.trim() || !university.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke("ambassador-operations", {
        body: {
          action: "requestAmbassadorRole",
          phoneNumber: phoneNumber.trim(),
          university: university.trim(),
        },
      });
      if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        toast.success("Ambassador request submitted!");
        onSuccess();
        onOpenChange(false);
        setPhoneNumber("");
        setUniversity("");
      }
    } catch (error) {
      logError("AmbassadorRequestModal:submit", error);
      toast.error(translateError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ambassador Application</DialogTitle>
          <DialogDescription>
            Please provide the following details to complete your ambassador request.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g. +234 800 000 0000"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="university">University</Label>
            <Input
              id="university"
              placeholder="e.g. University of Lagos"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
