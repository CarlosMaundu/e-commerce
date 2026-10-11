# Skeleton loaders

While a page waits for its data it shows a skeleton with **the page's own
layout**: the same containers, grids, paddings and heights, with grey shapes
where text, images and buttons will be. When the data arrives nothing moves.

## Building one

Use the pieces in `index.js` inside the same frames the page uses:

| Piece | Mirrors |
| --- | --- |
| `HeaderSkeleton` | `PageHeader` (breadcrumbs, title, subtitle, action buttons) |
| `CardSkeleton` | `SectionCard` (frame, title row); put the card's content inside |
| `TableSkeleton` | a `TablePanel` (tabs, toolbar, real column headings, rows) |
| `LoadingRows` / `SkeletonCells` | rows inside a real table, one shape per column |
| `StatCardsSkeleton` | stat tiles in a grid |
| `DetailSkeleton` | a back-office detail page (wide and narrow column of cards) |
| `ItemRowsSkeleton` | thumbnail + two lines + amount (order items, returns…) |
| `FieldRowsSkeleton` | label / value rows (details, totals) |
| `TimelineSkeleton` | status pill + date + text (order and return updates) |
| `ThreadSkeleton` | a support conversation |
| `FormSkeleton` | settings fields |
| `InvoiceSkeleton` | an invoice document |
| `ProductCardSkeleton` / `ProductGridSkeleton` | product cards and grids |
| `ShopPageSkeleton` | the storefront page frame |

Prefer a skeleton per card (the page frame renders at once, each card fills
in) over one for the whole page. Give whole-page skeletons
`data-testid="page-loading"` and `aria-busy="true"`.

## Checked for every page

`src/tests/skeletons.test.js` fails when a page in `src/pages` loads data in
an effect but shows no skeleton, or when a page waits behind one big grey
block (a rounded `Skeleton` 200px or taller). Dialogs and action helpers
load on demand and are skipped; a page that genuinely needs none says why on
a `// skeleton-exempt: <reason>` line.
