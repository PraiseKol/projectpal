

# Fix Authentication Issues: Email Sender, Password Reset, Google Sign-in, and Cross-Provider Login

## Issues Identified

### 1. Email Sender Shows "no-reply@auth.lovable.cloud"
**Limitation**: The email sender address is managed by Lovable Cloud's authentication system and cannot be customized through code changes. This is a platform-level setting. To customize the sender name/address, you would need to configure a custom SMTP provider through Lovable Cloud's authentication settings.

**Action**: Open the Lovable Cloud backend settings to check if custom SMTP configuration is available. If not, this is a current platform limitation.

### 2. Password Reset Redirects to Dashboard Instead of Reset Form
**Root cause**: When a user clicks the reset password link in their email, the authentication system processes the recovery token and creates a session. The `ProtectedRoute` component and `Auth.tsx` `onAuthStateChange` listener detect this session and immediately redirect the user to `/dashboard` before the `/reset-password` page can handle the `PASSWORD_RECOVERY` event.

**Fix in `src/components/ProtectedRoute.tsx`**: Detect the `PASSWORD_RECOVERY` event in the auth state change listener and redirect to `/reset-password` instead of the dashboard.

**Fix in `src/pages/Auth.tsx`**: When the `onAuthStateChange` fires with `PASSWORD_RECOVERY` event, redirect to `/reset-password` instead of `/dashboard`.

### 3. Google Sign-in Shows "Page Not Found"
**Root cause**: After Google OAuth completes, the Lovable Cloud auth module redirects to `/~oauth` to process the tokens. However, this route is not defined in the React Router configuration, so the catch-all `*` route renders the `NotFound` page.

**Fix in `src/App.tsx`**: Add a route for `/~oauth` that renders a loading/processing component, or better yet, handle it before the router catches it. The simplest fix is to add a catch for this path that shows a loading spinner while the OAuth module processes the callback.

### 4. Cross-Provider Login (Google vs Email)
**Problem**: If someone signs up with Google and later tries to sign in with email/password (or vice versa), they get a confusing error.

**Fix in `src/pages/Auth.tsx`**:
- In `handleSignIn`: Catch the "Invalid login credentials" error and show a helpful message suggesting they may have signed up with Google instead
- In `handleSignUp`: When a user tries to sign up with email but already has a Google account, show a message directing them to use Google sign-in
- Add a helper message near the error display

## Technical Details

### File: `src/App.tsx`
- Add a new route: `<Route path="/~oauth" element={<OAuthCallback />} />`
- Create a simple `OAuthCallback` component that shows a loading spinner while the Lovable auth module processes the OAuth redirect

### File: `src/components/ProtectedRoute.tsx`
- Update `onAuthStateChange` to check for `PASSWORD_RECOVERY` event
- When detected, redirect to `/reset-password` instead of staying on the current protected page

### File: `src/pages/Auth.tsx`
- Update `onAuthStateChange` to handle `PASSWORD_RECOVERY` event by navigating to `/reset-password`
- Improve error handling in `handleSignIn` to detect Google-only accounts and show a user-friendly message like "It looks like you signed up with Google. Please use the Google sign-in button."
- Improve `handleSignUp` to detect existing Google accounts and suggest using Google sign-in

### File: `src/pages/ResetPassword.tsx`
- No major changes needed; the existing logic is sound once users actually reach this page

### New File: `src/components/OAuthCallback.tsx`
- Simple component that renders a centered loading spinner
- The Lovable auth module handles the token processing automatically in the background

### Email Sender Customization
- This requires configuring custom SMTP settings through Lovable Cloud
- Will open the backend settings panel for you to check available options

