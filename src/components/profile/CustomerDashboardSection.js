// src/components/profile/CustomerDashboardSection.js

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Paper,
  Divider,
} from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// Import the mock data from our data file
import {
  customerName,
  welcomeBannerMessage,
  quickActions,
  orderSummaryData,
  recommendedProducts,
  recentlyViewedProducts,
  accountSummaryData,
} from '../../data/customerDashboard';

const CustomerDashboardSection = () => {
  return (
    <Box sx={{ px: 0, py: 0 }}>
      {/* 1. Welcome Banner */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 2,
          backgroundImage: 'url("https://picsum.photos/id/200/1200/300")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#fff',
          borderRadius: 3, // Updated border radius for consistency
          boxShadow: 1, // Consistent box shadow
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Welcome back, {customerName}!
        </Typography>
        <Typography variant="body1">{welcomeBannerMessage}</Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {/* 2. Quick Actions */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            {quickActions && quickActions.length > 0 ? (
              quickActions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="contained"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 'bold',
                    borderRadius: 3, // Updated border radius for consistency
                    height: 50,
                  }}
                  onClick={() => (window.location.href = action.link)}
                >
                  {action.icon} &nbsp; {action.label}
                </Button>
              ))
            ) : (
              <Typography variant="body2">
                No quick actions available.
              </Typography>
            )}
          </Box>

          {/* 3. Order Summary */}
          <Card
            sx={{
              mb: 2,
              borderRadius: 3, // Updated border radius for consistency
              boxShadow: 1, // Consistent box shadow
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                Your Orders
              </Typography>
              <Typography variant="body1" sx={{ mb: 0.5 }}>
                Orders in Progress: {orderSummaryData.inProgressCount}
              </Typography>
              <Typography variant="body1" sx={{ mb: 0.5 }}>
                Completed Orders: {orderSummaryData.completedCount}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                Returns: {orderSummaryData.returnsCount}
              </Typography>
              <Button
                variant="outlined"
                onClick={() =>
                  (window.location.href = '/profile?section=orders')
                }
                sx={{
                  textTransform: 'none',
                  fontWeight: 'bold',
                  borderColor: 'primary.main',
                }}
              >
                Track Orders
              </Button>
            </CardContent>
          </Card>

          {/* 4. Recommended Products */}
          <Card
            sx={{
              mb: 2,
              borderRadius: 3, // Updated border radius for consistency
              boxShadow: 1, // Consistent box shadow
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Recommended For You
                </Typography>
                <Button
                  variant="text"
                  onClick={() =>
                    window.location.assign('/products?recommended=true')
                  }
                  endIcon={<ArrowForwardIosIcon fontSize="small" />}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  See All
                </Button>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  overflowX: 'auto',
                  gap: 2,
                  pb: 1,
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                {recommendedProducts && recommendedProducts.length > 0 ? (
                  recommendedProducts.map((product) => (
                    <Box
                      key={product.id}
                      sx={{
                        minWidth: 130,
                        flex: '0 0 auto',
                        border: '1px solid #eee',
                        borderRadius: 3, // Updated border radius for consistency
                        p: 1,
                        textAlign: 'center',
                        boxShadow: 1, // Consistent box shadow
                      }}
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        style={{
                          width: '100%',
                          objectFit: 'cover',
                          borderRadius: '8px', // Ensuring image corners match card
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ mt: 1, fontWeight: 'bold' }}
                      >
                        {product.name}
                      </Typography>
                      <Typography variant="body2">{product.price}</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{
                          mt: 1,
                          textTransform: 'none',
                          fontSize: '0.75rem',
                        }}
                      >
                        Add to Cart
                      </Button>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2">
                    No recommended products available.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* 5. Recently Viewed */}
          <Card
            sx={{
              borderRadius: 3, // Updated border radius for consistency
              boxShadow: 1, // Consistent box shadow
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Recently Viewed
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  overflowX: 'auto',
                  gap: 2,
                  pb: 1,
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                {recentlyViewedProducts && recentlyViewedProducts.length > 0 ? (
                  recentlyViewedProducts.map((prod) => (
                    <Box
                      key={prod.id}
                      sx={{
                        minWidth: 130,
                        flex: '0 0 auto',
                        border: '1px solid #eee',
                        borderRadius: 3, // Updated border radius for consistency
                        p: 1,
                        textAlign: 'center',
                        boxShadow: 1, // Consistent box shadow
                      }}
                    >
                      <img
                        src={prod.image}
                        alt={prod.name}
                        style={{
                          width: '100%',
                          objectFit: 'cover',
                          borderRadius: '8px', // Ensuring image corners match card
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ mt: 1, fontWeight: 'bold' }}
                      >
                        {prod.name}
                      </Typography>
                      <Typography variant="body2">{prod.price}</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{
                          mt: 1,
                          textTransform: 'none',
                          fontSize: '0.75rem',
                        }}
                        onClick={() =>
                          window.location.assign(`/products/${prod.id}`)
                        }
                      >
                        View Details
                      </Button>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2">
                    No recently viewed products.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 6. & 7. Account Summary with Notifications (Right side) */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3, // Updated border radius for consistency
              boxShadow: 1, // Consistent box shadow
            }}
          >
            <CardContent sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                Account Summary
              </Typography>
              <Typography variant="body2">
                Loyalty Points:{' '}
                <strong>{accountSummaryData.loyaltyPoints}</strong>
              </Typography>
              <Typography variant="body2">
                Membership Tier:{' '}
                <strong>{accountSummaryData.membershipTier}</strong>
              </Typography>
              <Typography variant="body2">
                Payment Methods:{' '}
                <strong>{accountSummaryData.paymentMethods}</strong>
              </Typography>
              <Button
                variant="outlined"
                size="small"
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  borderColor: 'primary.main',
                }}
                onClick={() =>
                  window.location.assign('/profile?section=payment-options')
                }
              >
                Manage Payment Methods
              </Button>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" sx={{ mb: 1 }}>
                Need help or have questions?
              </Typography>
              <Button
                variant="contained"
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  backgroundColor: 'primary.main',
                  '&:hover': { backgroundColor: 'primary.dark' },
                }}
                onClick={() =>
                  window.location.assign(accountSummaryData.supportLink)
                }
              >
                Contact Support
              </Button>
            </CardContent>

            {/* Notifications at the bottom */}
            <Box sx={{ px: 2, pb: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Notifications
              </Typography>
              {accountSummaryData.notifications &&
              accountSummaryData.notifications.length > 0 ? (
                accountSummaryData.notifications.map((notif) => (
                  <Typography key={notif.id} variant="body2" sx={{ mb: 0.5 }}>
                    • {notif.message}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2">No new notifications.</Typography>
              )}
              <Button
                variant="text"
                size="small"
                sx={{ textTransform: 'none', mt: 1, fontSize: '0.75rem' }}
                onClick={() =>
                  window.location.assign('/profile?section=messages')
                }
              >
                See All Notifications
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerDashboardSection;
