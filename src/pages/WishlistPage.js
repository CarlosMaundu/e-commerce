// src/pages/WishlistPage.js

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { removeFromWishlist } from '../redux/wishlistSlice';
import '../styles/wishlistPage.css';

const WishlistPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const wishlistItems = useSelector((state) => state.wishlist.items);

  const handleRemoveFromWishlist = (id) => {
    dispatch(removeFromWishlist(id));
  };

  const handleViewProduct = (id) => {
    navigate(`/products/${id}`);
  };

  return (
    <Box className="wishlist-page">
      <Typography variant="h4" gutterBottom>
        My Wishlist
      </Typography>
      <Grid container spacing={4}>
        {wishlistItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <Card className="wishlist-item">
              <CardMedia
                component="img"
                height="140"
                image={item.images[0]}
                alt={item.title}
              />
              <CardContent>
                <Typography variant="h6">{item.title}</Typography>
                <Typography variant="body2" color="textSecondary">
                  ${item.price.toFixed(2)}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  onClick={() => handleViewProduct(item.id)}
                >
                  View Product
                </Button>
                <Button
                  size="small"
                  color="secondary"
                  onClick={() => handleRemoveFromWishlist(item.id)}
                >
                  Remove
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default WishlistPage;
