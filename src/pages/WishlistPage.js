// src/pages/WishlistPage.js — saved products. Signed-in shoppers see it in
// their account (with the sidebar); guests keep a browser-only list here.
import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import { Navigate, Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Alert, Box, Button, Container, Typography } from '@mui/material';
import { FiHeart } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import ProductCard from '../components/common/ProductCard';
import { EmptyState } from '../components/ui';
import { AccountPage } from '../layouts/StorefrontLayout';

const WishlistGrid = ({ items, columns }) =>
  !items.length ? (
    <EmptyState
      icon={<FiHeart />}
      title="Nothing saved yet"
      action={
        <Button component={RouterLink} to="/products" variant="contained">
          Browse products
        </Button>
      }
    >
      Tap the heart on any product to save it here.
    </EmptyState>
  ) : (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: columns,
      }}
    >
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </Box>
  );
WishlistGrid.propTypes = {
  items: PropTypes.array.isRequired,
  columns: PropTypes.object.isRequired,
};

/** /account/wishlist — inside the account layout. */
export const AccountWishlistPage = () => {
  const items = useSelector((s) => s.wishlist.items);
  return (
    <AccountPage
      title="Wishlist"
      subtitle={`${items.length} saved item${items.length === 1 ? '' : 's'}`}
    >
      <WishlistGrid
        items={items}
        columns={{
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          lg: 'repeat(4, minmax(0, 1fr))',
        }}
      />
    </AccountPage>
  );
};

/** /wishlist — guests; signed-in shoppers move to their account. */
const WishlistPage = () => {
  const { user } = useContext(AuthContext);
  const items = useSelector((s) => s.wishlist.items);
  if (user) return <Navigate to="/account/wishlist" replace />;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
        Wishlist
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {items.length} saved item{items.length === 1 ? '' : 's'}
      </Typography>
      {items.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Your wishlist is saved in this browser.{' '}
          <RouterLink to="/login">Sign in</RouterLink> to keep it in your
          account.
        </Alert>
      )}
      <WishlistGrid
        items={items}
        columns={{
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        }}
      />
    </Container>
  );
};

export default WishlistPage;
