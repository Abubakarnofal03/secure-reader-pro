
# Forgot Password & Email Confirmation Implementation Plan

## Overview
Add forgot password functionality and enable email confirmation for new user signups. Both features will use email links (not OTP) for the best mobile experience.

---

## Features to Implement

### 1. Forgot Password Flow
- Add "Forgot Password?" link on the login screen
- Create a new `ForgotPasswordScreen` for entering email
- Create a `ResetPasswordScreen` for setting new password
- Handle deep links to open the reset password screen

### 2. Email Confirmation
- Enable email confirmation in auth settings
- Update signup flow to show "Check your email" message
- Create an `EmailConfirmationScreen` for the pending state
- Handle deep links when users click the confirmation link

---

## New Files to Create

### Pages
| File | Purpose |
|------|---------|
| `src/pages/ForgotPasswordScreen.tsx` | Email input form to request password reset |
| `src/pages/ResetPasswordScreen.tsx` | New password form (opened via email link) |
| `src/pages/EmailConfirmationPendingScreen.tsx` | "Check your email" screen after signup |

---

## Files to Modify

### 1. `src/pages/LoginScreen.tsx`
- Add "Forgot Password?" link below the password field
- Link navigates to `/forgot-password`

### 2. `src/pages/SignupScreen.tsx`
- After signup, redirect to `/confirm-email-pending` instead of `/library`
- Show toast about checking email

### 3. `src/contexts/AuthContext.tsx`
- Add `resetPassword(email)` function using `supabase.auth.resetPasswordForEmail()`
- Add `updatePassword(newPassword)` function using `supabase.auth.updateUser()`

### 4. `src/App.tsx`
- Add routes for new pages:
  - `/forgot-password` → `ForgotPasswordScreen`
  - `/reset-password` → `ResetPasswordScreen`
  - `/confirm-email-pending` → `EmailConfirmationPendingScreen`

---

## Authentication Configuration

### Enable Email Confirmation
Configure the authentication system to require email confirmation before allowing login. New users will need to verify their email before accessing the app.

### Email Redirect URLs
Configure redirect URLs to point back to the app:
- Password reset: `{app_url}/reset-password`
- Email confirmation: `{app_url}/library`

---

## User Experience Flows

### Forgot Password Flow
```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Login Screen   │     │  Forgot Password │     │  Check Email    │
│                 │────▶│     Screen       │────▶│    Message      │
│ [Forgot Pass?]  │     │  [Enter Email]   │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Login Screen   │◀────│  Reset Password  │◀────│   Email Link    │
│   (Success!)    │     │     Screen       │     │    Clicked      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Email Confirmation Flow
```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Signup Screen  │────▶│  Confirm Email   │     │   Email Link    │
│                 │     │  Pending Screen  │     │    Clicked      │
└─────────────────┘     └──────────────────┘     └───────┬─────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │    Library      │
                                                │    Screen       │
                                                └─────────────────┘
```

---

## Technical Details

### Password Reset Function
```typescript
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
};
```

### Update Password Function
```typescript
const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { error };
};
```

### Email Confirmation Handling
The app will detect when a user lands on the app from an email confirmation link by checking the URL hash for authentication tokens. The auth state change listener already handles this - we just need to ensure the user is redirected appropriately after confirmation.

---

## UI Design Approach

All new screens will match the existing premium medical aesthetic:
- Same navy/gold color palette
- Consistent card styling with rounded corners
- Motion animations matching login/signup screens
- Premium icons from Lucide React
- Trust indicators (shield icons, security text)

### ForgotPasswordScreen
- Email input with Mail icon
- "Send Reset Link" button
- Success state with checkmark animation
- Link back to login

### ResetPasswordScreen
- Two password fields (new + confirm)
- Password visibility toggle
- Validation for minimum 6 characters
- Success message with auto-redirect to login

### EmailConfirmationPendingScreen
- Large email/inbox icon animation
- "Check your email" heading
- User's email displayed
- "Resend Email" button
- "Back to Login" link

---

## Deep Linking (Capacitor)

For the mobile app to handle email links properly, we'll update the Capacitor configuration to handle the app's URL scheme. When users click email links on mobile:
1. The link opens the app directly
2. The app parses the URL parameters
3. Users are taken to the appropriate screen (reset password or library)

---

## Security Considerations

1. **Rate Limiting**: Password reset requests are rate-limited by the auth system
2. **Token Expiry**: Reset tokens expire after 1 hour
3. **Single Use**: Reset links can only be used once
4. **Input Validation**: Email and password fields validated before submission
5. **Secure Token Handling**: Auth tokens handled automatically by the Supabase client
