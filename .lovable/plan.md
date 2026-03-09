

# Plan: Resizable Chat Sidebar + Admin Pricing Management Tab

## 1. Resizable Chat Sidebar

**File: `src/pages/Chat.tsx`**

Replace the fixed-width sidebar and main chat area with `ResizablePanelGroup` from the existing `react-resizable-panels` library (already used in `src/components/ui/resizable.tsx`).

- Import `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` from `@/components/ui/resizable`
- On desktop: wrap the sidebar and main chat area in a `ResizablePanelGroup` with `direction="horizontal"`
  - Sidebar becomes a `ResizablePanel` with `defaultSize={20}`, `minSize={15}`, `maxSize={35}`
  - Add a `ResizableHandle` with `withHandle` between them
  - Main chat area becomes the second `ResizablePanel` with `defaultSize={80}`
- On mobile: keep the existing overlay sidebar behavior unchanged
- Remove the fixed `w-72` width from the sidebar div (the panel controls width now)

## 2. Admin Pricing Management Tab

**New file: `src/components/Admin/PricingManagement.tsx`**

A super_admin-only tab that allows editing all plan prices. The component will:
- Load pricing config from `app_settings` table (keys like `pricing_pro_1_price`, `pricing_pro_1_original`, `pricing_scholar_1_price`, etc.)
- Display an editable table/form for all 4 Pro tiers and 4 Scholar tiers (price + originalPrice per tier)
- Show calculated quarterly (×3 ×0.9) and yearly (×12 ×0.8) prices as read-only previews
- Save changes via the `admin-operations` edge function using `updateAppSetting` action
- All amounts in Naira (displayed with ₦ prefix)

**File: `src/pages/Admin.tsx`**

- Import `PricingManagement` and add a new `TabsTrigger` (value="pricing") with a `CreditCard` or `Tag` icon, restricted to `isSuperAdmin`
- Add corresponding `TabsContent`

**File: `src/pages/Pricing.tsx`**

- On mount, fetch pricing values from `app_settings` table
- If admin-configured values exist, use them instead of the hardcoded `baseProPlans` / `baseScholarPlans`
- Fallback to current hardcoded values if no DB values found

**Database:** No schema changes needed — reuses existing `app_settings` table with new key-value pairs.

