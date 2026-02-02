

# Standalone Auth Bridge Page for Vercel

## Overview
Create a **completely standalone, single-file HTML page** that can be deployed to Vercel independently of the main app. This page handles email verification and password reset redirects without any React, build tools, or external dependencies.

## Why a Standalone HTML File?

The current `AuthCallbackPage.tsx` uses:
- React and JSX
- Capacitor (native platform detection)
- Tailwind CSS classes
- Local logo import
- shadcn/ui Button component

For Vercel deployment, you'd need to either deploy the entire React app or create a completely standalone page. A **single HTML file** is the cleanest solution:

| Approach | Pros | Cons |
|----------|------|------|
| Deploy entire app | Uses existing code | Exposes all routes, large bundle |
| Standalone HTML file | Tiny, fast, no build step | Duplicates styling |

## What I'll Create

A new file `public/auth-callback.html` - a single, self-contained HTML page with:

- **Inline CSS** matching MyCalorics branding (sage green, warm taupe)
- **Inline JavaScript** for token parsing and deep link redirect
- **Base64-encoded logo** or hosted logo URL
- **No external dependencies** (no React, no Tailwind, no npm)

## File Structure for Vercel

```text
vercel-auth-bridge/
├── index.html          ← The standalone auth page
├── vercel.json         ← Route configuration
└── logo.png            ← MyCalorics logo
```

When deployed to Vercel, visiting `mycalorics.vercel.app/` will show the auth page.

## The Standalone Page Will Handle

1. **Email Verification** (`type=signup` or `type=email`)
   - Redirects to `mycalorics://library?access_token=...`
   
2. **Password Reset** (`type=recovery`)
   - Redirects to `mycalorics://reset-password?access_token=...`
   
3. **Error States**
   - Shows branded error message if authentication failed
   
4. **Manual Fallback**
   - "Open MyCalorics App" button if auto-redirect doesn't work

## Implementation Details

### Inline Styles (matches current theme)
```css
:root {
  --background: hsl(80 20% 97%);
  --foreground: hsl(80 10% 15%);
  --primary: hsl(100 22% 55%);
  --primary-10: hsl(100 22% 55% / 0.1);
  --muted: hsl(80 10% 35%);
  --destructive-10: hsl(0 72% 50% / 0.1);
}
```

### Token Parsing Logic
```javascript
const hash = window.location.hash;
const params = new URLSearchParams(hash.substring(1));
const accessToken = params.get('access_token');
const refreshToken = params.get('refresh_token');
const type = params.get('type');
```

### Deep Link Construction
```javascript
const appPath = type === 'recovery' ? 'reset-password' : 'library';
let deepLink = `mycalorics://${appPath}`;
if (accessToken) {
  const tokenParams = new URLSearchParams();
  tokenParams.set('access_token', accessToken);
  if (refreshToken) tokenParams.set('refresh_token', refreshToken);
  if (type) tokenParams.set('type', type);
  deepLink += '?' + tokenParams.toString();
}
window.location.href = deepLink;
```

## Files I'll Create

| File | Purpose |
|------|---------|
| `public/auth-callback.html` | Standalone auth bridge page (can be copied to Vercel project) |

This approach gives you a **ready-to-deploy file** that you can simply copy to a new Vercel project folder and deploy with zero configuration.

## Deployment Steps (After Implementation)

1. Create a new folder on your computer
2. Copy `auth-callback.html` → rename to `index.html`
3. Copy the logo.png file
4. Run `vercel` in that folder (or drag to Vercel dashboard)
5. Update Supabase redirect URLs to your Vercel URL

