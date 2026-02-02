
# Email Verification Bridge Page Implementation

## Overview
Update the authentication flow to use `mycalorics://` URL scheme and MyCalorics branding. The bridge page will work with any hosting (Vercel default subdomain, custom domain, or Lovable preview URL).

## Production Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  User clicks email verification link                            │
│  (e.g., mycalorics.vercel.app/auth-callback#access_token=...)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Web Bridge Page (AuthCallbackPage)                             │
│  ──────────────────────────────────────────────────────────     │
│  1. Shows MyCalorics branded loading screen                     │
│  2. Parses tokens from URL hash                                 │
│  3. Redirects to: mycalorics://library?access_token=...         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Native App (Android/iOS)                                       │
│  ──────────────────────────────────────────────────────────     │
│  1. Receives deep link via intent filter                        │
│  2. Extracts access_token and refresh_token                     │
│  3. Calls supabase.auth.setSession() to establish session       │
│  4. Navigates to /library - user is now verified & logged in    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `android/app/src/main/AndroidManifest.xml` | Change URL scheme from `securereader` to `mycalorics` |
| `src/pages/AuthCallbackPage.tsx` | Update all `securereader://` references to `mycalorics://`, rebrand UI |
| `src/hooks/useDeepLinking.ts` | Update protocol check from `securereader:` to `mycalorics:`, add session establishment |

---

## Detailed Changes

### 1. Android Manifest - Update URL Scheme

Change line 30 from:
```xml
<data android:scheme="securereader" />
```
To:
```xml
<data android:scheme="mycalorics" />
```

### 2. AuthCallbackPage - Rebrand & Update Scheme

**URL Scheme Updates:**
- Line 51: `securereader://${appPath}` → `mycalorics://${appPath}`
- Line 90: `securereader://${appPath}${hash}` → `mycalorics://${appPath}${hash}`

**Branding Updates:**
- Replace "SecureReader" with "MyCalorics" in all text
- Update colors to match MyCalorics theme (warm sage green instead of slate)
- Add the MyCalorics logo
- Update button text and helper messages

### 3. Deep Link Handler - Add Session Establishment

**Protocol Update:**
- Line 34: `securereader:` → `mycalorics:`

**Add Token Extraction & Session Setup:**
When the app receives a deep link with tokens, extract them and establish the Supabase session:
```typescript
// Extract tokens from URL search params
const accessToken = url.searchParams.get('access_token');
const refreshToken = url.searchParams.get('refresh_token');

if (accessToken && refreshToken) {
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
}
```

---

## What You'll Need to Do After Implementation

### For Testing (Development)
1. Export to GitHub and pull the changes
2. Run `npx cap sync android` to update native project
3. Rebuild the Android app in Android Studio
4. Configure Supabase redirect URL to Lovable preview URL

### For Production (Vercel)
1. Deploy the AuthCallbackPage to Vercel (can be the minimal standalone version)
2. In Lovable Cloud backend settings, update:
   - **Site URL**: `https://mycalorics.vercel.app` (or your Vercel subdomain)
   - **Redirect URLs**: Add `https://mycalorics.vercel.app/auth-callback`

---

## Vercel Deployment Note

When you deploy to Vercel, you'll host **only the AuthCallbackPage** - it's a lightweight bridge that:
- Shows a branded loading screen
- Captures the auth tokens from Supabase
- Redirects to your native app

The rest of your app stays secure inside the native mobile app, never exposed on the web.
just make sure i will be able to deploy that single page to vercel easily.


