# E-Commerce Platform

Welcome to our E-Commerce platform! This project is designed to provide a robust online shopping experience for end-users and admin users, integrating key features like product browsing, secure authentication, product management, order management, payment integrations, and more.

## Overview

This platform serves as an end-to-end solution for:
- Browsing products from various categories.
- Managing user profiles, including personal information, addresses, payment options, and wishlists.
- Facilitating seamless checkouts with test credit cards, enabling you to verify the payment integration without moving real money.
- Supporting admin users with additional tools, such as user management, product management, category management, and order oversight.

All communication with product, category, and user data is handled via external APIs. For example, we have integrated the [Platzi Fake Store API](https://api.escuelajs.co/api/v1/) for products, categories, and user information. This ensures a clear separation of concerns and simpler maintenance.

## Key Features

- **Product Browsing**: Users can view products, filter them by categories, and paginate through them.
- **User Profiles**: Registered users can edit their personal information, manage saved addresses, payment options, and view their order history and wishlist.
- **Secure Authentication**: Users can log in, manage their profile, and securely handle personal and payment information.
- **Admin Capabilities**:
    - **User Management**: Admins can view and manage platform users.
    - **Product Management**: Add, edit, or remove products.
    - **Category Management**: Create and update product categories.
    - **Orders Management**: Oversee all customer orders.
- **Checkout & Payment**: Integration with test-mode payments to simulate real card transactions without incurring charges.
- **Responsive Design**: Supports both desktop and mobile viewports, including a collapsible/slide-out sidebar on mobile devices.

## Installation

To set up the project locally:

1. **Clone the Repository**:
     ```bash
     git clone https://github.com/yourusername/yourproject.git
     cd yourproject
     ```
2. **Install Dependencies**:
     ```bash
     npm install
     ```
3. **Configure Environment Variables**:
     - Set up `.env` files for local and production environments as needed.
     - Include your API keys and endpoints. For test payments, use your test API keys.
4. **Run the Development Server**:
     ```bash
     npm start
     ```
     The application will be available at [http://localhost:3000](http://localhost:3000).

## Authentication and Usage

- **Login**: Use provided test user credentials or register a new user to access profile features.
- **Admin Access**: Admin users can view special sections in the sidebar (e.g., User Management, Orders Management). Admin roles are typically assigned in the backend or via an admin dashboard.

### Example Test Credentials

- **Test User**:
    - Email: `testuser@example.com`
    - Password: `password123`
- **Test Admin**:
    - Email: `admin@example.com`
    - Password: `secureadmin`
    - (Adjust these as needed based on your setup.)

## Payment Testing with Stripe-Like Integration

We use test-mode credit cards and payment methods to simulate transactions. Do not use real card details. Use the following test card details when prompted during checkout:

- **Test Card Number**: `4242 4242 4242 4242`
- **Expiration Date**: Any valid future date (e.g., 12/34)
- **CVC**: Any three-digit number (e.g., 123)

You can also use other test cards as described below.

### Common Test Scenarios

- **Successful Payment**:
    - Use `4242 4242 4242 4242` with any future expiration date and any three-digit CVC.
- **Declined Payment**:
    - Use `4000000000000002` to simulate a generic decline.
- **3D Secure Testing**:
    - Use cards that require authentication to simulate 3D Secure flows (e.g., `4000000000003220` requires 3DS).

### Test Mode and Cards

- Always use test API keys and test card numbers provided in the documentation.
- For code-based testing, use `pm_card_visa` or other PaymentMethod IDs rather than card numbers directly.
- When ready to go live, replace test keys with live keys.

## Working with the APIs

This project interacts with external APIs for products, categories, and users. See examples:

- **Get All Products**:
    ```bash
    curl https://api.escuelajs.co/api/v1/products/
    ```
- **Get Product by ID**:
    ```bash
    curl https://api.escuelajs.co/api/v1/products/120
    ```
- **Create a Product**:
    ```bash
    curl -X POST https://api.escuelajs.co/api/v1/products/ \
         -H "Content-Type: application/json" \
         -d '{
             "title": "New Product",
             "price": 10,
             "description": "A description",
             "categoryId": 1,
             "images": ["https://placeimg.com/640/480/any"]
         }'
    ```

For authentication, categories, users, and other endpoints, please refer to the provided API specification or GraphQL queries in the code snippet above.

## Test Payments and Integration

### Interactive Testing:

- Use the card `4242 4242 4242 4242` in checkout forms.
- Enter a valid future expiry date and any CVC.

### Command Line Example (Stripe-like API):

```bash
curl https://api.stripe.com/v1/payment_intents \
-u "sk_test_26PHem9AhJZvU623DfE1x4sd:" \
-d amount=500 \
-d currency=gbp \
-d payment_method=pm_card_visa \
-d "payment_method_types[]"=card
```
Replace `sk_test_...` with your test secret key, and adjust amount, currency, and payment_method as needed.

## Examples and Interactions

- **Browse Products**:
    - Navigate to `/products` to view the product grid.
    - Click on a product to view its details.
- **Manage Profile**:
    - Login at `/login`.
    - Go to `/profile` to update personal information, address, or payment options.
    - Toggle between sections in the sidebar to view orders, wishlist, or admin tools (if you're an admin).
- **Checkout**:
    - Add items to your cart.
    - Proceed to checkout, enter test payment details.
    - Complete the transaction to see the order confirmation.

## Additional Notes

- **Responsive Design**: On mobile devices, a hamburger menu is available to toggle the sidebar navigation.
- **Virtual DOM Updates**: The project uses React’s Virtual DOM for efficient UI updates and navigation without full page reloads.
- **API Mocks and Testing**: Use provided test APIs and cards for simulating payment scenarios. Avoid load testing in test mode due to stricter rate limits.

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## Contact

For any queries or suggestions, please open an issue in the repository or contact the maintainers at `support@example.com`.
