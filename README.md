# ORÈVA — Private Admin Panel

A private, admin-only control center for the ORÈVA store, built as plain
HTML/CSS/JS (no build step, no React) so it's easy to edit and deploy from
Android. It shares the same Firebase project and Cloudinary preset as the
customer storefront, but is a completely separate deployment/repository.

## What's included

```
index.html          Login screen (admin-only)
dashboard.html       Overview cards + recent orders
products.html        Product CRUD + Cloudinary image upload (1–5 images)
orders.html           Order list, detail view, status/courier/tracking, cancel
settings.html         settings/store document editor
css/style.css         Full design system (paper/ink/moss/brass palette)
js/firebase-config.js Firebase + Cloudinary config (exact values from spec)
js/app.js              Shared shell: sidebar nav, auth guard, toasts, formatters
js/cloudinary.js       Unsigned image upload helper
js/login.js, dashboard.js, products.js, orders.js, settings.js
firestore.rules         Proposed security rules (see note below)
assets/                 Drop logo.png and bg.png here (see assets/README.txt)
```

## Before you deploy

1. **Add the real assets.** `logo.png` and `bg.png` weren't in the files
   supplied for this build. Drop them into `/assets` using those exact
   names — the UI already falls back gracefully until you do, per the
   spec (no invented logo, no broken-image icon).

2. **Create the admin's Firebase Auth account**, if it doesn't already
   exist, for `mallikabdurrahman37@gmail.com` (Firebase Console →
   Authentication → Add user). This panel only supports email/password
   sign-in for that single address — no Google/anonymous sign-in here,
   since this is a private door, not the public storefront.

3. **Review `firestore.rules` against what's actually live.** The
   database.zip screenshots used to build this didn't include the Rules
   tab, so I couldn't read and preserve your exact current rule text for
   `projects`, `users`, and `visitor_ids` verbatim as the spec asked.
   The rules file here is a safe, conservative baseline consistent with
   the spec's description of that behaviour — merge it with your console
   rules rather than overwriting blindly, then publish.

4. **Deploy** this folder as its own static site (Firebase Hosting, or
   any static host) under its own private URL — don't link it from the
   customer storefront's navigation.

## Notes on the data model

Every field name and type here matches the schema shown in the supplied
Firestore screenshots exactly — nothing was renamed or retyped:

- `products`: name, description, category, price, compareAtPrice, images[],
  featured, bestSeller, stock, sizes[], isActive, createdAt, shippingCharge
  (product-specific; 0 = free shipping, overrides the store default).
- `orders`: userId, customer info, shippingAddress (map), items[], subtotal,
  shippingCharge, totalAmount, paymentMethod (COD only), orderStatus,
  orderDate, expectedDelivery, courierService, trackingId, delayNote,
  cancelled.
- `settings/store`: the single fixed settings document — the app always
  writes to this exact path with `merge: true` so it can never create a
  duplicate settings document.

`items` in the sample order screenshot appeared as a flattened, informally
seeded array rather than a clean array of maps. The admin UI reads/writes
`items` as an array of `{ productId, name, price, quantity, image }` maps,
since that's the structure the field names imply — adjust `orders.js` if
your actual production writes use a different shape.

## Order lifecycle

`Placed → Confirmed → Processing → Shipped → Out for Delivery → Delivered`,
with `Cancelled` as a separate terminal state. The admin panel only allows
cancellation while the order is still pre-shipment, and re-checks the live
order status at the moment of cancellation (not just what was on screen) so
a stale view can't cancel an already-shipped order. Courier and tracking
fields are meant to be filled in when moving an order to **Shipped** — the
storefront should only reveal them from that point on.

## Return/refund policy

Intentionally not built — the spec says this isn't finalized yet. Nothing
in this panel promises returns/refunds/exchanges.
