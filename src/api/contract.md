# Carlos Shop API contract

The frontend talks to the backend only through `src/api`. This file is the
contract the backend must implement. It follows the **OpenCart REST API**
collection (storefront) and the Project Management portal's admin API
(`/admin/*`), with the changes listed under *Deviations*.

`src/api/mock/fakeBackend.js` implements this contract in the browser
(`REACT_APP_DATA_SOURCE=mock`), and `src/tests/apiContract.test.js` checks it.
When the backend changes the contract, update all three.

## Conventions

| Item | Rule |
|---|---|
| Base URL | `REACT_APP_API_BASE_URL` (default `/api`). Storefront routes under `/rest`, admin routes under `/admin`. |
| Auth | `Authorization: Bearer <Firebase ID token>` when signed in. The backend verifies it with the Firebase Admin SDK. No static API key. |
| Locale | `X-Oc-Currency` (e.g. `USD`), `X-Oc-Merchant-Language` (e.g. `en-gb`). |
| Envelope | Every response: `{ "success": 1 \| 0, "error": string[], "data": any }`. |
| Errors | HTTP status plus `success: 0`. `error[]` holds **user-facing sentences** (they are shown as-is). A `success: 0` with HTTP 200 is still a failure. Optional `field_errors: { [field]: message }`. |
| Status codes | 400 validation, 401 not signed in, 403 not allowed, 404 not found, 409 conflict, 413 file too large, 5xx server. |
| Pagination | `limit` and 1-based `page`. List responses set `X-Total-Count`. |
| Dates | ISO 8601 UTC strings. |

## Resources

### Product (`/rest/products`)

```json
{
  "product_id": 2,
  "name": "Denim jacket",
  "description": "…",
  "price": 79.0,
  "special": 59.0,            // sale price or null
  "image": "https://…",       // main image
  "images": ["https://…"],
  "category": [{ "category_id": 2, "name": "Men" }],
  "quantity": 25,              // 0 = out of stock
  "rating": 4,
  "reviews": 12,
  "manufacturer": "Brand",
  "options": { "sizes": ["M"], "colors": ["Navy"] },
  "date_added": "2026-09-12T09:00:00Z",
  "date_modified": "2026-09-12T09:00:00Z"
}
```

| Route | Notes |
|---|---|
| `GET /rest/products` | Query: `search`, `category` (includes subcategories), `price_min`, `price_max`, `limit`, `page`. Returns `Product[]` and `X-Total-Count`. |
| `GET /rest/products/{id}` | 404 `"Product not found."` |

### Category (`/rest/categories`)

`{ category_id, name, image, parent_id, categories: Category[] }`

| Route | Notes |
|---|---|
| `GET /rest/categories` | Top-level categories with nested `categories`. |
| `GET /rest/categories/{id}` | One category with its children. |

### Account (`/rest/account`), signed-in user only

`{ customer_id, firstname, lastname, email, role, avatar, status, date_added }`

| Route | Notes |
|---|---|
| `GET /rest/account` | 404 if the user has no profile yet. |
| `POST /rest/account` | Creates the caller's profile: `{ firstname, lastname, avatar }`. Email comes from the token. 409 if it exists. |
| `PUT /rest/account` | Updates `firstname`, `lastname`, `avatar`. Email and password are owned by Firebase Auth. |

### Newsletter

| Route | Notes |
|---|---|
| `PUT /rest/newsletter/subscribe` | Body `{ email }` (guests); signed-in users may omit it. 400 for an invalid email. |

### Admin catalog (role `admin` or `super_admin`)

| Route | Body / notes |
|---|---|
| `POST /admin/products` | `{ name, description, price, special, quantity, category_id, images[], options }`. 400 lists every validation problem. |
| `PUT /admin/products/{id}` | Partial update, same fields. |
| `DELETE /admin/products/{id}` | |
| `POST /admin/categories` | `{ name, image, subcategories: string[] }` |
| `PUT /admin/categories/{id}` | Partial; `subcategories` replaces the children. |
| `DELETE /admin/categories/{id}` | 409 if it or its children still have products. |
| `POST /admin/files` | `multipart/form-data` with `file`. Returns `{ url, filename, size }`. 413 over 5 MB. |

### Admin users (role `admin` or `super_admin`)

| Route | Notes |
|---|---|
| `GET /admin/users` | Optional `email` filter. Returns customers (profile shape above). |
| `POST /admin/users` | `{ firstname, lastname, email, role, avatar }`. 409 on a duplicate email. The frontend then creates the Firebase login and sends the password-setup email. |
| `PUT /admin/users/{id}` | `firstname`, `lastname`, `avatar`, `role`. 403 `"You can’t change your own role."` |

Planned next (phase 2): `PUT /admin/users/{id}/status`, `/admin/roles`,
`/admin/permissions/by-module`, following the portal's admin API.

## Deviations from the OpenCart collection

1. **No `X-Oc-Merchant-Id`.** A key shipped in a browser app is public; the
   Firebase ID token identifies the caller instead.
2. **No `/login`, `/register`, `/logout`, `/forgotten`, `/sociallogin`.**
   Firebase Auth handles credentials in the browser.
3. **`X-Oc-Session` is not used yet.** Guest carts will use a Firebase
   anonymous sign-in (phase 3).
4. **Extensions:** `price_min`/`price_max` on product lists, the
   `X-Total-Count` header, `email` in the newsletter body, `POST /rest/account`,
   `options` on products, and all `/admin/*` routes.
5. The collection documents request bodies but its sample responses are empty
   placeholders; the response shapes above are defined by us.

## How the frontend maps fields

`src/api/remote/mappers.js` converts contract fields to the names screens
already use, e.g. `product_id → id`, `name → title`, `special → specialPrice`
(+ `discountPercentage`), `date_added → creationAt`,
`firstname + lastname → name`.
