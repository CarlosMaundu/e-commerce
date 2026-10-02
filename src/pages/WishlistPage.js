// src/pages/WishlistPage.js
import React, { useContext } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Alert, Button, Container, Grid, Typography } from '@mui/material';
import { FiHeart } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import ProductCard from '../components/common/ProductCard';
import { EmptyState } from '../components/ui';

const WishlistPage = () => {
  const { user } = useContext(AuthContext);
  const items = useSelector((s) => s.wishlist.items);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
        Wishlist
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {items.length} saved item{items.length === 1 ? '' : 's'}
      </Typography>
      {!user && items.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Your wishlist is saved in this browser.{' '}
          <RouterLink to="/login">Sign in</RouterLink> to keep it in your
          account.
        </Alert>
      )}
      {!items.length ? (
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
        <Grid container spacing={2}>
          {items.map((p) => (
            <Grid item xs={6} sm={4} md={3} lg={2.4} key={p.id}>
              <ProductCard product={p} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default WishlistPage;
