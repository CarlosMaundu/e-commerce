// src/pages/CartPage.js
import React, { useContext, useState } from 'react';
import PageSkeleton from '../components/common/PageSkeleton';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import {
  FiChevronLeft,
  FiEdit2,
  FiGift,
  FiHeart,
  FiMinus,
  FiPlus,
  FiShoppingCart,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { alpha } from '@mui/material/styles';
import { AuthContext } from '../context/AuthContext';
import { canShop } from '../auth/permissions';
import OptionRows from '../components/common/OptionRows';
import GiftDialog from '../components/cart/GiftDialog';
import {
  applyCoupon,
  removeCoupon,
  removeFromCart,
  selectCart,
  setCartGift,
  setCartQuantity,
} from '../redux/cartSlice';
import { addToWishlist } from '../redux/wishlistSlice';
import { useNotify } from '../notification/NotificationProvider';
import { EmptyState, SectionCard } from '../components/ui';
import { formatMoney } from '../utils/format';

const qtyButtonSx = {
  width: 30,
  height: 30,
  borderRadius: '6px',
  fontSize: '0.9rem',
  bgcolor: 'background.neutralDeep',
  '&:hover': { bgcolor: 'divider' },
};

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

  const [selected, setSelected] = useState([]);
  const shopper = canShop(user);
  const moveAllToWishlist = async () => {
    for (const item of cart.items) {
      // eslint-disable-next-line no-await-in-loop
      await moveToWishlist(item);
    }
  };
  const removeSelected = async () => {
    for (const key of selected) {
      // eslint-disable-next-line no-await-in-loop
      await act(removeFromCart(key));
    }
    setSelected([]);
    notify.success('Removed the selected items.');
  };

  // Gifts: ticking the box opens the details; unticking stops the gift.
  const [giftFor, setGiftFor] = useState(null);
  const giftsOn = cart.mode !== 'server' || cart.giftOptions?.enabled;
  const toggleGift = (item, on) => {
    if (cart.mode !== 'server') {
      notify.info('Sign in to send items as gifts.');
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    if (on) setGiftFor(item.key);
    else act(setCartGift({ key: item.key, gift: null }), 'No longer a gift.');
  };
  const saveGift = async (gift) => {
    if (await act(setCartGift({ key: giftFor, gift }), 'Gift details saved.')) {
      setGiftFor(null);
    }
  };
  const giftItem = cart.items.find((i) => i.key === giftFor);

  const submitCoupon = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (await act(applyCoupon(code), 'Promo code applied.')) setCode('');
  };

  const checkout = () => {
    if (!user) navigate('/login', { state: { from: '/checkout' } });
    else navigate('/checkout');
  };

  if (!cart.items.length && busy) return <PageSkeleton variant="cart" />;

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
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button
                component={RouterLink}
                to="/products"
                startIcon={<FiChevronLeft />}
                sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }}
              >
                Continue shopping
              </Button>
              {shopper && (
                <Button
                  startIcon={<FiHeart />}
                  onClick={moveAllToWishlist}
                  disabled={busy}
                  sx={{ bgcolor: 'background.neutral', color: 'text.primary' }}
                >
                  Move all items into wishlist
                </Button>
              )}
              {selected.length > 0 && (
                <Button
                  color="error"
                  startIcon={<FiTrash2 />}
                  onClick={removeSelected}
                  disabled={busy}
                >
                  Remove selected ({selected.length})
                </Button>
              )}
            </Stack>
            {hasStockProblem && (
              <Alert severity="warning">
                Some items have less stock than you asked for. Lower the
                quantity to continue.
              </Alert>
            )}
            {cart.items.map((item) => {
              const onSale =
                item.specialPrice !== null &&
                item.specialPrice !== undefined &&
                item.specialPrice < item.price;
              const save = onSale
                ? Math.round(
                    ((item.price - item.specialPrice) / item.price) * 100
                  )
                : 0;
              const editLink = `/products/${item.productId}${
                Object.keys(item.options || {}).length
                  ? `?${new URLSearchParams(item.options)}`
                  : ''
              }`;
              return (
                <Box
                  key={item.key}
                  data-testid="cart-line"
                  sx={{
                    bgcolor: 'background.neutral',
                    borderRadius: 1,
                    p: { xs: 2, md: 3 },
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ minWidth: 0 }}
                    >
                      <Checkbox
                        checked={selected.includes(item.key)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, item.key]
                              : s.filter((k) => k !== item.key)
                          )
                        }
                        inputProps={{ 'aria-label': `Select ${item.title}` }}
                        sx={{ ml: -1 }}
                      />
                      <Typography
                        component={RouterLink}
                        to={editLink}
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: '1rem', md: '1.1rem' },
                          color: 'text.primary',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {item.title}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ flexShrink: 0 }}
                    >
                      <Typography color="text.secondary">Each</Typography>
                      <Typography sx={{ fontWeight: 700 }}>
                        {formatMoney(item.unitPrice)}
                      </Typography>
                      {save > 0 && (
                        <Chip
                          size="small"
                          label={`Save ${save}%`}
                          sx={{
                            height: 22,
                            color: 'success.main',
                            bgcolor: 'success.light',
                            fontWeight: 600,
                          }}
                        />
                      )}
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      mt: 2,
                      display: 'grid',
                      gap: { xs: 2, sm: 3 },
                      alignItems: 'center',
                      gridTemplateColumns: {
                        xs: '96px minmax(0, 1fr)',
                        sm: '140px minmax(0, 1fr) auto',
                      },
                    }}
                  >
                    <Box
                      component={RouterLink}
                      to={editLink}
                      sx={{
                        aspectRatio: '1 / 1',
                        borderRadius: '8px',
                        bgcolor: 'background.paper',
                        overflow: 'hidden',
                        display: 'block',
                      }}
                    >
                      <Box
                        component="img"
                        src={item.image}
                        alt={item.title}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    </Box>
                    <Stack spacing={1.25} alignItems="flex-start">
                      {item.inStock === false ? (
                        <Chip
                          size="small"
                          label={`Only ${item.stock} left`}
                          sx={{
                            height: 24,
                            color: 'error.main',
                            bgcolor: 'error.light',
                            fontWeight: 600,
                          }}
                        />
                      ) : (
                        item.stock !== undefined &&
                        item.stock <= 5 && (
                          <Chip
                            size="small"
                            label={`${item.stock} remaining`}
                            sx={{
                              height: 24,
                              color: 'warning.main',
                              bgcolor: 'warning.light',
                              fontWeight: 600,
                            }}
                          />
                        )
                      )}
                      <OptionRows options={item.options} />
                    </Stack>
                    <Stack
                      spacing={1.5}
                      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                      sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="baseline"
                      >
                        {onSale && (
                          <Typography
                            color="text.disabled"
                            sx={{ textDecoration: 'line-through' }}
                          >
                            {formatMoney(item.price * item.quantity)}
                          </Typography>
                        )}
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: { xs: '1.25rem', md: '1.5rem' },
                          }}
                        >
                          {formatMoney(item.total)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mr: 0.5 }}
                        >
                          Quantity:
                        </Typography>
                        <IconButton
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
                          sx={qtyButtonSx}
                        >
                          <FiMinus />
                        </IconButton>
                        <Box
                          aria-label="Quantity"
                          sx={{
                            width: 40,
                            height: 30,
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            bgcolor: 'background.neutralDeep',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 600,
                          }}
                        >
                          {item.quantity}
                        </Box>
                        <IconButton
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
                          sx={qtyButtonSx}
                        >
                          <FiPlus />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>

                  {giftsOn && (
                    <Stack
                      direction="row"
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      spacing={1}
                      sx={{
                        mt: 2,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: '8px',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={!!item.gift}
                        onChange={(e) => toggleGift(item, e.target.checked)}
                        disabled={busy}
                        inputProps={{
                          'aria-label': `Send ${item.title} as a gift`,
                        }}
                        sx={{ ml: -1 }}
                      />
                      <FiGift />
                      <Typography sx={{ fontWeight: 600 }}>
                        Send as a gift
                      </Typography>
                      {item.gift && (
                        <>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: 0 }}
                            noWrap
                          >
                            To {item.gift.to} · From {item.gift.from}
                            {item.gift.giftBox ? ' · Gift box' : ''}
                            {item.gift.message ? ' · Message' : ''}
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => setGiftFor(item.key)}
                            aria-label={`Gift details for ${item.title}`}
                            sx={{ ml: 'auto' }}
                          >
                            Details
                          </Button>
                        </>
                      )}
                    </Stack>
                  )}

                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mt: 2 }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      divider={
                        <Box
                          sx={{ width: '1px', height: 24, bgcolor: 'divider' }}
                        />
                      }
                      spacing={1}
                    >
                      <Button
                        component={RouterLink}
                        to={editLink}
                        color="inherit"
                        startIcon={<FiEdit2 />}
                      >
                        Edit
                      </Button>
                      {shopper && (
                        <Button
                          color="inherit"
                          startIcon={<FiHeart />}
                          aria-label={`Move ${item.title} to wishlist`}
                          onClick={() => moveToWishlist(item)}
                          disabled={busy}
                        >
                          Move to wishlist
                        </Button>
                      )}
                    </Stack>
                    <Button
                      color="error"
                      aria-label={`Remove ${item.title}`}
                      onClick={() =>
                        act(removeFromCart(item.key), 'Removed from your cart.')
                      }
                      disabled={busy}
                    >
                      Remove
                    </Button>
                  </Stack>
                </Box>
              );
            })}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                pt: 2.5,
                px: { xs: 1, md: 3 },
              }}
            >
              <Typography sx={{ fontWeight: 600 }}>
                {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
              </Typography>
              <Stack direction="row" spacing={2} alignItems="baseline">
                <Typography color="text.secondary">total</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.5rem' }}>
                  {formatMoney(cart.items.reduce((sum, i) => sum + i.total, 0))}
                </Typography>
              </Stack>
            </Stack>
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
                      borderRadius: 1,
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
      <GiftDialog
        open={!!giftItem}
        item={giftItem}
        options={cart.giftOptions}
        onClose={() => setGiftFor(null)}
        onSave={saveGift}
        saving={busy}
      />
    </Container>
  );
};

export default CartPage;
