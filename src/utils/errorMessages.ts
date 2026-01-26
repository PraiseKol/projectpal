/**
 * Translates technical error messages into user-friendly messages
 */
export const translateError = (error: any): string => {
  const message = error?.message?.toLowerCase() || String(error).toLowerCase();
  
  // Rate limiting / Too many requests
  if (message.includes("429") || message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many requests. Please wait a moment before trying again.";
  }
  
  // Credit / Payment issues
  if (message.includes("402") || message.includes("credits") || message.includes("insufficient") || message.includes("payment required")) {
    return "You've run out of credits. Please upgrade your plan to continue.";
  }
  
  // Authentication issues
  if (message.includes("401") || message.includes("unauthorized") || message.includes("not authenticated")) {
    return "Please log in again to continue.";
  }
  
  // Subscription expired
  if (message.includes("expired") || message.includes("subscription")) {
    return "Your subscription has expired. Please renew to continue.";
  }
  
  // Plan restriction
  if (message.includes("scholar") || message.includes("plan required") || message.includes("403")) {
    return "This feature requires a Scholar plan. Please upgrade to access it.";
  }
  
  // Timeout issues
  if (message.includes("timeout") || message.includes("504") || message.includes("took too long") || message.includes("timed out")) {
    return "The request took too long. Please try with a smaller document.";
  }
  
  // Network / Connection issues
  if (message.includes("network") || message.includes("fetch failed") || message.includes("connection") || message.includes("offline")) {
    return "Connection error. Please check your internet and try again.";
  }
  
  // Server errors (generic 500s, non-2xx status codes)
  if (message.includes("non-2xx") || message.includes("status code") || message.includes("500") || message.includes("internal server error")) {
    return "Something went wrong on our end. Please try again in a moment.";
  }
  
  // AI service errors
  if (message.includes("ai service") || message.includes("ai gateway") || message.includes("lovable_api_key")) {
    return "Our AI service is temporarily unavailable. Please try again shortly.";
  }
  
  // Parsing errors
  if (message.includes("parse") || message.includes("json") || message.includes("unexpected token")) {
    return "There was an issue processing your request. Please try again.";
  }
  
  // XMLHttpRequest (specific to PPT generation)
  if (message.includes("xmlhttprequest") || message.includes("is not defined")) {
    return "Something went wrong generating your presentation. Please try again.";
  }
  
  // File size / Upload errors
  if (message.includes("size") || message.includes("large") || message.includes("upload")) {
    return "The file is too large. Please use a smaller file (under 10MB).";
  }
  
  // Document extraction errors
  if (message.includes("extract") || message.includes("content")) {
    return "We couldn't read your document. Please try a different file format.";
  }
  
  // Default fallback
  return "An unexpected error occurred. Please try again.";
};

/**
 * Get a user-friendly error title based on error type
 */
export const getErrorTitle = (error: any): string => {
  const message = error?.message?.toLowerCase() || String(error).toLowerCase();
  
  if (message.includes("429") || message.includes("rate limit")) {
    return "Rate Limit Reached";
  }
  if (message.includes("402") || message.includes("credits")) {
    return "No Credits Available";
  }
  if (message.includes("401") || message.includes("unauthorized")) {
    return "Authentication Required";
  }
  if (message.includes("expired") || message.includes("subscription")) {
    return "Subscription Expired";
  }
  if (message.includes("timeout")) {
    return "Request Timeout";
  }
  if (message.includes("network") || message.includes("connection")) {
    return "Connection Error";
  }
  
  return "Error";
};
