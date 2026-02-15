
# Add PowerPoint Generator Feature Flag and Improve Overlay Readability

## 1. PowerPoint Generator Feature Flag

### Admin Settings (`src/components/Admin/AppSettings.tsx`)
- Add `feature_powerpoint_generator_enabled: "true"` to the `defaultSettings` object
- Add a new toggle switch row for "PowerPoint Generator" in the Feature Flags card

### Route Gating (`src/App.tsx`)
- Wrap the `/documents` route with `<FeatureGate feature="powerpoint_generator">` (line 71)

## 2. Improve Background Readability on Overlays

### FeatureGate (`src/components/FeatureGate.tsx`)
- Change the background children wrapper from `opacity-50 blur-[2px]` to `opacity-30 blur-[1px]` -- making it dimmer so the modal stands out more clearly
- Reduce the backdrop from `bg-background/60 backdrop-blur-sm` to `bg-background/80` -- a more opaque, less blurry backdrop so the modal text is crisp against it
- Add a "Back to Dashboard" button (a `Link` to `/dashboard`) inside the modal card

### MaintenanceBanner (`src/components/MaintenanceBanner.tsx`)
- Apply the same readability improvements to the maintenance overlay: use `bg-background/80` instead of `bg-background/60 backdrop-blur-sm`
- Add a "Back to Dashboard" button (a `Link` to `/dashboard`) inside the maintenance modal card

## 3. Files to Modify

| File | Changes |
|------|---------|
| `src/components/Admin/AppSettings.tsx` | Add `feature_powerpoint_generator_enabled` default + toggle UI |
| `src/App.tsx` | Wrap `/documents` route with `FeatureGate feature="powerpoint_generator"` |
| `src/components/FeatureGate.tsx` | Improve background readability; add "Back to Dashboard" button |
| `src/components/MaintenanceBanner.tsx` | Improve background readability; add "Back to Dashboard" button |
