-- Create trigger for new user profile creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, plan_type, monthly_credits, daily_credits, daily_reset_date, paid_credits)
SELECT 
  id,
  'free',
  40,
  8,
  CURRENT_DATE,
  0
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);