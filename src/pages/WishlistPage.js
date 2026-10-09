// src/pages/WishlistPage.js — saved products in Aurora's wishlist layout: a
// toolbar (select all, add selected to cart, remove selected, search) and a
// card per product with its price, rating and Buy / Add to cart / Remove.
// Signed-in shoppers see it in their account; guests keep a browser list.
import React, { useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Navigate, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  InputAdornment,
  Link,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiHeart, FiSearch, FiShoppingCart, FiTrash2 } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { removeFromWishlist } from '../redux/wishlistSlice';
import { addToCart } from '../redux/cartSlice';
import { useNotify } from '../notification/NotificationProvider';
import { EmptyState } from '../components/ui';
import { AccountPage } from '../layouts/StorefrontLayout';
import { formatMoney } from '../utils/format';
import { PAGE_SIZE, StandardPagination } from '../components/admin/DataTable';

const WishlistItem = ({
  product: p,
  checked,
  onCheck,
  onAdd,
  onBuy,
  onRemove,
  busy,
}) => {
  const price = p.specialPrice ?? p.price;
  return (
    <Box
      component="article"
      data-testid={`wishlist-item-${p.id}`}
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 3 },
        alignItems: 'center',
        gridTemplateColumns: {
          xs: 'auto 96px minmax(0, 1fr)',
          md: 'auto 160px minmax(0, 1fr) 220px',
        },
        bgcolor: 'background.neutral',
        borderRadius: 1,
        p: { xs: 2, md: 3 },
      }}
    >
      <Checkbox
        checked={checked}
        onChange={(e) => onCheck(e.target.checked)}
        inputProps={{ 'aria-label': `Select ${p.title}` }}
      />
      <Box
        component={RouterLink}
        to={`/products/${p.id}`}
        sx={{
          position: 'relative',
          aspectRatio: '1 / 1',
          borderRadius: '8px',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          display: 'block',
        }}
      >
        {p.discountPercentage > 0 && (
          <Chip
            size="small"
            label="Sale"
            color="warning"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              color: '#fff',
              height: 22,
            }}
          />
        )}
        <Box
          component="img"
          src={p.images[0]}
          alt={p.title}
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Link
          component={RouterLink}
          to={`/products/${p.id}`}
          underline="hover"
          color="text.primary"
          sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', md: '1.05rem' } }}
        >
          {p.title}
        </Link>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ mt: 1 }}
          flexWrap="wrap"
          useFlexGap
        >
          {p.category && (
            <Chip size="small" variant="outlined" label={p.category.name} />
          )}
          {p.brand && (
            <Chip size="small" variant="outlined" label={p.brand.name} />
          )}
        </Stack>
        {p.rating > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Rating value={p.rating} precision={0.1} readOnly size="small" />
            <Typography variant="caption">({p.reviewCount} reviews)</Typography>
            {!p.inStock && (
              <Typography
                variant="caption"
                color="error.main"
                sx={{ fontWeight: 600 }}
              >
                Out of stock
              </Typography>
            )}
          </Stack>
        )}
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="baseline"
          sx={{ mt: 1.5 }}
          flexWrap="wrap"
          useFlexGap
        >
          <Typography
            sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', md: '1rem' } }}
          >
            {p.hasOptions && p.minPrice !== p.maxPrice ? 'From ' : ''}
            {formatMoney(p.hasOptions ? p.minPrice : price)}
          </Typography>
          {p.specialPrice !== null && p.specialPrice !== undefined && (
            <>
              <Typography
                color="text.disabled"
                sx={{ textDecoration: 'line-through' }}
              >
                {formatMoney(p.price)}
              </Typography>
              <Chip
                size="small"
                color="success"
                label={`Save ${p.discountPercentage}%`}
                sx={{ color: '#fff', height: 22 }}
              />
            </>
          )}
        </Stack>
      </Box>
      <Stack
        spacing={1}
        sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
        direction={{ xs: 'row', md: 'column' }}
        alignItems={{ md: 'stretch' }}
      >
        <Button
          variant="contained"
          onClick={onBuy}
          disabled={busy || !p.inStock}
          sx={{ flex: { xs: 1, md: 'none' } }}
        >
          {p.hasOptions ? 'Choose options' : 'Buy this item'}
        </Button>
        {!p.hasOptions && (
          <Button
            onClick={onAdd}
            disabled={busy || !p.inStock}
            sx={{
              flex: { xs: 1, md: 'none' },
              bgcolor: 'text.primary',
              color: 'common.white',
              '&:hover': { bgcolor: 'ink.light' },
            }}
          >
            Add item to cart
          </Button>
        )}
        <Button
          color="error"
          onClick={onRemove}
          disabled={busy}
          sx={{ flex: { xs: 1, md: 'none' } }}
        >
          Remove
        </Button>
      </Stack>
    </Box>
  );
};
WishlistItem.propTypes = {
  product: PropTypes.object.isRequired,
  checked: PropTypes.bool,
  onCheck: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onBuy: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};

const WishlistList = ({ items, canShop }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notify = useNotify();
  const [selected, setSelected] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const shown = useMemo(
    () =>
      items.filter((p) =>
        `${p.title} ${p.brand?.name || ''} ${p.category?.name || ''}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      ),
    [items, q]
  );
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const onPage = shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const chosen = items.filter((p) => selected.includes(p.id));
  const allOn = shown.length > 0 && shown.every((p) => selected.includes(p.id));

  const add = async (p, { quiet } = {}) => {
    if (p.hasOptions) {
      navigate(`/products/${p.id}`);
      return false;
    }
    await dispatch(
      addToCart({ product: p, quantity: 1, options: {} })
    ).unwrap();
    if (!quiet) notify.success(`${p.title} added to your cart.`);
    return true;
  };
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (message) {
      notify.error(message);
    } finally {
      setBusy(false);
    }
  };
  const remove = (ids) =>
    run(async () => {
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await dispatch(removeFromWishlist(id)).unwrap();
      }
      setSelected((s) => s.filter((id) => !ids.includes(id)));
      notify.success(
        ids.length === 1
          ? 'Removed from your wishlist.'
          : `Removed ${ids.length} items.`
      );
    });
  const addSelected = () =>
    run(async () => {
      const simple = chosen.filter((p) => !p.hasOptions);
      for (const p of simple) {
        // eslint-disable-next-line no-await-in-loop
        await add(p, { quiet: true });
      }
      const skipped = chosen.length - simple.length;
      notify.success(
        `Added ${simple.length} item${simple.length === 1 ? '' : 's'} to your cart.` +
          (skipped
            ? ` ${skipped} need options chosen on the product page.`
            : '')
      );
    });

  if (!items.length) {
    return (
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
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        sx={{ bgcolor: 'background.neutral', borderRadius: 1, px: 2, py: 1.5 }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flex: 1 }}
          flexWrap="wrap"
          useFlexGap
        >
          <Checkbox
            checked={allOn}
            indeterminate={!allOn && shown.some((p) => selected.includes(p.id))}
            onChange={(e) =>
              setSelected(e.target.checked ? shown.map((p) => p.id) : [])
            }
            inputProps={{ 'aria-label': 'Select all' }}
          />
          {canShop && (
            <Button
              size="small"
              startIcon={<FiShoppingCart />}
              disabled={!chosen.length || busy}
              onClick={addSelected}
              sx={{ bgcolor: 'background.paper' }}
            >
              Add to cart
            </Button>
          )}
          <Button
            size="small"
            color="error"
            startIcon={<FiTrash2 />}
            disabled={!chosen.length || busy}
            onClick={() => remove(chosen.map((p) => p.id))}
            sx={{ bgcolor: 'background.paper' }}
          >
            Delete items
          </Button>
          {chosen.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {chosen.length} selected
            </Typography>
          )}
        </Stack>
        <TextField
          size="small"
          placeholder="Search for an item"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputProps={{ 'aria-label': 'Search your wishlist' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FiSearch />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: { sm: 260 },
            bgcolor: 'background.paper',
            borderRadius: '8px',
          }}
        />
      </Stack>
      {onPage.map((p) => (
        <WishlistItem
          key={p.id}
          product={p}
          busy={busy}
          checked={selected.includes(p.id)}
          onCheck={(on) =>
            setSelected((s) =>
              on ? [...s, p.id] : s.filter((id) => id !== p.id)
            )
          }
          onAdd={() => run(() => add(p))}
          onBuy={() =>
            run(async () => {
              if (await add(p, { quiet: true })) navigate('/checkout');
            })
          }
          onRemove={() => remove([p.id])}
        />
      ))}
      {!shown.length && (
        <Typography color="text.secondary" sx={{ px: 1 }}>
          Nothing in your wishlist matches “{q.trim()}”.
        </Typography>
      )}
      {shown.length > PAGE_SIZE && (
        <Box
          sx={{
            borderRadius: 1,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <StandardPagination
            count={shown.length}
            page={current}
            rowsPerPage={PAGE_SIZE}
            label="items"
            maxShowAll={0}
            onRowsPerPageChange={() => {}}
            onPageChange={(_, p) => setPage(p)}
          />
        </Box>
      )}
    </Stack>
  );
};
WishlistList.propTypes = {
  items: PropTypes.array.isRequired,
  canShop: PropTypes.bool,
};

/** /account/wishlist — inside the account layout. */
export const AccountWishlistPage = () => {
  const items = useSelector((s) => s.wishlist.items);
  return (
    <AccountPage
      title="Wishlist"
      subtitle={`${items.length} saved item${items.length === 1 ? '' : 's'}`}
      action={
        <Button component={RouterLink} to="/products">
          Continue shopping
        </Button>
      }
    >
      <WishlistList items={items} canShop />
    </AccountPage>
  );
};

/** /wishlist — guests; signed-in shoppers move to their account. */
const WishlistPage = () => {
  const { user } = useContext(AuthContext);
  const items = useSelector((s) => s.wishlist.items);
  if (user) return <Navigate to="/account/wishlist" replace />;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
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
      <WishlistList items={items} canShop />
    </Container>
  );
};

export default WishlistPage;
