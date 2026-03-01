
-- Add payment_screenshot_url to commission_payouts
ALTER TABLE public.commission_payouts ADD COLUMN IF NOT EXISTS payment_screenshot_url text;

-- Create payment-screenshots storage bucket (public read for viewing)
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Admin can upload payment screenshots
CREATE POLICY "Admins can upload payment screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-screenshots' 
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- Anyone authenticated can view payment screenshots (ambassadors need to see their proof)
CREATE POLICY "Authenticated users can view payment screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-screenshots');

-- Admins can delete payment screenshots
CREATE POLICY "Admins can delete payment screenshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-screenshots'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);
