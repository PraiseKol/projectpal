-- Create referral_codes table
CREATE TABLE public.referral_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    is_active boolean DEFAULT true,
    CONSTRAINT unique_user_referral_code UNIQUE(user_id)
);

-- Create referrals table
CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ambassador_user_id uuid NOT NULL,
    referred_user_id uuid NOT NULL,
    referral_code_used text NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_referred_user UNIQUE(referred_user_id)
);

-- Create ambassador_commissions table
CREATE TABLE public.ambassador_commissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ambassador_user_id uuid NOT NULL,
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    referred_user_id uuid NOT NULL,
    transaction_amount integer NOT NULL,
    commission_rate decimal(5,4) DEFAULT 0.05,
    commission_amount integer NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'paid')),
    claimed_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Create commission_payouts table
CREATE TABLE public.commission_payouts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ambassador_user_id uuid NOT NULL,
    amount integer NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    admin_user_id uuid,
    admin_notes text,
    payment_method text,
    payment_reference text,
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz
);

-- Add referred_by column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid;

-- Create indexes for performance
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX idx_referral_codes_user_id ON public.referral_codes(user_id);
CREATE INDEX idx_referrals_ambassador ON public.referrals(ambassador_user_id);
CREATE INDEX idx_referrals_referred_user ON public.referrals(referred_user_id);
CREATE INDEX idx_commissions_ambassador ON public.ambassador_commissions(ambassador_user_id);
CREATE INDEX idx_commissions_status ON public.ambassador_commissions(status);
CREATE INDEX idx_payouts_ambassador ON public.commission_payouts(ambassador_user_id);
CREATE INDEX idx_payouts_status ON public.commission_payouts(status);

-- Enable RLS on all new tables
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_codes
CREATE POLICY "Ambassadors can view their own code"
ON public.referral_codes FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Ambassadors can insert their own code"
ON public.referral_codes FOR INSERT
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'ambassador'::app_role));

CREATE POLICY "Admins can update referral codes"
ON public.referral_codes FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for referrals
CREATE POLICY "Ambassadors can view their referrals"
ON public.referrals FOR SELECT
USING (ambassador_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for ambassador_commissions
CREATE POLICY "Ambassadors can view their commissions"
ON public.ambassador_commissions FOR SELECT
USING (ambassador_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for commission_payouts
CREATE POLICY "Ambassadors can view own payouts"
ON public.commission_payouts FOR SELECT
USING (ambassador_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Ambassadors can request payouts"
ON public.commission_payouts FOR INSERT
WITH CHECK (ambassador_user_id = auth.uid() AND has_role(auth.uid(), 'ambassador'::app_role));

CREATE POLICY "Admins can update payouts"
ON public.commission_payouts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin policies for user_roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update roles"
ON public.user_roles FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete roles"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin policies for admin_audit_log
CREATE POLICY "Super admins can view audit logs"
ON public.admin_audit_log FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert audit logs"
ON public.admin_audit_log FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));