import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { SuspensionBanner } from "@/components/SuspensionBanner";
import { FeatureGate } from "@/components/FeatureGate";
import { lazy, Suspense, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Route-level code splitting: heavy pages (and their docx/jspdf exports)
// load only when the visitor opens them.
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Settings = lazy(() => import("./pages/Settings"));
const Paraphraser = lazy(() => import("./pages/Paraphraser"));
const Documents = lazy(() => import("./pages/Documents"));
const DocumentEditor = lazy(() => import("./pages/DocumentEditor"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const Admin = lazy(() => import("./pages/Admin"));
const Ambassador = lazy(() => import("./pages/Ambassador"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DataAnalysis = lazy(() => import("./pages/DataAnalysis"));
const QuestionnaireBuilder = lazy(() => import("./pages/QuestionnaireBuilder"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const Humanizer = lazy(() => import("./pages/Humanizer"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Topics = lazy(() => import("./pages/Topics"));
const DepartmentTopics = lazy(() => import("./pages/DepartmentTopics"));
import OAuthCallback from "./components/OAuthCallback";

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
  </div>
);

const queryClient = new QueryClient();

const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthEventHandler />
            <MaintenanceBanner />
            <SuspensionBanner />
            <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/f/:slug" element={<PublicForm />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/topics" element={<Topics />} />
              <Route path="/topics/:department" element={<DepartmentTopics />} />
              <Route path="/~oauth/*" element={<OAuthCallback />} />
              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><FeatureGate feature="chat"><Chat /></FeatureGate></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/paraphraser" element={<ProtectedRoute><FeatureGate feature="paraphraser"><Paraphraser /></FeatureGate></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><FeatureGate feature="powerpoint_generator"><Documents /></FeatureGate></ProtectedRoute>} />
              <Route path="/document-editor" element={<ProtectedRoute><FeatureGate feature="document_editor"><DocumentEditor /></FeatureGate></ProtectedRoute>} />
              <Route path="/checkout-success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/ambassador" element={<ProtectedRoute><Ambassador /></ProtectedRoute>} />
              <Route path="/data-analysis" element={<ProtectedRoute><FeatureGate feature="data_analysis"><DataAnalysis /></FeatureGate></ProtectedRoute>} />
              <Route path="/questionnaire-builder" element={<ProtectedRoute><FeatureGate feature="questionnaire_builder"><QuestionnaireBuilder /></FeatureGate></ProtectedRoute>} />
              <Route path="/humanizer" element={<ProtectedRoute><FeatureGate feature="humanizer"><Humanizer /></FeatureGate></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
