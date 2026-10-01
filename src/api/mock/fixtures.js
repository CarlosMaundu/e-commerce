// src/api/mock/fixtures.js
//
// Sample data for `mock` mode, in contract (OpenCart) format. Clearly
// example content: not real products, prices or people.
import women from '../../images/curated-pick1.png';
import men from '../../images/curated-pick2.png';
import beauty from '../../images/curated-pick3.png';
import home from '../../images/curated-pick6.png';
import accessories from '../../images/curated-pick9.png';
import electronics from '../../images/curated-pick11.png';

export const MOCK_ADMIN_EMAIL = 'admin@example.com';

const categories = [
  { category_id: 1, name: 'Women', image: women, parent_id: 0 },
  { category_id: 2, name: 'Men', image: men, parent_id: 0 },
  { category_id: 3, name: 'Beauty', image: beauty, parent_id: 0 },
  { category_id: 4, name: 'Home', image: home, parent_id: 0 },
  { category_id: 5, name: 'Accessories', image: accessories, parent_id: 0 },
  { category_id: 6, name: 'Electronics', image: electronics, parent_id: 0 },
  { category_id: 7, name: 'Dresses', image: women, parent_id: 1 },
  { category_id: 8, name: 'Jackets', image: men, parent_id: 2 },
];

const product = (id, name, categoryId, price, extra = {}) => {
  const category = categories.find((c) => c.category_id === categoryId);
  return {
    product_id: id,
    name,
    description: `Sample product for testing: ${name}.`,
    price,
    special: null,
    image: category.image,
    images: [category.image],
    category: [{ category_id: category.category_id, name: category.name }],
    quantity: 25,
    rating: 4,
    reviews: 12,
    manufacturer: 'Sample Brand',
    options: { sizes: [], colors: [] },
    date_added: `2026-09-${String(10 + id).padStart(2, '0')}T09:00:00Z`,
    date_modified: `2026-09-${String(10 + id).padStart(2, '0')}T09:00:00Z`,
    ...extra,
  };
};

const products = [
  product(1, 'Linen summer dress', 1, 49.99, {
    options: { sizes: ['S', 'M', 'L'], colors: ['Sand', 'Olive'] },
  }),
  product(2, 'Denim jacket', 2, 79.0, { special: 59.0 }),
  product(3, 'Cotton crew-neck shirt', 2, 24.5, {
    options: { sizes: ['M', 'L', 'XL'], colors: ['White'] },
  }),
  product(4, 'Hydrating face serum', 3, 32.0),
  product(5, 'Ceramic table lamp', 4, 64.0, { quantity: 0 }),
  product(6, 'Leather card wallet', 5, 29.0, { special: 22.0 }),
  product(7, 'Wireless earbuds', 6, 89.0, { rating: 5, reviews: 48 }),
  product(8, 'Wrap midi dress', 1, 69.0),
  product(9, 'Wool overshirt', 2, 95.0),
  product(10, 'Scented soy candle', 4, 18.0),
  product(11, 'Canvas tote bag', 5, 15.0),
  product(12, 'Smart fitness band', 6, 59.0, { special: 45.0 }),
];

const users = [
  {
    customer_id: 1,
    firstname: 'Ada',
    lastname: 'Admin',
    email: MOCK_ADMIN_EMAIL,
    role: 'admin',
    avatar: '',
    status: 'active',
    date_added: '2026-09-01T09:00:00Z',
  },
  {
    customer_id: 2,
    firstname: 'Cam',
    lastname: 'Customer',
    email: 'customer@example.com',
    role: 'customer',
    avatar: '',
    status: 'active',
    date_added: '2026-09-02T09:00:00Z',
  },
];

export const createSeedState = () =>
  JSON.parse(
    JSON.stringify({
      categories,
      products,
      users,
      subscribers: [],
      nextIds: { product: 100, category: 100, customer: 100 },
    })
  );
