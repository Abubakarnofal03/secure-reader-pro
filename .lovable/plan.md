
# Premium Minimalist Header Redesign

## Current Issues
- Old "Medical Reference Library" branding with medical caduceus icon
- Cluttered header with too many visual elements
- Theme toggle has visible borders and looks boxy
- Tab navigation uses icons + uppercase text (too heavy)
- Overall feels "designed by committee" rather than refined

## Design Philosophy
Inspired by the Calorics logo:
- Ultra-clean, minimal UI with generous whitespace
- Subtle, invisible-until-needed interactions
- Single brand mark (the logo) as the focal point
- Text-only tabs with elegant underline animation
- Hidden complexity (profile/settings tucked away)

---

## New Header Structure

```text
┌─────────────────────────────────────────────────┐
│  [Logo Image]  Calorics              [●] [○]   │
│                                                 │
│     Library        Store                        │
│     ────────                                    │
└─────────────────────────────────────────────────┘
```

### Key Changes

| Element | Before | After |
|---------|--------|-------|
| Title | Two-line uppercase "MEDICAL REFERENCE LIBRARY" | Single line "Calorics" in clean Inter font |
| Brand Icon | Custom caduceus SVG | Actual logo image |
| Theme Toggle | Bordered button with visible box | Minimal icon-only, no background |
| Profile Button | Visible bordered box | Small circular avatar or subtle icon |
| Tabs | Icons + uppercase labels | Lowercase text with thin underline |
| Tab Indicator | Thick 2px bar | Delicate 1px line |
| Spacing | Dense 5px padding | Airy 16-20px breathing room |

---

## Technical Implementation

### 1. Update Header Section
- Replace medical title with "Calorics" brand name
- Import and display the logo image (already at `src/assets/logo.png`)
- Reduce header padding and use subtle bottom shadow instead of border

### 2. Refine ThemeToggle Component
- Remove border and background
- Use smaller icons (h-4 w-4)
- Ghost hover state only
- Reduce button size to h-8 w-8

### 3. Redesign Tab Navigation
- Remove icons from tabs
- Use sentence case or lowercase
- Thinner underline (1px instead of 2px/0.5rem)
- Remove the outer border-b, use only the active indicator

### 4. Profile Button
- Smaller, more subtle
- Consider using user's first initial or avatar
- Ghost style matching theme toggle

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ContentListScreen.tsx` | Rebuild header section with logo, new title, refined tabs |
| `src/components/ThemeToggle.tsx` | Remove borders/background, reduce size |

---

## Visual Result

The new header will feel:
- Calm and professional
- Aligned with the Calorics brand identity
- Like a premium health/wellness app (think Headspace, Calm, or premium food tracking apps)
- Uncluttered with clear hierarchy
- Effortlessly modern without trying too hard
