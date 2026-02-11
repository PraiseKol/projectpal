import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import Paraphraser from "./pages/Paraphraser";
import Documents from "./pages/Documents";
import DocumentEditor from "./pages/DocumentEditor";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import TransactionHistory from "./pages/TransactionHistory";
import Admin from "./pages/Admin";
import Ambassador from "./pages/Ambassador";
import NotFound from "./pages/NotFound";
import DataAnalysis from "./pages/DataAnalysis";
import QuestionnaireBuilder from "./pages/QuestionnaireBuilder";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pricing" element={<Pricing />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/paraphraser" element={<ProtectedRoute><Paraphraser /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
              <Route path="/document-editor" element={<ProtectedRoute><DocumentEditor /></ProtectedRoute>} />
              <Route path="/checkout-success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/ambassador" element={<ProtectedRoute><Ambassador /></ProtectedRoute>} />
              <Route path="/data-analysis" element={<ProtectedRoute><DataAnalysis /></ProtectedRoute>} />
              <Route path="/questionnaire-builder" element={<ProtectedRoute><QuestionnaireBuilder /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
