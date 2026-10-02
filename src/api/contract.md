# Carlos Shop API contract

The frontend talks to the backend only through `src/api`. The backend in
`backend/` implements this contract; its integration tests
(`backend/tests/`) check it. Storefront routes follow the **OpenCart REST
API** collection; admin routes follow the Project Management portal's admin
API. Deviations are listed at the end. Update this file, the backend and its
tests together.

## Conventions

| Item          | Rule                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL      | `REACT_APP_API_BASE_URL` (default `/api`, same origin). Storefront under `/rest`, admin under `/admin`.                                                                         |
| Access token  | Returned by sign-in, register and refresh as `access_token` (JWT, 15 min). Sent as `Authorization: Bearer …`. The browser keeps it **in memory only**.                          |
| Refresh token | httpOnly cookie `cs_refresh`, `Path=/api/rest`, `SameSite=Lax`, `Secure` in production. Rotated on every refresh.                                                               |
| CSRF          | Cookie-authenticated routes (`/rest/refresh`, `/rest/logout`) require `X-Requested-With: XMLHttpRequest`. CORS only allows configured origins.                                  |
| Sessions      | Each sign-in creates a session row. Access tokens carry its id, so logout, password changes and suspension take effect immediately.                                             |
| Locale        | `X-Oc-Currency` (e.g. `USD`), `X-Oc-Merchant-Language` (e.g. `en-gb`).                                                                                                          |
| Envelope      | Every response: `{ "success": 1 \| 0, "error": string[], "data": any }`.                                                                                                        |
| Errors        | HTTP status plus `success: 0`. `error[]` holds **user-facing sentences** shown as-is; `field_errors: { [field]: message }` for forms.                                           |
| Status codes  | 400 validation, 401 not signed in / session ended, 403 not allowed / suspended, 404, 409 conflict, 413 file too large, 423 locked after failed sign-ins, 429 rate limited, 5xx. |
| Pagination    | `limit` and 1-based `page`; lists set `X-Total-Count`.                                                                                                                          |
| Dates         | ISO 8601 UTC.                                                                                                                                                                   |

## Sign-in and sessions (`/rest`)

| Route                             | Body                                       | Notes                                                                                                                                                  |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /rest/register`             | `{ firstname, lastname, email, password }` | 201 → session payload. 409 if the email exists. Password: 8+ chars, upper, lower, number or symbol.                                                    |
| `POST /rest/login`                | `{ email, password, remember_me? }`        | Session payload. Same 401 for unknown email and wrong password. 5 failures → 423 for 15 minutes.                                                       |
| `POST /rest/sociallogin`          | `{ provider: "google", id_token }`         | ID token from Google Identity Services, verified server-side. Creates a customer, or links Google to an existing account with the same verified email. |
| `POST /rest/refresh`              | — (cookie)                                 | New session payload, rotated cookie. 401 when signed out.                                                                                              |
| `POST /rest/logout`               | — (cookie)                                 | Revokes the session, clears the cookie.                                                                                                                |
| `POST /rest/forgotten`            | `{ email }`                                | Always `{ sent: true }`; emails a reset link if the account exists.                                                                                    |
| `GET /rest/reset-password?token=` | —                                          | `{ valid, purpose: "reset" \| "setup", email }` or 400.                                                                                                |
| `POST /rest/reset-password`       | `{ token, password }`                      | Single use. Signs out all sessions. Also used for first-time setup links.                                                                              |

Session payload: `{ access_token, expires_in, user }` where `user` is the
account shape below with `permissions`.

## Account (`/rest/account`), signed-in user

`{ customer_id, firstname, lastname, email, role, permissions[], avatar, status, has_password, date_added }`

| Route                        | Notes                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET /rest/account`          | Current user with permissions.                                                                                                  |
| `PUT /rest/account`          | `firstname`, `lastname`, `avatar`. Email is fixed.                                                                              |
| `PUT /rest/account/password` | `{ current_password, password }`. Signs out other devices. Google-only accounts get 400 with guidance to use "Forgot password". |

## Catalog

Product:

```json
{
  "product_id": 2,
  "name": "Denim jacket",
  "description": "…",
  "price": 79.0,
  "special": 59.0,
  "image": "/uploads/x.png",
  "images": ["/uploads/x.png"],
  "category": [{ "category_id": 2, "name": "Men" }],
  "quantity": 25,
  "rating": 4,
  "reviews": 12,
  "manufacturer": "Brand",
  "options": { "sizes": ["M"], "colors": ["Navy"] },
  "date_added": "…",
  "date_modified": "…"
}
```

| Route                            | Notes                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /rest/products`             | `search`, `category` (includes subcategories), `price_min`, `price_max` (sale price counts), `limit`, `page`. |
| `GET /rest/products/{id}`        | 404 `"Product not found."`                                                                                    |
| `GET /rest/categories`           | Tree: `{ category_id, name, image, parent_id, categories[] }`.                                                |
| `GET /rest/categories/{id}`      | One category with children.                                                                                   |
| `PUT /rest/newsletter/subscribe` | `{ email }`; signed-in users may omit it.                                                                     |

## Cart, wishlist and coupons (`/rest`), signed-in user

Guests keep a cart and wishlist in the browser; on sign-in the frontend merges
them into the account with `cart_bulk` and `POST /wishlist/{id}`.

Cart: `{ products: [{ key, product_id, name, image, quantity, price, special, unit_price, total, options, stock, in_stock }], coupon, coupon_problem, totals: [{ code, title, value }], total, item_count }`.

| Route                                                    | Notes                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /rest/cart`                                         | Totals: subtotal, coupon, tax. Delivery is added at checkout.                                  |
| `POST /rest/cart`                                        | `{ product_id, quantity, option }`. Same product and options → quantities add up.              |
| `POST /rest/cart_bulk`                                   | `[{ product_id, quantity, option }]`; used for the sign-in merge.                              |
| `PUT /rest/cart`                                         | `{ key, quantity }`. Stock is checked.                                                         |
| `DELETE /rest/cart/{key}`                                |                                                                                                |
| `DELETE /rest/cart/empty`                                |                                                                                                |
| `POST /rest/coupon`                                      | `{ coupon }`, case-insensitive. Unknown, expired, used up or below the minimum → 400 with why. |
| `DELETE /rest/coupon`                                    |                                                                                                |
| `GET /rest/wishlist`                                     | Products.                                                                                      |
| `POST /rest/wishlist/{id}`, `DELETE /rest/wishlist/{id}` |                                                                                                |

## Checkout (`/rest`), signed-in user

Steps as in OpenCart: address → shipping method → payment method → confirm.

| Route                                                               | Notes                                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET/POST /rest/account/address`, `GET/PUT/DELETE …/{id}`           | Address book: `{ address_id, firstname, lastname, company, address_1, address_2, city, zone, postcode, country, telephone, default }`.                  |
| `GET/POST /rest/shippingaddress`, `POST …/shippingaddress/existing` | Set a new or saved (`{ address_id }`) delivery address. Same for `paymentaddress`.                                                                           |
| `GET/POST /rest/shippingmethods`                                    | `standard` ($10, free over $150) and `express` ($25). Body `{ shipping_method }`.                                                                            |
| `GET/POST /rest/paymentmethods`                                     | `cod`, and `stripe` when a Stripe key is configured. Body `{ payment_method, agree: 1, comment }`.                                                           |
| `POST /rest/confirm`                                                | Review: lines, totals, addresses. Creates an unplaced order; for Stripe also a PaymentIntent (`client_secret`).                                              |
| `PUT /rest/confirm`                                                 | Places the order: verifies the Stripe payment server-side, reserves stock, counts the coupon use, clears the cart, emails a confirmation. Returns the order. |

## Orders and returns (`/rest`), signed-in user

Statuses: `awaiting_payment`, `pending`, `processing`, `shipped`, `delivered`,
`cancelled`, `refunded`.

| Route                                         | Notes                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /rest/order_statuses`                    | `{ code, name }[]`                                                                          |
| `GET /rest/return_reasons`                    | `{ code, name }[]`                                                                          |
| `GET /rest/customerorders`                    | Own orders, newest first; `status`, `limit`, `page`.                                        |
| `GET /rest/customerorders/{id}`               | Lines, totals, address snapshot, history, returns.                                          |
| `POST /rest/customerorders/{id}/reorder`      | Adds the lines still in stock to the cart → `{ cart, skipped }`.                            |
| `GET /rest/returns`, `GET /rest/returns/{id}` | Own returns.                                                                                |
| `POST /rest/returns`                          | `{ order_id, order_product_id, quantity, reason, opened, comment }`. Delivered orders only. |

## Admin (`/admin`), by permission

Permission codes: `module.resource.action`; `*` = everything. Roles:
`super_admin` (`*`), `admin` (all but `admin.roles.manage`), `catalog_manager`
(`catalog.*`), `order_manager` (`orders.*`), `support`
(`admin.users.view`, `orders.orders.view`), `customer` (none).

| Route                                   | Permission                   | Notes                                                                                                                                                                                    |
| --------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /admin/products`                  | `catalog.products.create`    | All validation problems reported at once. `special` must be below `price`. Images: `/uploads/…` or https links, max 6.                                                                   |
| `PUT /admin/products/{id}`              | `catalog.products.update`    | Partial.                                                                                                                                                                                 |
| `DELETE /admin/products/{id}`           | `catalog.products.delete`    |                                                                                                                                                                                          |
| `POST /admin/categories`                | `catalog.categories.create`  | `{ name, image, subcategories: string[] }`                                                                                                                                               |
| `PUT /admin/categories/{id}`            | `catalog.categories.update`  | Removing a subcategory that has products → 409.                                                                                                                                          |
| `DELETE /admin/categories/{id}`         | `catalog.categories.delete`  | 409 if it or its children have products.                                                                                                                                                 |
| `POST /admin/files`                     | `catalog.files.upload`       | multipart `file`; JPG/PNG/WebP/GIF ≤ 5 MB → `{ url: "/uploads/…" }`.                                                                                                                     |
| `GET /admin/roles`                      | `admin.users.view`           | `{ code, name, description, is_system, user_count }[]`                                                                                                                                   |
| `GET /admin/users`                      | `admin.users.view`           | `email`, `search`, `limit`, `page`.                                                                                                                                                      |
| `POST /admin/users`                     | `admin.users.create`         | `{ firstname, lastname, email, role, avatar }`. Emails a setup link. Only super admins create super admins.                                                                              |
| `PUT /admin/users/{id}`                 | `admin.users.update`         | `firstname`, `lastname`, `avatar`, `role`, `status` (`active` \| `suspended`). No changing your own role or status; only super admins touch super admins; suspension signs the user out. |
| `POST /admin/users/{id}/reset-password` | `admin.users.reset_password` | Emails a reset link, or a setup link if the user has no password.                                                                                                                        |
| `GET /admin/permissions`                | `admin.users.view`           | Grouped by module: `{ module, name, permissions: [{ code, description }] }[]`.                                                                                                           |
| `GET /admin/roles/{code}`               | `admin.users.view`           | Role with `permissions[]`.                                                                                                                                                               |
| `POST /admin/roles`                     | `admin.roles.manage`         | `{ name, description, permissions[] }`. You can only grant permissions you have.                                                                                                         |
| `PUT /admin/roles/{code}`               | `admin.roles.manage`         | Built-in roles can't be edited.                                                                                                                                                          |
| `POST /admin/roles/{code}/duplicate`    | `admin.roles.manage`         | `{ name }`.                                                                                                                                                                              |
| `DELETE /admin/roles/{code}`            | `admin.roles.manage`         | Built-in roles, and roles anyone still has, can't be deleted.                                                                                                                            |
| `GET /admin/orders`                     | `orders.orders.view`         | `status`, `search` (order number, email or name), `limit`, `page`.                                                                                                                       |
| `GET /admin/orders/{id}`                | `orders.orders.view`         | As the customer view, plus `next_statuses`.                                                                                                                                              |
| `PUT /admin/orderhistory/{id}`          | `orders.orders.update`       | `{ status, comment, notify }`. Only valid next steps; cancelling restocks; refunding refunds through Stripe; cash orders are marked paid on delivery.                                    |
| `GET /admin/returns`                    | `orders.orders.view`         | `status`.                                                                                                                                                                                |
| `PUT /admin/returns/{id}`               | `orders.returns.update`      | `{ status }`: requested → approved/rejected, approved → refunded.                                                                                                                        |
| `GET /admin/dashboard`                  | `orders.orders.view`         | Today's figures, month revenue vs last month, 30-day revenue series, attention counts, top products.                                                                                     |

All admin writes are recorded in `audit_logs`.

## Deviations from the OpenCart collection

1. **No `X-Oc-Merchant-Id` key.** A key in a browser app is public; signed-in
   users send their access token instead.
2. **`/rest/sociallogin` takes a Google ID token** (`id_token`), not a
   provider access token, and only Google is supported.
3. **Extensions:** `/rest/refresh`, `GET`/`POST /rest/reset-password`,
   `current_password` on password change, `price_min`/`price_max`,
   `X-Total-Count`, `email` in the newsletter body, product `options`, and
   all `/admin/*` routes.
4. **No `X-Oc-Session`.** Guest carts stay in the browser and are merged
   into the account with `cart_bulk` on sign-in; checkout needs an account.
5. The collection's sample responses are empty; the shapes above are ours.

## Field mapping in the frontend

`src/api/mappers.js` converts to the names screens use: `product_id → id`,
`name → title`, `special → specialPrice` (+ `discountPercentage`),
`date_added → creationAt`, `firstname + lastname → name`,
`has_password → hasPassword`. Cart, address, order and return shapes are
mapped by `cartFromApi`, `addressFromApi`, `orderFromApi` and `returnFromApi`.
