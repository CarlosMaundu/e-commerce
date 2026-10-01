// src/api/remote/mappers.js
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
    avatar: u.avatar || '',
    status: u.status || 'active',
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
