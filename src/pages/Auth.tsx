import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle2, XCircle, Mail, ArrowLeft, RefreshCw, Gift, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SEO } from "@/components/SEO";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { 
  signInSchema, 
  signUpSchema, 
  forgotPasswordSchema,
  getAuthErrorMessage 
} from "@/lib/validations/auth";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(searchParams.get("ref")?.toUpperCase() || "");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidation, setCodeValidation] = useState<'valid' | 'invalid' | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; email?: string; password?: string }>({});
  
  // Email verification states
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard", { replace: true });
      }
      setIsCheckingAuth(false);
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
        return;
      }
      if (session && event === "SIGNED_IN") {
        // Only redirect if email is confirmed
        if (session.user.email_confirmed_at) {
          navigate("/dashboard", { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Password strength indicators
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };

  const validateSignIn = () => {
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const validateSignUp = () => {
    const result = signUpSchema.safeParse({ firstName, lastName, email, password });
    if (!result.success) {
      const fieldErrors: { firstName?: string; lastName?: string; email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "firstName") fieldErrors.firstName = err.message;
        if (err.path[0] === "lastName") fieldErrors.lastName = err.message;
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleResendConfirmation = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      
      if (error) throw error;
      
      toast.success("Verification email resent! Please check your inbox.");
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error.message));
    } finally {
      setIsResending(false);
    }
  };

  // Validate referral code
  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setCodeValidation(null);
      return;
    }
    
    setIsValidatingCode(true);
    try {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("id")
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      
      setCodeValidation(data ? 'valid' : 'invalid');
    } catch (error) {
      setCodeValidation(null);
    } finally {
      setIsValidatingCode(false);
    }
  };

  // Debounced validation on referral code change
  useEffect(() => {
    if (!referralCode) {
      setCodeValidation(null);
      return;
    }
    const timer = setTimeout(() => {
      validateReferralCode(referralCode);
    }, 500);
    return () => clearTimeout(timer);
  }, [referralCode]);

  const handleBackToSignUp = () => {
    setPendingVerification(false);
    setPendingEmail("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignUp()) return;
    
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            referral_code: referralCode.trim() || undefined,
          },
        },
      });

      if (error) throw error;

      // Check if user already exists (Supabase returns user with identities: [] for existing users)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error("An account with this email already exists. If you signed up with Google, please use the 'Sign in with Google' button.");
        return;
      }

      // Check if email needs confirmation
      if (data.user && !data.user.email_confirmed_at) {
        // Email not confirmed - show verification screen
        setPendingEmail(email.trim());
        setPendingVerification(true);
        toast.success("Please check your email to verify your account!");
      } else if (data.session) {
        // User was auto-confirmed (shouldn't happen with proper settings)
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignIn()) return;
    
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Check if the error is about email not being confirmed
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setPendingEmail(email.trim());
          setPendingVerification(true);
          toast.error("Please verify your email before signing in. Check your inbox for the verification link.");
          return;
        }
        // Check if user might have signed up with Google
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          toast.error("Invalid login credentials. If you signed up with Google, please use the 'Sign in with Google' button instead.");
          return;
        }
        throw error;
      }

      toast.success("Signed in successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error.message));
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const result = forgotPasswordSchema.safeParse({ email: resetEmail });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast.success("Password reset link sent to your email");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const PasswordStrengthIndicator = () => (
    <div className="mt-2 space-y-1 text-xs">
      <div className="flex items-center gap-2">
        {passwordChecks.length ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : (
          <XCircle className="h-3 w-3 text-muted-foreground" />
        )}
        <span className={passwordChecks.length ? "text-green-500" : "text-muted-foreground"}>
          At least 8 characters
        </span>
      </div>
      <div className="flex items-center gap-2">
        {passwordChecks.uppercase ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : (
          <XCircle className="h-3 w-3 text-muted-foreground" />
        )}
        <span className={passwordChecks.uppercase ? "text-green-500" : "text-muted-foreground"}>
          One uppercase letter
        </span>
      </div>
      <div className="flex items-center gap-2">
        {passwordChecks.lowercase ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : (
          <XCircle className="h-3 w-3 text-muted-foreground" />
        )}
        <span className={passwordChecks.lowercase ? "text-green-500" : "text-muted-foreground"}>
          One lowercase letter
        </span>
      </div>
      <div className="flex items-center gap-2">
        {passwordChecks.number ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : (
          <XCircle className="h-3 w-3 text-muted-foreground" />
        )}
        <span className={passwordChecks.number ? "text-green-500" : "text-muted-foreground"}>
          One number
        </span>
      </div>
    </div>
  );

  // Email verification pending screen
  if (pendingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <SEO 
          title="Verify Your Email | ProjectPal"
          description="Please check your email to verify your account."
        />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Mail className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
            <CardDescription className="text-base mt-2">
              We've sent a verification link to
            </CardDescription>
            <p className="font-semibold text-foreground mt-1">{pendingEmail}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="mb-2">
                Click the link in the email to verify your account. Once verified, you'll be automatically signed in.
              </p>
              <p>
                Can't find the email? Check your spam folder.
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleResendConfirmation}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleBackToSignUp}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Use a Different Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SEO 
        title="Sign In | ProjectPal"
        description="Sign in or create an account to access AI-powered academic project assistance. Generate topics, write chapters, and get research help."
        keywords="academic writing login, AI assistant signup, research projects account"
      />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ProjectPalLogo size="lg" />
          </div>
          <CardDescription>Your academic project assistant</CardDescription>
          <p className="text-xs text-muted-foreground mt-2">
            ✨ Check out the plans and choose an affordable one to experience a smooth project work time experience
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full" onValueChange={() => setErrors({})}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    required
                    className={`rounded-xl ${errors.email ? "border-destructive" : ""}`}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "signin-email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="signin-email-error" className="text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      required
                      className={`rounded-xl pr-10 ${errors.password ? "border-destructive" : ""}`}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "signin-password-error" : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <p id="signin-password-error" className="text-sm text-destructive">
                      {errors.password}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} variant="gradient">
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
                  <DialogTrigger asChild>
                    <Button variant="link" className="w-full text-sm">
                      Forgot Password?
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Password</DialogTitle>
                      <DialogDescription>
                        Enter your email address and we'll send you a link to reset your password.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                      <Button onClick={handleForgotPassword} className="w-full" disabled={isLoading}>
                        {isLoading ? "Sending..." : "Send Reset Link"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign in with Google
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname">First Name</Label>
                    <Input
                      id="signup-firstname"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                      }}
                      required
                      className={`rounded-xl ${errors.firstName ? "border-destructive" : ""}`}
                      aria-invalid={!!errors.firstName}
                      aria-describedby={errors.firstName ? "signup-firstname-error" : undefined}
                    />
                    {errors.firstName && (
                      <p id="signup-firstname-error" className="text-sm text-destructive">
                        {errors.firstName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-lastname">Last Name</Label>
                    <Input
                      id="signup-lastname"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
                      }}
                      required
                      className={`rounded-xl ${errors.lastName ? "border-destructive" : ""}`}
                      aria-invalid={!!errors.lastName}
                      aria-describedby={errors.lastName ? "signup-lastname-error" : undefined}
                    />
                    {errors.lastName && (
                      <p id="signup-lastname-error" className="text-sm text-destructive">
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    required
                    className={`rounded-xl ${errors.email ? "border-destructive" : ""}`}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "signup-email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="signup-email-error" className="text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      required
                      className={`rounded-xl pr-10 ${errors.password ? "border-destructive" : ""}`}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "signup-password-error" : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <p id="signup-password-error" className="text-sm text-destructive">
                      {errors.password}
                    </p>
                  )}
                  <PasswordStrengthIndicator />
                </div>

                {/* Referral Code Field */}
                <div className="space-y-2">
                  <Label htmlFor="signup-referral" className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    Referral Code (Optional)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Get 10% off your first 3 subscription upgrades when you sign up with a valid referral code!</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="relative">
                    <Input
                      id="signup-referral"
                      type="text"
                      placeholder="Enter referral code"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className={`rounded-xl pr-10 ${
                        codeValidation === 'valid' ? 'border-green-500 focus-visible:ring-green-500' : 
                        codeValidation === 'invalid' ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                      maxLength={12}
                    />
                    {isValidatingCode && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!isValidatingCode && codeValidation === 'valid' && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!isValidatingCode && codeValidation === 'invalid' && (
                      <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {codeValidation === 'invalid' && (
                    <p className="text-xs text-destructive">Invalid or inactive referral code</p>
                  )}
                  {codeValidation === 'valid' && (
                    <p className="text-xs text-green-600">Valid referral code!</p>
                  )}
                  {!codeValidation && (
                    <p className="text-xs text-muted-foreground">
                      Have a referral code? Enter it to support your referrer
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} variant="gradient">
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign up with Google
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
