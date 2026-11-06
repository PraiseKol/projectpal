/**
 * Centralized error translation utility for production-ready user-friendly messages
 */

// Error patterns with user-friendly translations
const ERROR_PATTERNS: Array<{
  patterns: RegExp[];
  title: string;
  message: string;
}> = [
  // Rate limiting / Too many requests
  {
    patterns: [/429/i, /rate.?limit/i, /too.?many.?requests/i, /throttle/i],
    title: "Slow Down",
    message: "You're making requests too quickly. Please wait a moment and try again.",
  },
  // Credit / Payment issues
  {
    patterns: [/402/i, /credits?/i, /insufficient/i, /payment.?required/i, /no.?credits/i],
    title: "No Credits Available",
    message: "You've run out of credits. Please upgrade your plan to continue.",
  },
  // Authentication issues
  {
    patterns: [/401/i, /unauthorized/i, /not.?authenticated/i, /session.?expired/i, /invalid.?token/i],
    title: "Authentication Required",
    message: "Your session has expired. Please sign in again to continue.",
  },
  // Forbidden / Plan restriction
  {
    patterns: [/403/i, /forbidden/i, /scholar/i, /plan.?required/i, /access.?denied/i, /not.?allowed/i],
    title: "Upgrade Required",
    message: "This feature requires a higher plan. Please upgrade to access it.",
  },
  // Subscription expired
  {
    patterns: [/expired/i, /subscription/i, /plan.?expired/i],
    title: "Subscription Expired",
    message: "Your subscription has expired. Please renew to continue using premium features.",
  },
  // Timeout issues
  {
    patterns: [/timeout/i, /504/i, /took.?too.?long/i, /timed?.?out/i, /deadline/i],
    title: "Request Timeout",
    message: "The request took too long. Please try again with a smaller file or simpler request.",
  },
  // Network / Connection issues
  {
    patterns: [/network/i, /fetch.?failed/i, /connection/i, /offline/i, /econnrefused/i, /dns/i],
    title: "Connection Error",
    message: "Unable to connect. Please check your internet connection and try again.",
  },
  // Server errors (generic 500s)
  {
    patterns: [/non-?2xx/i, /status.?code/i, /500/i, /502/i, /503/i, /internal.?server/i, /server.?error/i],
    title: "Server Error",
    message: "Something went wrong on our end. Please try again in a moment.",
  },
  // AI service errors
  {
    patterns: [/ai.?service/i, /ai.?gateway/i, /lovable_api_key/i, /model.?error/i, /openai/i, /gemini/i, /anthropic/i],
    title: "AI Service Unavailable",
    message: "Our AI service is temporarily busy. Please try again in a few seconds.",
  },
  // Parsing errors
  {
    patterns: [/parse/i, /json/i, /unexpected.?token/i, /syntax.?error/i, /malformed/i],
    title: "Processing Error",
    message: "There was an issue processing your request. Please try again.",
  },
  // File size / Upload errors
  {
    patterns: [/size/i, /too.?large/i, /upload/i, /413/i, /payload/i, /exceeds/i],
    title: "File Too Large",
    message: "The file is too large. Please use a smaller file (under 10MB).",
  },
  // Document extraction errors
  {
    patterns: [/extract/i, /content/i, /read.?document/i, /corrupt/i, /invalid.?file/i],
    title: "Document Error",
    message: "We couldn't read your document. Please try a different file format.",
  },
  // Database errors
  {
    patterns: [/database/i, /postgres/i, /supabase/i, /row.?level.?security/i, /rls/i, /constraint/i],
    title: "Data Error",
    message: "Unable to save your data. Please try again or contact support.",
  },
  // XMLHttpRequest (specific to PPT generation)
  {
    patterns: [/xmlhttprequest/i, /is.?not.?defined/i, /reference.?error/i],
    title: "Generation Error",
    message: "Something went wrong during generation. Please try again.",
  },
  // Storage errors
  {
    patterns: [/storage/i, /bucket/i, /object.?not.?found/i, /signed.?url/i],
    title: "Storage Error",
    message: "Unable to access the file. Please try uploading again.",
  },
  // Email errors
  {
    patterns: [/email/i, /smtp/i, /mail/i, /resend/i],
    title: "Email Error",
    message: "Failed to send email. Please check your email address and try again.",
  },
  // Invalid input
  {
    patterns: [/validation/i, /invalid/i, /required/i, /missing/i],
    title: "Invalid Input",
    message: "Please check your input and try again.",
  },
  // Not found
  {
    patterns: [/404/i, /not.?found/i, /does.?not.?exist/i],
    title: "Not Found",
    message: "The requested resource could not be found.",
  },
  // Duplicate / Conflict
  {
    patterns: [/409/i, /conflict/i, /duplicate/i, /already.?exists/i],
    title: "Already Exists",
    message: "This item already exists. Please use a different name or update the existing one.",
  },
];

/**
 * Translates technical error messages into user-friendly messages
 */
export const translateError = (error: any): string => {
  const message = error?.message?.toLowerCase() || String(error).toLowerCase();
  
  for (const { patterns, message: friendlyMessage } of ERROR_PATTERNS) {
    if (patterns.some(pattern => pattern.test(message))) {
      return friendlyMessage;
    }
  }
  
  // Default fallback - never show raw error messages in production
  return "An unexpected error occurred. Please try again.";
};

/**
 * Get a user-friendly error title based on error type
 */
export const getErrorTitle = (error: any): string => {
  const message = error?.message?.toLowerCase() || String(error).toLowerCase();
  
  for (const { patterns, title } of ERROR_PATTERNS) {
    if (patterns.some(pattern => pattern.test(message))) {
      return title;
    }
  }
  
  return "Error";
};

/**
 * Check if error is a specific type (useful for custom handling)
 */
export const isErrorType = (error: any, type: 'auth' | 'credits' | 'network' | 'timeout' | 'server'): boolean => {
  const message = error?.message?.toLowerCase() || String(error).toLowerCase();
  
  const typePatterns: Record<string, RegExp[]> = {
    auth: [/401/i, /unauthorized/i, /not.?authenticated/i, /session/i],
    credits: [/402/i, /credits?/i, /insufficient/i, /payment/i],
    network: [/network/i, /fetch.?failed/i, /connection/i, /offline/i],
    timeout: [/timeout/i, /504/i, /timed?.?out/i],
    server: [/500/i, /502/i, /503/i, /server/i],
  };
  
  return typePatterns[type]?.some(pattern => pattern.test(message)) || false;
};

/**
 * Log error in development only
 */
export const logError = (context: string, error: any): void => {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
};

/**
 * Reads the message an edge function returned with a non-2xx status (supabase-js hides it
 * inside error.context). Returns null when there is no readable message.
 */
export const getFunctionErrorMessage = async (error: any): Promise<string | null> => {
  try {
    const body = await error?.context?.json?.();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
};
