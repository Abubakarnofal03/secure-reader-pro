
I’ll implement this as an offline-first reliability fix for low-bandwidth conditions, so the app behaves like offline mode when the connection is too weak.

### What I found
- Auth currently waits up to 5s before using cached session, so users sit on login then get redirected.
- Library/reader treat “online but very slow” as fully online, so they wait on backend calls instead of using downloaded/local data.
- Downloaded book opening still performs online access and metadata fetches before rendering.
- Revocation sync runs on any `navigator.onLine=true`, even on unstable networks.

### Implementation plan

1) Add a **network quality gate** (low-bandwidth detection)
- Create a shared utility (new file) that classifies connection as:
  - `offline`
  - `poor` (forced offline behavior)
  - `good`
- Use browser connection hints when available (`effectiveType`, `downlink`, `rtt`, `saveData`) plus request-timeout fallback for platforms where hints are missing.
- Add a small helper to wrap backend reads with timeout so slow links degrade quickly.

2) Make auth startup **instant from local session**
- Update `src/contexts/AuthContext.tsx`:
  - Hydrate cached user/session/profile immediately on app boot (before waiting for remote session checks).
  - If network is poor, resolve auth loading immediately from cache (no 5s wait).
  - Keep remote session/profile validation in background; never block first paint on weak links.
  - Prevent weak-network null-session events from wiping already-restored cached auth state.

3) Make library screen **stale-while-revalidate**
- Update `src/pages/ContentListScreen.tsx`:
  - On poor network, load cached library + downloaded flags immediately and render.
  - Run backend refresh only when connection is good (or with strict timeout); otherwise keep local snapshot.
  - Treat poor network same as offline for Store/Updates tab gating to avoid hanging requests.

4) Make downloaded reader flow **fully local-first**
- Update `src/pages/SecureReaderScreen.tsx`:
  - If book is downloaded, open from local metadata/files first, regardless of weak online state.
  - Skip blocking backend access/segment metadata calls on poor connections.
  - Only attempt online validation in background when connection is good.
  - Remove hard `window.location.reload()` after gated download completion; switch to local state re-init to avoid extra network/startup delays.

5) Run permission revocation checks **only on stable network**
- Update `src/hooks/useOfflineAccessSync.ts`:
  - Skip access-revocation sync when connection is poor.
  - Add query timeout and retry-on-next-stable-network behavior.
  - Keep revocation enforcement intact, but only when network quality is good (as requested).

6) Ensure TOC for downloaded books is available **without online reads**
- Update offline metadata pipeline:
  - `src/services/offlineStorage.ts` metadata type to include optional TOC payload.
  - `src/hooks/useOfflineDownload.ts` and `src/hooks/useAutoCache.ts` store TOC in local metadata at download/cache time.
  - `src/pages/SecureReaderScreen.tsx` load TOC from local metadata when reading downloaded content.
- This removes TOC dependency on backend reads for downloaded books.

### Expected behavior after fix
```text
App launch on weak internet
  -> cached session restored immediately
  -> user goes straight to library/dashboard
  -> background validation only if connection improves

Open downloaded publication on weak internet
  -> load local metadata + local segments immediately
  -> no blocking backend fetches
  -> revocation check deferred to stable connection
```

### Technical details
- No database schema/RLS changes needed.
- No auth policy changes needed.
- Main files to update:
  - `src/contexts/AuthContext.tsx`
  - `src/pages/ContentListScreen.tsx`
  - `src/pages/SecureReaderScreen.tsx`
  - `src/hooks/useOfflineAccessSync.ts`
  - `src/hooks/useOfflineDownload.ts`
  - `src/hooks/useAutoCache.ts`
  - `src/services/offlineStorage.ts`
  - new shared network-quality utility file (e.g. `src/lib/networkQuality.ts`)

### Validation checklist I will run after implementation
- Slow network simulation: app should not pause on login for 5s before redirect.
- Launch with cached session + poor network: immediate entry to dashboard/library.
- Open downloaded book on poor network: fast render from local files, no long spinner.
- Verify TOC is visible for downloaded content without requiring network.
- Verify revocation still works when network becomes stable.
