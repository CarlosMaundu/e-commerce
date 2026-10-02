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

  return {
    id: p.product_id,
    title: p.name,
    description: p.description || '',
    price,
    specialPrice: onSale ? special : null,
    discountPercentage: onSale
      ? Math.round(((price - special) / price) * 100)
      : 0,
    images,
    category: firstCategory
      ? {
          id: firstCategory.category_id,
          name: firstCategory.name,
          image: firstCategory.image || '',
        }
      : null,
    quantity,
    inStock: quantity === null ? true : quantity > 0,
    rating: toNumber(p.rating) ?? 0,
    reviewCount: toNumber(p.reviews) ?? 0,
    brand: p.manufacturer || '',
    sizes: p.options?.sizes || [],
    colors: p.options?.colors || [],
    creationAt: p.date_added,
    updatedAt: p.date_modified,
  };
};

/**
 * Admin product form → contract. Accepts the ManageProductTab form shape
 * ({ title, price, stock, discount, categoryId, images, sizes, colors, ... }).
 */
export const productToApi = (input = {}) => {
  const body = {};
  if (input.title !== undefined) body.name = input.title.trim();
  if (input.description !== undefined) body.description = input.description;
  if (input.price !== undefined) body.price = Number(input.price);
  if (input.stock !== undefined) body.quantity = Number(input.stock);
  if (input.categoryId !== undefined) {
    body.category_id = input.categoryId === '' ? null : input.categoryId;
  }
  if (input.images !== undefined) body.images = input.images;
  if (input.discount !== undefined && body.price !== undefined) {
    const discount = Number(input.discount) || 0;
    body.special =
      discount > 0
        ? Math.round(body.price * (1 - discount / 100) * 100) / 100
        : null;
  }
  if (input.sizes !== undefined || input.colors !== undefined) {
    body.options = { sizes: input.sizes || [], colors: input.colors || [] };
  }
  return body;
};

/** Domain list filters → OpenCart list query (page is 1-based). */
export const productQueryToApi = (filters = {}) => {
  const query = {};
  if (filters.search) query.search = filters.search;
  if (filters.categoryId) query.category = filters.categoryId;
  if (filters.price_min) query.price_min = filters.price_min;
  if (filters.price_max) query.price_max = filters.price_max;
  if (filters.limit !== undefined) {
    query.limit = filters.limit;
    query.page = Math.floor((filters.offset || 0) / filters.limit) + 1;
  }
  return query;
};

// ---------- Users / account ----------

const splitName = (name = '') => {
  const [firstname = '', ...rest] = name.trim().split(/\s+/);
  return { firstname, lastname: rest.join(' ') };
};

export const userFromApi = (u) =>
  u && {
    id: u.customer_id,
    name: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email,
    email: u.email,
    role: u.role || 'customer',
    permissions: u.permissions || [],
    avatar: u.avatar || '',
    status: u.status || 'active',
    hasPassword: u.has_password !== false,
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
  })),
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
  option: {
    ...(options.size ? { size: options.size } : {}),
    ...(options.color ? { color: options.color } : {}),
  },
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
    preview: o.preview || [],
    items: (o.products || []).map((p) => ({
      id: p.order_product_id,
      productId: p.product_id,
      title: p.name,
      image: p.image,
      options: p.options || {},
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
      date: r.date_added,
      customer: r.customer || null,
    }
  );
}
