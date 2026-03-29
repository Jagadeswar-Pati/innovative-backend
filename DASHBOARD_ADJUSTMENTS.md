# Dashboard manual adjustments (admin)

Admins can add or remove numbers from the dashboard stat boxes (e.g. for manual/offline sales). The displayed values = **real stats + manual adjustments**.

## API (all require admin auth)

- **GET /api/dashboard/adjustments**  
  Returns current adjustment values:  
  `{ manualOrders, manualRevenue, manualProfit, manualCompletedOrders }`

- **PATCH /api/dashboard/adjustments**  
  Set or add to adjustments.

  - **Set** (replace): send `manualOrders`, `manualRevenue`, `manualProfit`, `manualCompletedOrders`.
  - **Add** (delta): send `addOrders`, `addRevenue`, `addProfit`, `addCompletedOrders` (can be negative to subtract).

  Example (add 5 orders and ₹500 revenue):  
  `PATCH /api/dashboard/adjustments`  
  Body: `{ "addOrders": 5, "addRevenue": 500 }`

## Stats response

**GET /api/dashboard/stats** now includes:
- `totalOrders`, `totalRevenue`, `totalDeliveredOrders`, `totalProfit` — already include adjustments.
- `data.adjustments` — current manual values for reference.

## Admin UI: edit icon on each box

1. Each stat box has a **small edit (pencil) icon** in the corner. **Click only the icon** (not the box) to adjust. Clicking the rest of the box keeps your existing behavior (e.g. navigate).  
   Previously: double-click a stat box (Orders, Revenue, Profit, Completed orders).
2. Show a small modal or inline form: “Add/remove amount” with a number input (negative = subtract).
3. On submit, call **PATCH /api/dashboard/adjustments** with the right field:
   - Orders → `addOrders`
   - Revenue → `addRevenue`
   - Profit → `addProfit`
   - Completed orders → `addCompletedOrders`
4. Refresh stats (or refetch `/api/dashboard/stats`) so the box shows the updated value.

Implementation:
- **DashboardStatCard** — full card; small **pencil icon** in corner has its own response (single click = edit). Your **main metric icon** (cart, ₹, etc.) is unchanged — keep it; clicking it or the box still redirects as before.
- **DashboardAdjustIcon** — pencil only; drop inside your existing stat box (e.g. inside a `<Link>`). Single click on **this icon only** opens edit (add/remove, then Submit). Use `className="absolute right-2 top-2"` to place it in the corner. Main icon and rest of box keep redirect.
- Dialog: positive number = add, negative = subtract; **Submit** saves and updates the displayed value.
