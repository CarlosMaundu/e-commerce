// src/api/mappers.js
//
// Translate between the API contract (OpenCart field names, see
// src/api/contract.md) and the shapes the screens already use (the "domain"
// model: { id, title, price, images, category, creationAt, ... }).

const toNumber = (value) =>
  value === null || value === undefined || value === '' ? null : Number(value);

// ---------- Categories ----------

export const categoryFromApi = (c) =>
  c && {
    id: c.category_id,
    name: c.name,
    image: c.image || '',
    productCount: c.product_count || 0,
    subcategories: (c.categories || []).map(categoryFromApi),
  };

export const categoryToApi = ({ name, image, subcategories } = {}) => {
  const body = {};
  if (name !== undefined) body.name = name.trim();
  if (image !== undefined) body.image = image;
  if (subcategories !== undefined) {
    body.subcategories = subcategories
      .map((s) => (typeof s === 'string' ? s : s?.name))
      .filter((s) => s && s.trim());
  }
  return body;
};

// ---------- Products ----------

const variantFromApi = (v, product) => {
  const price = toNumber(v.price) ?? product.price;
  const special = toNumber(v.special);
  const onSale = special !== null && special < price;
  return {
    id: v.variant_id,
    options: v.options || {},
    sku: v.sku || '',
    price,
    specialPrice: onSale ? special : null,
    unitPrice: onSale ? special : price,
    ownPrice: Boolean(v.own_price),
    quantity: toNumber(v.quantity) ?? 0,
    inStock: v.in_stock !== false,
    images: v.images || [],
    description: v.description || '',
    specs: v.specs || [],
  };
};

export const productFromApi = (p) => {
  if (!p) return p;
  const price = toNumber(p.price) ?? 0;
  const special = toNumber(p.special);
  const onSale = special !== null && special < price;
  const images = (p.images && p.images.length ? p.images : [p.image]).filter(
    Boolean
  );
  const firstCategory = Array.isArray(p.category) ? p.category[0] : p.category;
  const quantity = toNumber(p.quantity);
  const base = { price };
  const variants = (p.variants || []).map((v) => variantFromApi(v, base));
  const unitPrices = variants.length
    ? variants.map((v) => v.unitPrice)
    : [onSale ? special : price];

  return {
    id: p.product_id,
    title: p.name,
    description: p.description || '',
    price,
    specialPrice: onSale ? special : null,
    discountPercentage: onSale
      ? Math.round(((price - special) / price) * 100)
      : 0,
    // Lowest and highest price a shopper can pay (variants may differ).
    minPrice: Math.min(...unitPrices),
    maxPrice: Math.max(...unitPrices),
    images,
    category: firstCategory
      ? {
          id: firstCategory.category_id,
          name: firstCategory.name,
          image: firstCategory.image || '',
        }
      : null,
    brand: p.brand
      ? { id: p.brand.brand_id, name: p.brand.name, logo: p.brand.logo || '' }
      : null,
    sku: p.sku || '',
    manufacturer: p.manufacturer || '',
    barcode: p.barcode
      ? { type: p.barcode.type || '', value: p.barcode.value || '' }
      : null,
    mfrPartNumber: p.mfr_part_number || '',
    dimensions: p.dimensions || null,
    weight: p.weight || null,
    specs: p.specs || [],
    variantContent: Boolean(p.variant_content),
    status: p.status || 'published',
    publishedAt: p.published_at || null,
    featured: Boolean(p.featured),
    tags: p.tags || [],
    attributes: p.attributes || [],
    variants,
    hasOptions: (p.attributes || []).length > 0,
    quantity,
    trackInventory: p.track_inventory !== false,
    lowStockThreshold: toNumber(p.low_stock_threshold) ?? 5,
    inStock: p.in_stock !== undefined ? p.in_stock : (quantity ?? 1) > 0,
    lowStock: Boolean(p.low_stock),
    rating: toNumber(p.rating) ?? 0,
    reviewCount: toNumber(p.reviews) ?? 0,
    creationAt: p.date_added,
    updatedAt: p.date_modified,
  };
};

const money = (v) =>
  v === '' || v === null || v === undefined ? null : Number(v);

/** Admin product form → contract (every field is sent; the form is complete). */
export const productToApi = (f) => ({
  name: f.title.trim(),
  description: f.description || '',
  price: Number(f.price),
  special: money(f.specialPrice),
  quantity: Number(f.quantity) || 0,
  category_id: f.categoryId || null,
  brand_id: f.brandId || null,
  images: f.images || [],
  sku: f.sku?.trim() || null,
  status: f.status || 'published',
  featured: Boolean(f.featured),
  tags: f.tags || [],
  attributes: (f.attributes || [])
    .filter((a) => a.name.trim() && a.values.length)
    .map((a) => ({ name: a.name.trim(), values: a.values })),
  variants: (f.variants || []).map((v) => ({
    options: v.options,
    sku: v.sku?.trim() || null,
    price: money(v.price),
    special: money(v.specialPrice),
    quantity: Number(v.quantity) || 0,
    images: v.images || [],
    description: f.variantContent ? v.description || null : null,
    specs: f.variantContent
      ? (v.specs || [])
          .map((x) => ({ label: x.label.trim(), value: x.value.trim() }))
          .filter((x) => x.label && x.value)
      : [],
  })),
  variant_content: Boolean(f.variantContent),
  track_inventory: f.trackInventory !== false,
  manufacturer: f.manufacturer?.trim() || '',
  barcode_type: f.barcode?.trim() ? f.barcodeType || '' : '',
  barcode: f.barcode?.trim() || '',
  mfr_part_number: f.mfrPartNumber?.trim() || '',
  length: money(f.length),
  width: money(f.width),
  height: money(f.height),
  dimension_unit: f.dimensionUnit || 'cm',
  weight: money(f.weight),
  weight_unit: f.weightUnit || 'kg',
  specs: (f.specs || [])
    .map((x) => ({ label: x.label.trim(), value: x.value.trim() }))
    .filter((x) => x.label && x.value),
  low_stock_threshold: Number(f.lowStockThreshold) || 0,
});

/**
 * Domain list filters → query string. Filters:
 * { search, categoryId, brandIds[], priceMin, priceMax, rating, inStock,
 *   onSale, featured, tag, attrs: { Color: ['Black'] }, sort, page, limit,
 *   status, stock } (status/stock are admin-only).
 */
export const productQueryToApi = (f = {}) => {
  const q = {};
  if (f.search) q.search = f.search;
  if (f.categoryIds?.length) q.category = f.categoryIds.join(',');
  else if (f.categoryId) q.category = f.categoryId;
  if (f.brandIds?.length) q.brand = f.brandIds.join(',');
  if (f.priceMin !== undefined && f.priceMin !== '') q.price_min = f.priceMin;
  if (f.priceMax !== undefined && f.priceMax !== '') q.price_max = f.priceMax;
  if (f.rating) q.rating = f.rating;
  if (f.inStock) q.in_stock = 1;
  if (f.onSale) q.on_sale = 1;
  if (f.featured) q.featured = 1;
  if (f.tags?.length) q.tag = f.tags.join(',');
  else if (f.tag) q.tag = f.tag;
  Object.entries(f.attrs || {}).forEach(([name, values]) => {
    if (values?.length) q[`attr[${name}]`] = values.join(',');
  });
  if (f.sort) q.sort = f.sort;
  if (f.status) q.status = f.status;
  if (f.stock) q.stock = f.stock;
  if (f.limit) {
    q.limit = f.limit;
    q.page = f.page || 1;
  }
  return q;
};

export const brandFromApi = (b) => ({
  id: b.brand_id ?? b.manufacturer_id,
  name: b.name,
  logo: b.logo ?? b.image ?? '',
  productCount: b.product_count ?? b.count ?? 0,
});

export const reviewFromApi = (r) => ({
  id: r.review_id,
  author: r.author,
  rating: r.rating,
  title: r.title || '',
  text: r.text,
  verified: Boolean(r.verified),
  createdAt: r.date_added,
});

export const promotionFromApi = (p) => ({
  id: p.promotion_id,
  title: p.title,
  subtitle: p.subtitle || '',
  code: p.code || null,
  link: p.link || '/products',
  image: p.image || '',
  endsAt: p.ends_at,
  daily: Boolean(p.daily),
});

export const sessionFromApi = (s) => ({
  id: s.session_id,
  device: s.device,
  browser: s.browser,
  os: s.os || '',
  ip: s.ip_address,
  createdAt: s.created_at,
  lastActive: s.last_active,
  expiresAt: s.expires_at,
  current: Boolean(s.current),
  impersonatedBy: s.impersonated_by || null,
  staff: s.staff,
  user: s.user
    ? {
        id: s.user.customer_id,
        name: s.user.name,
        email: s.user.email,
        role: s.user.role,
      }
    : null,
});

export const activityFromApi = (a) => ({
  id: a.activity_id,
  action: a.action,
  description: a.description,
  target: a.target,
  details: a.details || {},
  ip: a.ip_address,
  createdAt: a.date_added,
  user: a.user
    ? { id: a.user.customer_id, name: a.user.name, email: a.user.email }
    : null,
  impersonatedBy: a.impersonated_by || null,
});

// ---------- Users / account ----------

const splitName = (name = '') => {
  const [firstname = '', ...rest] = name.trim().split(/\s+/);
  return { firstname, lastname: rest.join(' ') };
};

export const userFromApi = (u) =>
  u && {
    id: u.customer_id,
    name: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email,
    firstName: u.firstname || '',
    lastName: u.lastname || '',
    phone: u.telephone || '',
    email: u.email,
    role: u.role || 'customer',
    permissions: u.permissions || [],
    avatar: u.avatar || '',
    status: u.status || 'active',
    hasPassword: u.has_password !== false,
    lockedUntil: u.locked_until || null,
    lastLogin: u.last_login || null,
    impersonator: u.impersonator
      ? {
          id: u.impersonator.customer_id,
          name: u.impersonator.name,
          email: u.impersonator.email,
        }
      : null,
    creationAt: u.date_added,
  };

export const userToApi = ({ name, email, role, avatar } = {}) => {
  const body = {};
  if (name !== undefined) Object.assign(body, splitName(name));
  if (email !== undefined) body.email = email.trim().toLowerCase();
  if (role !== undefined) body.role = role;
  if (avatar !== undefined) body.avatar = avatar;
  return body;
};

// ---------- Cart ----------

/** A line sent as a gift (cart or order); staff also get done/doneAt/doneBy. */
export const giftFromApi = (g) =>
  g
    ? {
        to: g.to,
        from: g.from,
        message: g.message || '',
        giftBox: !!g.gift_box,
        ...(g.done !== undefined
          ? {
              done: !!g.done,
              doneAt: g.done_at || null,
              doneBy: g.done_by || null,
            }
          : {}),
      }
    : null;

export const giftToApi = (g) =>
  g
    ? {
        to: g.to,
        from: g.from,
        message: g.message || '',
        gift_box: !!g.giftBox,
      }
    : null;

export const cartFromApi = (c) => ({
  items: (c?.products || []).map((p) => ({
    key: p.key,
    productId: p.product_id,
    title: p.name,
    image: p.image,
    options: p.options || {},
    quantity: p.quantity,
    price: Number(p.price),
    specialPrice: p.special === null ? null : Number(p.special),
    unitPrice: Number(p.unit_price),
    total: Number(p.total),
    stock: p.stock,
    inStock: p.in_stock,
    gift: giftFromApi(p.gift),
  })),
  giftOptions: c?.gift_options
    ? {
        enabled: c.gift_options.enabled,
        boxPrice: Number(c.gift_options.box_price),
        boxDescription: c.gift_options.box_description,
      }
    : null,
  itemCount: c?.item_count || 0,
  coupon: c?.coupon || null,
  couponProblem: c?.coupon_problem || null,
  shippingMethod: c?.shipping_method || null,
  totals: (c?.totals || []).map((t) => ({ ...t, value: Number(t.value) })),
  total: Number(c?.total || 0),
});

export const cartItemToApi = ({ productId, quantity, options = {} }) => ({
  product_id: productId,
  quantity,
  option: options,
});

// ---------- Addresses ----------

export const addressFromApi = (a) =>
  a && {
    id: a.address_id,
    firstName: a.firstname,
    lastName: a.lastname,
    company: a.company || '',
    line1: a.address_1,
    line2: a.address_2 || '',
    city: a.city,
    postcode: a.postcode || '',
    country: a.country,
    region: a.zone || '',
    phone: a.telephone || '',
    isDefault: Boolean(a.default),
  };

export const addressToApi = (a) => ({
  firstname: a.firstName,
  lastname: a.lastName,
  company: a.company || '',
  address_1: a.line1,
  address_2: a.line2 || '',
  city: a.city,
  postcode: a.postcode || '',
  country: a.country,
  zone: a.region || '',
  telephone: a.phone || '',
  ...(a.isDefault !== undefined ? { default: a.isDefault } : {}),
});

/** One line for lists and order summaries. */
export const formatAddress = (a) =>
  a
    ? [a.line1, a.line2, a.city, a.region, a.postcode, a.country]
        .filter(Boolean)
        .join(', ')
    : '';

// ---------- Orders ----------

export const orderFromApi = (o) =>
  o && {
    id: o.order_id,
    status: o.status,
    statusName: o.status_name,
    email: o.email,
    customer: o.customer || null,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    shippingMethod: o.shipping_method,
    shippingAddress: addressFromApi(o.shipping_address),
    paymentAddress: addressFromApi(o.payment_address),
    coupon: o.coupon,
    totals: o.totals,
    total: Number(o.total),
    currency: o.currency,
    comment: o.comment,
    itemCount: o.item_count,
    // List rows: each item's name, image and chosen options.
    preview: (o.preview || []).map((p) => ({
      name: p.name,
      image: p.image,
      options: p.options || {},
      quantity: p.quantity,
      price: p.price !== undefined ? Number(p.price) : undefined,
      total: p.total !== undefined ? Number(p.total) : undefined,
      productId: p.product_id,
    })),
    items: (o.products || []).map((p) => ({
      id: p.order_product_id,
      productId: p.product_id,
      variantId: p.variant_id ?? null,
      title: p.name,
      image: p.image,
      options: p.options || {},
      sku: p.sku || '',
      gift: giftFromApi(p.gift),
      quantity: p.quantity,
      price: Number(p.price),
      total: Number(p.total),
    })),
    nextStatuses: o.next_statuses || [],
    history: (o.history || []).map((h) => ({
      status: h.status,
      statusName: h.status_name,
      comment: h.comment,
      date: h.date_added,
      notified: h.notified,
    })),
    returns: (o.returns || []).map(returnFromApi),
    placedAt: o.date_added,
  };

export function returnFromApi(r) {
  return (
    r && {
      id: r.return_id,
      orderId: r.order_id,
      orderItemId: r.order_product_id,
      product: r.product,
      image: r.image,
      quantity: r.quantity,
      reason: r.reason,
      reasonName: r.reason_name,
      opened: r.opened,
      comment: r.comment,
      status: r.status,
      statusName: r.status_name || r.status,
      amount: r.amount,
      receivedAt: r.received_at || null,
      refund: r.refund
        ? {
            id: r.refund.refund_id,
            status: r.refund.status,
            amount: Number(r.refund.amount),
            method: r.refund.method,
          }
        : null,
      date: r.date_added,
      updated: r.date_modified,
      customer: r.customer || null,
    }
  );
}
