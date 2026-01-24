
# Fix Pinch Zoom + Scroll Conflict on Mobile

## Problem Summary

When you pinch to zoom (browser-level zoom) on the PDF reader:
- Sometimes zoom works but scroll doesn't work afterward
- Other times scroll works but zoom stops working

This creates an inconsistent user experience on iOS and Android.

## Root Cause

**Multiple conflicting touch-action CSS properties**:

1. **Watermark component** (`src/components/Watermark.tsx` line 40):
   ```css
   touchAction: 'none'
   ```
   This blocks ALL touch gestures on the overlay, including pinch-zoom and panning.

2. **Scroll container** (`src/pages/SecureReaderScreen.tsx` line 715):
   ```css
   touchAction: 'pan-x pan-y pinch-zoom'
   ```
   This should allow gestures but gets overridden by the watermark layer above it.

3. **Layer stacking issue**: The watermark sits on top (z-index: 100) and intercepts touch events before they reach the scroll container.

4. **Missing viewport configuration**: The viewport meta tag doesn't explicitly enable user scaling, which some mobile browsers require.

---

## Solution

### Step 1: Fix Watermark Touch Handling

Update the Watermark component to allow touch gestures to pass through while still blocking visual selection.

**File: `src/components/Watermark.tsx`**

Change `touchAction: 'none'` to `touchAction: 'auto'`:

```typescript
style={{ 
  zIndex: 100,
  touchAction: 'auto',        // ← Allow gestures to pass through
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
}}
```

Why this works:
- `pointer-events: none` (in className) already prevents the watermark from receiving click/touch events
- `touchAction: 'auto'` allows the browser to handle gestures normally
- The security properties (userSelect, WebkitTouchCallout) are preserved for preventing copying

### Step 2: Configure Viewport for Mobile Zoom

Update the viewport meta tag to explicitly allow user scaling on mobile.

**File: `index.html`**

```html
<meta 
  name="viewport" 
  content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" 
/>
```

- `maximum-scale=5.0`: Allows up to 5x zoom (adjustable based on preference)
- `user-scalable=yes`: Explicitly enables pinch-to-zoom

### Step 3: Simplify Scroll Container CSS

Remove conflicting touch-action properties and let the browser handle gestures naturally.

**File: `src/pages/SecureReaderScreen.tsx`**

Update the scroll container (around line 709-716):

```typescript
<div 
  ref={scrollContainerRef}
  className="h-full overflow-x-auto overflow-y-auto overscroll-none"
  style={{
    WebkitOverflowScrolling: 'touch',
    // Let browser handle all touch gestures naturally
    touchAction: 'auto',
  }}
>
```

Using `touchAction: 'auto'` instead of `pan-x pan-y pinch-zoom`:
- Removes any custom gesture restrictions
- Browser handles pinch-zoom natively
- Scroll/pan works automatically after zoom
- No conflicts between different gesture types

---

## Technical Explanation

### How Mobile Touch Gestures Work

```
                     User touches screen
                            │
                            ▼
           ┌────────────────────────────────┐
           │  Browser checks touchAction    │
           │  on touched element + parents  │
           └────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
   touchAction: 'none'                 touchAction: 'auto'
   ─────────────────                   ─────────────────
   Block ALL gestures                  Allow ALL gestures
   (no zoom, no scroll)                (zoom + scroll work)
```

The watermark with `touchAction: 'none'` was sitting on top (z-index: 100) and blocking all gestures even though it had `pointer-events: none`. This is because `touchAction` is evaluated independently from pointer events.

### Why pointer-events: none isn't enough

- `pointer-events: none`: Prevents click/tap events, mouse events
- `touchAction`: Controls gesture behavior (scroll, zoom, pan)

These are separate browser behaviors. You can have `pointer-events: none` but still have `touchAction: none` block gestures.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Watermark.tsx` | Change `touchAction: 'none'` to `touchAction: 'auto'` |
| `index.html` | Add `maximum-scale=5.0, user-scalable=yes` to viewport |
| `src/pages/SecureReaderScreen.tsx` | Simplify touchAction to `'auto'` |

---

## Expected Behavior After Fix

| Action | Before | After |
|--------|--------|-------|
| Pinch to zoom | Sometimes works, sometimes blocked | Always works |
| One-finger scroll after zoom | Often blocked | Always works |
| Pan in all directions when zoomed | Hit or miss | Works naturally |
| Security (watermark, copy protection) | Protected | Still protected |

---

## Testing Checklist

After implementation, test on:
- [ ] iOS Safari (physical iPhone/iPad)
- [ ] Android Chrome (physical device)
- [ ] iOS app build (if using Capacitor)
- [ ] Android app build (if using Capacitor)

Test scenarios:
1. Pinch to zoom in on a PDF page
2. While zoomed, scroll up/down
3. While zoomed, scroll left/right (pan)
4. Pinch to zoom out
5. Verify watermark is still visible and text is still non-selectable
