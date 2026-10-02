// src/pages/CartPage.js
import React, { useContext, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  InputBase,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  FiHeart,
  FiMinus,
  FiPlus,
  FiShoppingCart,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import {
  applyCoupon,
  removeCoupon,
  removeFromCart,
  selectCart,
  setCartQuantity,
} from '../redux/cartSlice';
import { addToWishlist } from '../redux/wishlistSlice';
import { useNotify } from '../notification/NotificationProvider';
import { EmptyState, SectionCard } from '../components/ui';
import { formatMoney, optionText } from '../utils/format';

const CartPage = () => {
  const { user } = useContext(AuthContext);
  const cart = useSelector(selectCart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notify = useNotify();
  const [code, setCode] = useState('');
  const busy = cart.status === 'loading';

  const act = async (thunk, success) => {
    try {
      await dispatch(thunk).unwrap();
      if (success) notify.success(success);
      return true;
    } catch (message) {
      notify.error(message);
      return false;
    }
  };

  const moveToWishlist = async (item) => {
    const ok = await act(
      addToWishlist({
        id: item.productId,
        title: item.title,
        images: [item.image],
        price: item.unitPrice,
      })
    );
    if (ok) await act(removeFromCart(item.key), 'Moved to your wishlist.');
  };

  const submitCoupon = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (await act(applyCoupon(code), 'Promo code applied.')) setCode('');
  };

  const checkout = () => {
    if (!user) navigate('/login', { state: { from: '/checkout' } });
    else navigate('/checkout');
  };

  if (!cart.items.length) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <EmptyState
          icon={<FiShoppingCart />}
          title="Your cart is empty"
          action={
            <Button component={RouterLink} to="/products" variant="contained">
              Browse products
            </Button>
          }
        >
          Items you add will appear here.
        </EmptyState>
      </Container>
    );
  }

  const hasStockProblem = cart.items.some((i) => i.inStock === false);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
        Cart{' '}
        <Typography component="span" variant="h5" color="text.secondary">
          ({cart.itemCount} item{cart.itemCount === 1 ? '' : 's'})
        </Typography>
      </Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            {hasStockProblem && (
              <Alert severity="warning">
                Some items have less stock than you asked for. Lower the
                quantity to continue.
              </Alert>
            )}
            {cart.items.map((item) => (
              <Stack
                key={item.key}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2.5}
                alignItems={{ sm: 'center' }}
                data-testid="cart-line"
                sx={{ bgcolor: 'background.neutral', borderRadius: 4, p: 2.5 }}
              >
                <Box
                  component={RouterLink}
                  to={`/products/${item.productId}`}
                  sx={{
                    width: 96,
                    height: 96,
                    flexShrink: 0,
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    display: 'grid',
                    placeItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src={item.image}
                    alt={item.title}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="subtitle1"
                    component={RouterLink}
                    to={`/products/${item.productId}`}
                    sx={{ color: 'text.primary', textDecoration: 'none' }}
                  >
                    {item.title}
                  </Typography>
                  {optionText(item.options) && (
                    <Typography variant="body2" color="text.secondary">
                      {optionText(item.options)}
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mt: 0.5 }}
                  >
                    <Typography variant="subtitle2">
                      {formatMoney(item.unitPrice)}
                    </Typography>
                    {item.specialPrice !== null &&
                      item.specialPrice !== undefined &&
                      item.specialPrice < item.price && (
                        <>
                          <Typography
                            variant="body2"
                            color="text.disabled"
                            sx={{ textDecoration: 'line-through' }}
                          >
                            {formatMoney(item.price)}
                          </Typography>
                          <Chip size="small" color="success" label="Sale" />
                        </>
                      )}
                  </Stack>
                  {item.inStock === false && (
                    <Typography variant="body2" color="error.main">
                      Only {item.stock} left
                    </Typography>
                  )}
                </Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 999,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label={`Decrease quantity of ${item.title}`}
                    disabled={busy || item.quantity <= 1}
                    onClick={() =>
                      act(
                        setCartQuantity({
                          key: item.key,
                          quantity: item.quantity - 1,
                        })
                      )
                    }
                  >
                    <FiMinus />
                  </IconButton>
                  <Typography
                    sx={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}
                    aria-label="Quantity"
                  >
                    {item.quantity}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={`Increase quantity of ${item.title}`}
                    disabled={busy || item.quantity >= 99}
                    onClick={() =>
                      act(
                        setCartQuantity({
                          key: item.key,
                          quantity: item.quantity + 1,
                        })
                      )
                    }
                  >
                    <FiPlus />
                  </IconButton>
                </Stack>
                <Typography
                  variant="subtitle1"
                  sx={{ minWidth: 90, textAlign: { sm: 'right' } }}
                >
                  {formatMoney(item.total)}
                </Typography>
                <Stack direction="row">
                  <Tooltip title="Move to wishlist">
                    <IconButton
                      aria-label={`Move ${item.title} to wishlist`}
                      onClick={() => moveToWishlist(item)}
                      disabled={busy}
                    >
                      <FiHeart />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton
                      aria-label={`Remove ${item.title}`}
                      onClick={() =>
                        act(removeFromCart(item.key), 'Removed from your cart.')
                      }
                      disabled={busy}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionCard
            title="Order summary"
            sx={{ position: { md: 'sticky' }, top: { md: 140 } }}
          >
            {cart.mode === 'server' ? (
              cart.coupon ? (
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Chip color="success" label={`${cart.coupon.code} applied`} />
                  <Button
                    size="small"
                    startIcon={<FiX />}
                    onClick={() => act(removeCoupon(), 'Promo code removed.')}
                  >
                    Remove
                  </Button>
                </Stack>
              ) : (
                <Box
                  component="form"
                  onSubmit={submitCoupon}
                  sx={{ display: 'flex', gap: 1, mb: 2 }}
                >
                  <InputBase
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Promo code"
                    inputProps={{ 'aria-label': 'Promo code' }}
                    sx={{
                      flex: 1,
                      bgcolor: 'background.neutral',
                      borderRadius: 2,
                      px: 1.5,
                      height: 40,
                    }}
                  />
                  <Button
                    type="submit"
                    variant="outlined"
                    disabled={busy || !code.trim()}
                  >
                    Apply
                  </Button>
                </Box>
              )
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Sign in at checkout to use a promo code.
              </Typography>
            )}
            {cart.couponProblem && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {cart.couponProblem}
              </Alert>
            )}
            <Stack spacing={1}>
              {cart.totals
                .filter((t) => t.code !== 'total')
                .map((t) => (
                  <Stack
                    key={t.code}
                    direction="row"
                    justifyContent="space-between"
                  >
                    <Typography color="text.secondary">{t.title}</Typography>
                    <Typography
                      color={t.value < 0 ? 'success.main' : 'text.primary'}
                    >
                      {formatMoney(t.value)}
                    </Typography>
                  </Stack>
                ))}
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle1">
                  {cart.mode === 'server' ? 'Total' : 'Subtotal'}
                </Typography>
                <Typography variant="subtitle1" data-testid="cart-total">
                  {formatMoney(cart.total)}
                </Typography>
              </Stack>
              <Typography variant="caption">
                Delivery {cart.mode === 'server' ? 'is' : 'and tax are'}{' '}
                calculated at checkout.
              </Typography>
            </Stack>
            <Button
              fullWidth
              size="large"
              variant="contained"
              sx={{ mt: 3 }}
              onClick={checkout}
              disabled={busy || hasStockProblem}
            >
              {user ? 'Checkout' : 'Sign in to check out'}
            </Button>
            <Button
              fullWidth
              component={RouterLink}
              to="/products"
              sx={{ mt: 1 }}
            >
              Continue shopping
            </Button>
          </SectionCard>
        </Grid>
      </Grid>
    </Container>
  );
};

export default CartPage;
