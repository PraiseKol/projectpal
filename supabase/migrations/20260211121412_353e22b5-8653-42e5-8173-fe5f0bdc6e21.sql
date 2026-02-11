-- Insert super_admin role for praise.kolawole@bowen.edu.ng
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'praise.kolawole@bowen.edu.ng';
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email praise.kolawole@bowen.edu.ng not found';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;