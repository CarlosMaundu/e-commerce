// src/pages/ProductDetailsPage.js — product page with variant selection (each
// combination has its own price, stock and photos), reviews and related items.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Link,
  Rating,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  FiCheck,
  FiHeart,
  FiMinus,
  FiPlus,
  FiShoppingCart,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { canShop } from '../auth/permissions';
import { catalog } from '../api';
import { addToCart } from '../redux/cartSlice';
import {
  addToWishlist,
  isInWishlist,
  removeFromWishlist,
} from '../redux/wishlistSlice';
import { useNotify } from '../notification/NotificationProvider';
import ProductCard from '../components/common/ProductCard';
import { EmptyState } from '../components/ui';
import { formatDate, formatMoney } from '../utils/format';
import { isColorAttribute, swatchFor } from '../utils/colors';
import { friendlyError } from '../utils/friendlyError';

const matches = (options, selected, ignore) =>
  Object.entries(selected).every(
    ([k, v]) => k === ignore || !v || options[k] === v
  );

// ---------- gallery ----------

const Gallery = ({ images, title }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [images]);
  const current = images[index] || images[0];
  return (
    <Stack direction={{ xs: 'column-reverse', md: 'row' }} spacing={1.5}>
      {images.length > 1 && (
        <Stack
          direction={{ xs: 'row', md: 'column' }}
          spacing={1}
          sx={{ overflow: 'auto', maxHeight: { md: 560 } }}
        >
          {images.map((src, i) => (
            <Box
              key={src}
              component="button"
              type="button"
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              sx={{
                p: 0,
                width: 72,
                height: 72,
                flexShrink: 0,
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: 2,
                borderColor: i === index ? 'primary.main' : 'transparent',
                bgcolor: 'transparent',
              }}
            >
              <Box
                component="img"
                src={src}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>
          ))}
        </Stack>
      )}
      <Box
        sx={{
          flex: 1,
          aspectRatio: '1 / 1',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {current && (
          <Box
            component="img"
            src={current}
            alt={title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
      </Box>
    </Stack>
  );
};

Gallery.propTypes = {
  images: PropTypes.array.isRequired,
  title: PropTypes.string,
};

// ---------- option pickers ----------

const OptionPicker = ({ attribute, selected, onSelect, available }) => {
  const colour = isColorAttribute(attribute.name);
  const value = selected[attribute.name];
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {attribute.name}
        {value && (
          <Typography
            component="span"
            color="text.secondary"
            sx={{ ml: 1, fontWeight: 400 }}
          >
            {value}
          </Typography>
        )}
      </Typography>
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1}
        role="radiogroup"
        aria-label={attribute.name}
      >
        {attribute.values.map((v) => {
          const on = value === v;
          const ok = available(attribute.name, v);
          const label = `${attribute.name} ${v}${ok ? '' : ' (out of stock)'}`;
          return colour ? (
            <Tooltip key={v} title={ok ? v : `${v} — out of stock`}>
              <Box
                component="button"
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label}
                onClick={() => onSelect(attribute.name, v)}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: swatchFor(v),
                  border: 2,
                  borderColor: on ? 'primary.main' : 'divider',
                  outline: on ? '2px solid' : 'none',
                  outlineColor: 'background.paper',
                  outlineOffset: -4,
                  opacity: ok ? 1 : 0.35,
                  display: 'grid',
                  placeItems: 'center',
                  color: [
                    'white',
                    'cream',
                    'beige',
                    'silver',
                    'floral',
                  ].includes(v.toLowerCase())
                    ? '#222'
                    : '#fff',
                }}
              >
                {on && <FiCheck />}
              </Box>
            </Tooltip>
          ) : (
            <Chip
              key={v}
              role="radio"
              aria-checked={on}
              aria-label={label}
              label={v}
              clickable
              onClick={() => onSelect(attribute.name, v)}
              color={on ? 'primary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              sx={{
                minWidth: 48,
                height: 36,
                ...(ok
                  ? {}
                  : { textDecoration: 'line-through', opacity: 0.55 }),
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
};

OptionPicker.propTypes = {
  attribute: PropTypes.shape({
    name: PropTypes.string,
    values: PropTypes.array,
  }).isRequired,
  selected: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired,
  available: PropTypes.func.isRequired,
};

// ---------- reviews ----------

const Reviews = ({ product, onAdded }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const notify = useNotify();
  const [data, setData] = useState(null);
  const [limit, setLimit] = useState(5);
  const [form, setForm] = useState({ rating: 0, title: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    catalog
      .reviews(product.id, { limit })
      .then((d) => active && setData(d))
      .catch(
        () =>
          active &&
          setData({
            summary: { average: 0, count: 0, breakdown: {} },
            reviews: [],
          })
      );
    return () => {
      active = false;
    };
  }, [product.id, limit]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { verified } = await catalog.addReview(product.id, form);
      notify.success(
        verified
          ? 'Thanks! Your review is up, marked as a verified purchase.'
          : 'Thanks! Your review is up.'
      );
      setForm({ rating: 0, title: '', text: '' });
      setData(await catalog.reviews(product.id, { limit }));
      onAdded();
    } catch (error) {
      notify.error(error, 'We couldn’t post your review.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Skeleton height={200} />;
  const { summary, reviews } = data;
  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={4}>
        <Box sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 3 }}>
          <Typography variant="h2" component="p">
            {summary.average.toFixed(1)}
          </Typography>
          <Rating value={summary.average} precision={0.1} readOnly />
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {summary.count} review{summary.count === 1 ? '' : 's'}
          </Typography>
          {[5, 4, 3, 2, 1].map((stars) => {
            const n = summary.breakdown[stars] || 0;
            return (
              <Stack
                key={stars}
                direction="row"
                spacing={1}
                alignItems="center"
              >
                <Typography variant="body2" sx={{ width: 44 }}>
                  {stars} star
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={summary.count ? (n / summary.count) * 100 : 0}
                  sx={{ flex: 1, height: 8 }}
                  aria-label={`${n} ${stars}-star reviews`}
                />
                <Typography
                  variant="caption"
                  sx={{ width: 24, textAlign: 'right' }}
                >
                  {n}
                </Typography>
              </Stack>
            );
          })}
        </Box>
        <Box sx={{ mt: 3 }}>
          {!user ? (
            <Typography>
              <Link
                component={RouterLink}
                to="/login"
                state={{ from: location.pathname }}
              >
                Sign in
              </Link>{' '}
              to write a review.
            </Typography>
          ) : canShop(user) && !user.impersonator ? (
            <Box component="form" onSubmit={submit} aria-label="Write a review">
              <Typography variant="h6" sx={{ mb: 1 }}>
                Write a review
              </Typography>
              <Rating
                value={form.rating}
                onChange={(_, v) => setForm({ ...form, rating: v || 0 })}
                aria-label="Your rating"
              />
              <TextField
                label="Title (optional)"
                fullWidth
                size="small"
                margin="dense"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <TextField
                label="Your review"
                fullWidth
                multiline
                minRows={3}
                margin="dense"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={busy}
                sx={{ mt: 1 }}
              >
                {busy ? 'Posting…' : 'Post review'}
              </Button>
            </Box>
          ) : null}
        </Box>
      </Grid>
      <Grid item xs={12} md={8}>
        {!reviews.length ? (
          <EmptyState title="No reviews yet">
            Be the first to share what you think.
          </EmptyState>
        ) : (
          <Stack divider={<Divider />} spacing={2.5} data-testid="reviews">
            {reviews.map((r) => (
              <Box key={r.id}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Rating value={r.rating} readOnly size="small" />
                  <Typography variant="subtitle2">{r.title}</Typography>
                </Stack>
                <Typography sx={{ my: 0.75 }}>{r.text}</Typography>
                <Typography variant="caption">
                  {r.author} · {formatDate(r.createdAt)}
                  {r.verified && (
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      label="Verified purchase"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
        {summary.count > reviews.length && (
          <Button onClick={() => setLimit(limit + 10)} sx={{ mt: 2 }}>
            Show more reviews
          </Button>
        )}
      </Grid>
    </Grid>
  );
};

Reviews.propTypes = {
  product: PropTypes.object.isRequired,
  onAdded: PropTypes.func.isRequired,
};

// ---------- page ----------

const ProductDetailsPage = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const shopper = canShop(user);
  const dispatch = useDispatch();
  const notify = useNotify();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [related, setRelated] = useState([]);
  const [selected, setSelected] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('description');
  const saved = useSelector((s) =>
    product ? isInWishlist(s, product.id) : false
  );

  const load = () =>
    catalog.getProduct(id).then((p) => {
      setProduct(p);
      return p;
    });

  useEffect(() => {
    let active = true;
    setProduct(null);
    setError(null);
    setQuantity(1);
    load()
      .then((p) => {
        if (!active) return;
        // Start on the first combination that is in stock.
        const first = p.variants.find((v) => v.inStock) || p.variants[0];
        setSelected(first ? { ...first.options } : {});
      })
      .catch((e) => active && setError(friendlyError(e)));
    catalog
      .related(id)
      .then((list) => active && setRelated(list))
      .catch(() => {});
    window.scrollTo(0, 0);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const variant = useMemo(
    () =>
      product?.variants.find((v) =>
        product.attributes.every((a) => v.options[a.name] === selected[a.name])
      ) || null,
    [product, selected]
  );

  const images = useMemo(() => {
    if (!product) return [];
    const own = variant?.images || [];
    return [...own, ...product.images.filter((src) => !own.includes(src))];
  }, [product, variant]);

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <EmptyState
          title="We couldn’t find that product"
          action={
            <Button component={RouterLink} to="/products" variant="contained">
              Browse products
            </Button>
          }
        >
          {error}
        </EmptyState>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Skeleton
              variant="rounded"
              sx={{ aspectRatio: '1 / 1', height: 'auto', borderRadius: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton height={60} />
            <Skeleton height={40} width="40%" />
            <Skeleton height={200} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  const hasVariants = product.variants.length > 0;
  const needsChoice = product.attributes.some((a) => !selected[a.name]);
  const source = variant || product;
  const price = source.price;
  const special = source.specialPrice;
  const stock = hasVariants
    ? (variant?.quantity ?? 0)
    : (product.quantity ?? 0);
  const inStock = hasVariants ? Boolean(variant?.inStock) : product.inStock;
  const lowStock =
    product.trackInventory && inStock && stock <= product.lowStockThreshold;
  const maxQty = product.trackInventory ? Math.max(1, Math.min(stock, 99)) : 99;

  const available = (name, value) =>
    !hasVariants ||
    product.variants.some(
      (v) =>
        v.options[name] === value &&
        v.inStock &&
        matches(v.options, selected, name)
    );

  const choose = (name, value) => {
    const next = { ...selected, [name]: value };
    // If that combination doesn't exist, switch the other options to one that does.
    if (
      hasVariants &&
      !product.variants.some((v) => matches(v.options, next))
    ) {
      const fallback =
        product.variants.find((v) => v.options[name] === value && v.inStock) ||
        product.variants.find((v) => v.options[name] === value);
      if (fallback) {
        setSelected({ ...fallback.options });
        setQuantity(1);
        return;
      }
    }
    setSelected(next);
    setQuantity(1);
  };

  const add = async () => {
    if (needsChoice) {
      const missing = product.attributes.find((a) => !selected[a.name]);
      notify.error(`Please choose a ${missing.name.toLowerCase()}.`);
      return;
    }
    try {
      await dispatch(
        addToCart({ product, quantity, options: selected, variant })
      ).unwrap();
      notify.success(`${product.title} added to your cart.`);
    } catch (message) {
      notify.error(message);
    }
  };

  const toggleWishlist = async () => {
    try {
      if (saved) await dispatch(removeFromWishlist(product.id)).unwrap();
      else await dispatch(addToWishlist(product)).unwrap();
    } catch (message) {
      notify.error(message);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Breadcrumbs aria-label="Breadcrumb" sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/" underline="hover">
          Home
        </Link>
        <Link component={RouterLink} to="/products" underline="hover">
          Products
        </Link>
        {product.category && (
          <Link
            component={RouterLink}
            to={`/products?category=${product.category.id}`}
            underline="hover"
          >
            {product.category.name}
          </Link>
        )}
        <Typography color="text.primary">{product.title}</Typography>
      </Breadcrumbs>

      <Grid container spacing={{ xs: 3, md: 6 }}>
        <Grid item xs={12} md={6}>
          <Gallery images={images} title={product.title} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Stack spacing={2.5}>
            <Box>
              {product.brand && (
                <Link
                  component={RouterLink}
                  to={`/products?brand=${product.brand.id}`}
                  underline="hover"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  {product.brand.logo ? (
                    <Box
                      component="img"
                      src={product.brand.logo}
                      alt={product.brand.name}
                      sx={{ height: 28 }}
                    />
                  ) : (
                    product.brand.name
                  )}
                </Link>
              )}
              <Typography variant="h3" component="h1">
                {product.title}
              </Typography>
              {product.rating > 0 && (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mt: 1 }}
                >
                  <Rating
                    value={product.rating}
                    precision={0.1}
                    readOnly
                    size="small"
                  />
                  <Link
                    component="button"
                    type="button"
                    onClick={() => setTab('reviews')}
                    underline="hover"
                  >
                    {product.rating.toFixed(1)} · {product.reviewCount} review
                    {product.reviewCount === 1 ? '' : 's'}
                  </Link>
                </Stack>
              )}
            </Box>

            <Stack
              direction="row"
              spacing={1.5}
              alignItems="baseline"
              data-testid="product-price"
            >
              <Typography variant="h3" component="p">
                {formatMoney(special ?? price)}
              </Typography>
              {special !== null && special !== undefined && (
                <>
                  <Typography
                    color="text.disabled"
                    sx={{ textDecoration: 'line-through' }}
                  >
                    {formatMoney(price)}
                  </Typography>
                  <Chip
                    size="small"
                    color="success"
                    label={`Save ${Math.round(((price - special) / price) * 100)}%`}
                    sx={{ color: '#fff' }}
                  />
                </>
              )}
            </Stack>

            {product.attributes.map((a) => (
              <OptionPicker
                key={a.name}
                attribute={a}
                selected={selected}
                onSelect={choose}
                available={available}
              />
            ))}

            <Typography
              data-testid="stock-status"
              color={
                !inStock
                  ? 'error.main'
                  : lowStock
                    ? 'warning.main'
                    : 'success.main'
              }
              sx={{ fontWeight: 600 }}
            >
              {needsChoice
                ? 'Choose your options to see availability'
                : !inStock
                  ? hasVariants
                    ? 'This combination is out of stock'
                    : 'Out of stock'
                  : lowStock
                    ? `Only ${stock} left`
                    : 'In stock'}
            </Typography>

            {shopper ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Stack
                  direction="row"
                  alignItems="center"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '8px',
                    alignSelf: 'flex-start',
                  }}
                >
                  <IconButton
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <FiMinus />
                  </IconButton>
                  <Typography
                    sx={{ minWidth: 36, textAlign: 'center', fontWeight: 600 }}
                    aria-label="Quantity"
                  >
                    {quantity}
                  </Typography>
                  <IconButton
                    aria-label="Increase quantity"
                    onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                    disabled={quantity >= maxQty}
                  >
                    <FiPlus />
                  </IconButton>
                </Stack>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<FiShoppingCart />}
                  onClick={add}
                  disabled={!needsChoice && !inStock}
                  sx={{ flex: 1 }}
                >
                  Add to cart
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={toggleWishlist}
                  startIcon={<FiHeart fill={saved ? 'currentColor' : 'none'} />}
                  color={saved ? 'error' : 'primary'}
                >
                  {saved ? 'Saved' : 'Save'}
                </Button>
              </Stack>
            ) : (
              <Alert severity="info">
                You’re signed in to the back office, so you can’t shop. To help
                a customer, open them in{' '}
                <Link component={RouterLink} to="/admin/users">
                  Users
                </Link>{' '}
                and choose “View as customer”.
              </Alert>
            )}

            <Divider />
            <Stack spacing={0.75}>
              {(variant?.sku || product.sku) && (
                <Typography variant="body2" color="text.secondary">
                  SKU: {variant?.sku || product.sku}
                </Typography>
              )}
              {product.category && (
                <Typography variant="body2" color="text.secondary">
                  Category:{' '}
                  <Link
                    component={RouterLink}
                    to={`/products?category=${product.category.id}`}
                  >
                    {product.category.name}
                  </Link>
                </Typography>
              )}
              {product.tags.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.75}
                  flexWrap="wrap"
                  useFlexGap
                  alignItems="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    Tags:
                  </Typography>
                  {product.tags.map((t) => (
                    <Chip
                      key={t}
                      size="small"
                      label={`#${t}`}
                      component={RouterLink}
                      to={`/products?tag=${t}`}
                      clickable
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
        </Grid>
      </Grid>

      <Box sx={{ mt: { xs: 5, md: 8 } }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        >
          <Tab value="description" label="Description" />
          <Tab value="reviews" label={`Reviews (${product.reviewCount})`} />
        </Tabs>
        {tab === 'description' ? (
          <Typography sx={{ whiteSpace: 'pre-line', maxWidth: 820 }}>
            {product.description || 'No description yet.'}
          </Typography>
        ) : (
          <Reviews product={product} onAdded={load} />
        )}
      </Box>

      {related.length > 0 && (
        <Box
          component="section"
          sx={{ mt: { xs: 6, md: 9 } }}
          aria-labelledby="related-title"
        >
          <Typography
            variant="h4"
            component="h2"
            id="related-title"
            sx={{ mb: 3 }}
          >
            You may also like
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                lg: 'repeat(5, 1fr)',
              },
              gap: 1.5,
            }}
          >
            {related.slice(0, 5).map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </Box>
        </Box>
      )}
    </Container>
  );
};

export default ProductDetailsPage;
