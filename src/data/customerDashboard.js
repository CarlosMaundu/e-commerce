// src/data/customerDashboard.js

/**
 * This file contains all the mock data for the Customer Dashboard,
 * acting like a placeholder "API" until real integration is ready.
 */

// 1. Welcome Banner
export const customerName = 'Anne';
export const welcomeBannerMessage =
  'Track your orders and explore our latest collections.';

// 2. Quick Actions
export const quickActions = [
  { label: 'Track Orders', icon: '📦', link: '/profile?section=orders' },
  { label: 'View Wishlist', icon: '❤️', link: '/wishlist' },
  { label: 'Explore Offers', icon: '🔥', link: '/products?offers=true' },
  { label: 'Update Profile', icon: '📝', link: '/profile?section=profile' },
];

// 3. Order Summary
export const orderSummaryData = {
  inProgressCount: 2,
  completedCount: 12,
  returnsCount: 1,
};

// 4. Recommended Products
export const recommendedProducts = [
  {
    id: 1,
    name: 'Wireless Headphones',
    price: '$59.99',
    image: 'https://picsum.photos/id/88/200/200', // Example placeholder
  },
  {
    id: 2,
    name: 'Smart Watch',
    price: '$79.99',
    image: 'https://picsum.photos/id/104/200/200',
  },
  {
    id: 3,
    name: 'Running Shoes',
    price: '$49.99',
    image: 'https://picsum.photos/id/175/200/200',
  },
  {
    id: 4,
    name: 'Bluetooth Speaker',
    price: '$39.99',
    image: 'https://picsum.photos/id/254/200/200',
  },
];

// 5. Recently Viewed
export const recentlyViewedProducts = [
  {
    id: 10,
    name: 'Laptop Sleeve',
    price: '$19.99',
    image: 'https://picsum.photos/id/219/200/200',
  },
  {
    id: 11,
    name: 'Travel Backpack',
    price: '$35.00',
    image: 'https://picsum.photos/id/221/200/200',
  },
];

// 6. & 7. Account Summary + Notifications
export const accountSummaryData = {
  loyaltyPoints: 1200,
  membershipTier: 'Gold Member',
  paymentMethods: 2, // or an array if you prefer
  supportLink: '/profile?section=messages',
  notifications: [
    {
      id: 1,
      message: 'Your order #425483 has been shipped!',
    },
    {
      id: 2,
      message: 'Exclusive discount: 10% off on your next order.',
    },
  ],
};
