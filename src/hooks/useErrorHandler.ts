import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { translateError, getErrorTitle, isErrorType, logError } from "@/utils/errorMessages";

interface ErrorHandlerOptions {
  /** Custom title override */
  title?: string;
  /** Context for logging (e.g., "ChatPage") */
  context?: string;
  /** Whether to show toast (default: true) */
  showToast?: boolean;
  /** Callback after handling */
  onError?: (error: any) => void;
  /** Navigate to auth on 401 */
  redirectOnAuth?: boolean;
  /** Navigate to pricing on 402/credits */
  redirectOnCredits?: boolean;
}

/**
 * Production-ready error handler hook
 * Provides consistent error handling with user-friendly messages
 */
export const useErrorHandler = () => {
  const navigate = useNavigate();

  const handleError = useCallback((error: any, options: ErrorHandlerOptions = {}) => {
    const {
      title,
      context = "App",
      showToast = true,
      onError,
      redirectOnAuth = false,
      redirectOnCredits = false,
    } = options;

    // Log in development only
    logError(context, error);

    // Get user-friendly message
    const message = translateError(error);
    const errorTitle = title || getErrorTitle(error);

    // Handle redirects for specific error types
    if (redirectOnAuth && isErrorType(error, 'auth')) {
      if (showToast) {
        toast.error(message, { description: "Redirecting to sign in..." });
      }
      setTimeout(() => navigate("/auth"), 1500);
      onError?.(error);
      return;
    }

    if (redirectOnCredits && isErrorType(error, 'credits')) {
      if (showToast) {
        toast.error(message, { 
          description: "View pricing options",
          action: {
            label: "Upgrade",
            onClick: () => navigate("/pricing"),
          },
        });
      }
      onError?.(error);
      return;
    }

    // Show toast notification
    if (showToast) {
      toast.error(message, {
        description: errorTitle !== "Error" ? `${errorTitle}` : undefined,
      });
    }

    onError?.(error);
  }, [navigate]);

  /**
   * Quick error handler for try-catch blocks
   */
  const quickError = useCallback((error: any, context?: string) => {
    handleError(error, { context, redirectOnAuth: true, redirectOnCredits: true });
  }, [handleError]);

  /**
   * Show a user-friendly error toast
   */
  const showError = useCallback((error: any, customTitle?: string) => {
    const message = translateError(error);
    const title = customTitle || getErrorTitle(error);
    toast.error(message, {
      description: title !== "Error" ? title : undefined,
    });
  }, []);

  /**
   * Get translated error message without showing toast
   */
  const getErrorMessage = useCallback((error: any): string => {
    return translateError(error);
  }, []);

  return {
    handleError,
    quickError,
    showError,
    getErrorMessage,
    translateError,
    isErrorType,
    logError,
  };
};

export default useErrorHandler;
