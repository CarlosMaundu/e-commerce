// src/pages/ProductDetailsPage.js — product page with variant selection (each
// combination has its own price, stock and photos), reviews and related items.
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  FiCheck,
  FiChevronDown,
  FiHeart,
  FiMinus,
  FiPlus,
  FiRotateCcw,
  FiShare2,
  FiShield,
  FiStar,
  FiShoppingCart,
  FiTruck,
} from 'react-icons/fi';
import BoughtTogether from '../components/product/BoughtTogether';
import Gallery from '../components/product/Gallery';
import BuyDock from '../components/product/BuyDock';
import { usePageHeader } from '../components/layout/pageHeader';
import { useStore } from '../context/StoreContext';
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
import { ItemRowsSkeleton, LinesSkeleton } from '../components/skeletons';
import PageBreadcrumbs from '../components/common/PageBreadcrumbs';
import { EmptyState } from '../components/ui';
import RichText from '../components/common/RichText';
import Specifications, { specRows } from '../components/product/Specifications';
import { formatDate, formatMoney } from '../utils/format';
import { isColorAttribute, swatchFor } from '../utils/colors';
import { friendlyError } from '../utils/friendlyError';

const matches = (options, selected, ignore) =>
  Object.entries(selected).every(
    ([k, v]) => k === ignore || !v || options[k] === v
  );

// ---------- option pickers ----------

const OptionPicker = ({ attribute, selected, onSelect, available }) => {
  const colour = isColorAttribute(attribute.name);
  const value = selected[attribute.name];
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 600 }}>
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
                  width: 30,
                  height: 30,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: 14,
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
              size="small"
              sx={{
                minWidth: 44,
                height: 30,
                fontSize: '0.85rem',
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

  if (!data) {
    return (
      <Grid container spacing={4} aria-busy="true">
        <Grid item xs={12} md={4}>
          <Skeleton variant="text" width={80} sx={{ fontSize: '2.4rem' }} />
          <Skeleton variant="text" width={120} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="text" height={28} />
          ))}
        </Grid>
        <Grid item xs={12} md={8}>
          <ItemRowsSkeleton rows={3} image={40} amount={false} />
        </Grid>
      </Grid>
    );
  }
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

/** The product page's shape while it loads: gallery, title, price, options, buttons. */
const ProductPageSkeleton = () => (
  <Container
    maxWidth="xl"
    sx={{ py: { xs: 3, md: 4 } }}
    data-testid="page-loading"
    aria-busy="true"
  >
    <Skeleton variant="text" width={280} sx={{ mb: 3 }} />
    <Grid container spacing={{ xs: 3, md: 5 }}>
      <Grid item xs={12} md={6} lg={5}>
        <Skeleton
          variant="rounded"
          sx={{ aspectRatio: '1 / 1', height: 'auto', borderRadius: 1 }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" width={64} height={64} />
          ))}
        </Stack>
      </Grid>
      <Grid item xs={12} md={6} lg={7}>
        <Stack spacing={2.25} sx={{ maxWidth: 640 }}>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="rounded" width={72} height={36} />
              <Skeleton
                variant="text"
                width="55%"
                sx={{ fontSize: '1.5rem' }}
              />
            </Stack>
            <Skeleton variant="text" width={260} sx={{ mt: 1.25 }} />
          </Box>
          <Skeleton variant="rounded" height={84} />
          {[0, 1].map((i) => (
            <Box key={i}>
              <Skeleton variant="text" width={90} />
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                {[0, 1, 2, 3].map((j) => (
                  <Skeleton key={j} variant="rounded" width={56} height={36} />
                ))}
              </Stack>
            </Box>
          ))}
          <Stack direction="row" spacing={1.5}>
            <Skeleton variant="rounded" width={128} height={48} />
            <Skeleton variant="rounded" height={48} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" width={48} height={48} />
          </Stack>
          <LinesSkeleton lines={3} />
        </Stack>
      </Grid>
    </Grid>
  </Container>
);

const ProductDetailsPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const shop = useStore();
  const { user } = useContext(AuthContext);
  const shopper = canShop(user);
  const dispatch = useDispatch();
  const notify = useNotify();
  const navigate = useNavigate();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const optionsRef = useRef(null);
  const detailsRef = useRef(null);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [related, setRelated] = useState([]);
  const [selected, setSelected] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('description');
  // Phones: the header shows the product's name once its heading scrolls away.
  const titleRef = useRef(null);
  const [pastTitle, setPastTitle] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => setPastTitle(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  });
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
        // Options in the link (e.g. from an order: ?Color=Blue&Size=M) win;
        // otherwise start on the first combination that is in stock.
        const query = new URLSearchParams(location.search);
        const asked = p.variants.find((v) =>
          p.attributes.every((at) => query.get(at.name) === v.options[at.name])
        );
        const first =
          asked || p.variants.find((v) => v.inStock) || p.variants[0];
        setSelected(first ? { ...first.options } : {});
      })
      .catch((e) => active && setError(friendlyError(e)));
    catalog
      .related(id)
      .then((list) => active && setRelated(list))
      .catch(() => {});
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

  // Photos follow what's chosen so far (e.g. a colour before a size): only
  // the chosen variation's photos are shown, never the rest of the gallery.
  const images = useMemo(() => {
    if (!product) return [];
    if (variant?.images?.length) return variant.images;
    const chosen = Object.values(selected).some(Boolean);
    const matching = product.variants.filter((v) =>
      Object.entries(selected).every(([k, val]) => !val || v.options[k] === val)
    );
    if (!chosen || !matching.length) return product.images;
    const shared = (matching[0].images || []).filter((src) =>
      matching.every((v) => (v.images || []).includes(src))
    );
    if (shared.length) return shared;
    const union = [...new Set(matching.flatMap((v) => v.images || []))];
    return union.length ? union : product.images;
  }, [product, variant, selected]);

  // A variant's own description (when the product uses variant content).
  const description =
    (product?.variantContent && variant?.description) || product?.description;

  // Phones: Back · "Product details" (the product's name once its heading has
  // scrolled away) · Share and Wishlist.
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        notify.success('Link copied.');
      }
    } catch {
      // closed the share sheet: nothing to do
    }
  };
  const headerActions =
    phone && product ? (
      <>
        <IconButton
          aria-label="Share"
          onClick={share}
          sx={{
            width: 44,
            height: 44,
            borderRadius: '8px',
            bgcolor: 'background.neutral',
          }}
        >
          <FiShare2 />
        </IconButton>
        {shopper && (
          <IconButton
            aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={saved}
            onClick={async () => {
              try {
                if (saved)
                  await dispatch(removeFromWishlist(product.id)).unwrap();
                else await dispatch(addToWishlist(product)).unwrap();
              } catch (message) {
                notify.error(message);
              }
            }}
            sx={{
              width: 44,
              height: 44,
              borderRadius: '8px',
              bgcolor: 'background.neutral',
              color: saved ? 'error.main' : 'text.primary',
            }}
          >
            <FiHeart fill={saved ? 'currentColor' : 'none'} />
          </IconButton>
        )}
      </>
    ) : null;
  usePageHeader({
    title: pastTitle && product ? product.title : 'Product details',
    actions: headerActions,
  });

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

  if (!product) return <ProductPageSkeleton />;

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
      optionsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return false;
    }
    try {
      await dispatch(
        addToCart({ product, quantity, options: selected, variant })
      ).unwrap();
      notify.success(`${product.title} added to your cart.`);
      return true;
    } catch (message) {
      notify.error(message);
      return false;
    }
  };

  /** Phones: add it and go straight to checkout. */
  const buyNow = async () => {
    if (await add()) navigate('/checkout');
  };

  const toggleWishlist = async () => {
    try {
      if (saved) await dispatch(removeFromWishlist(product.id)).unwrap();
      else await dispatch(addToWishlist(product)).unwrap();
    } catch (message) {
      notify.error(message);
    }
  };

  const sections = [
    {
      value: 'description',
      label: 'Description',
      content: description ? (
        <RichText
          html={description}
          sx={{ maxWidth: 820 }}
          data-testid="product-description"
        />
      ) : (
        <Typography color="text.secondary">No description yet.</Typography>
      ),
    },
    {
      value: 'specifications',
      label: 'Specifications',
      content: <Specifications product={product} variant={variant} />,
    },
    ...(phone
      ? [
          {
            value: 'delivery',
            label: 'Delivery & returns',
            content: (
              <Stack spacing={1.5}>
                <Typography variant="body2">
                  <strong>Delivery: </strong>
                  {shop.finance?.freeShippingOver
                    ? `free on orders over ${formatMoney(shop.finance.freeShippingOver)}; the cost for your address shows at checkout.`
                    : 'the cost for your address shows at checkout.'}
                </Typography>
                <Typography variant="body2">
                  <strong>Returns: </strong>
                  {shop.returns?.windowDays
                    ? `return delivered items within ${shop.returns.windowDays} days from your account.`
                    : 'return delivered items from your account.'}{' '}
                  <Link component={RouterLink} to="/policies/refunds">
                    Refund & return policy
                  </Link>
                </Typography>
                <Typography variant="body2">
                  <strong>Payment: </strong>card or cash on delivery, kept
                  secure.
                </Typography>
              </Stack>
            ),
          },
        ]
      : []),
    {
      value: 'reviews',
      label: `Reviews (${product.reviewCount})`,
      content: <Reviews product={product} onAdded={load} />,
    },
  ];

  /** Opens a section (the rating link, "All specifications") and shows it. */
  const openSection = (value) => {
    setTab(value);
    requestAnimationFrame(() =>
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <PageBreadcrumbs
        sx={{ mb: 3 }}
        items={[
          { label: 'Home', to: '/' },
          { label: 'Products', to: '/products' },
          ...(product.category
            ? [
                {
                  label: product.category.name,
                  to: `/products?category=${product.category.id}`,
                },
              ]
            : []),
          { label: product.title, to: `/products/${product.id}` },
        ]}
      />

      <Grid container spacing={{ xs: 3, md: 5 }}>
        <Grid item xs={12} md={6} lg={5}>
          <Gallery images={images} title={product.title} />
        </Grid>
        <Grid item xs={12} md={6} lg={7}>
          <Stack spacing={2.25} sx={{ maxWidth: 640 }}>
            {/* Brand logo – product name, then rating, SKU and category. */}
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                flexWrap="wrap"
                useFlexGap
              >
                {product.brand && (
                  <>
                    <Box
                      component={RouterLink}
                      to={`/products?brand=${product.brand.id}`}
                      aria-label={`More from ${product.brand.name}`}
                      title={product.brand.name}
                      sx={{
                        height: 36,
                        minWidth: 36,
                        px: product.brand.logo ? 1 : 1.5,
                        borderRadius: '8px',
                        border: 1,
                        borderColor: 'divider',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'text.primary',
                        textDecoration: 'none',
                        fontWeight: 700,
                        flexShrink: 0,
                        '&:hover': { borderColor: 'primary.main' },
                      }}
                    >
                      {product.brand.logo ? (
                        <Box
                          component="img"
                          src={product.brand.logo}
                          alt={product.brand.name}
                          sx={{
                            height: 20,
                            maxWidth: 80,
                            objectFit: 'contain',
                          }}
                        />
                      ) : (
                        product.brand.name
                      )}
                    </Box>
                    <Box
                      aria-hidden
                      sx={{
                        width: 2,
                        height: 22,
                        bgcolor: 'divider',
                        borderRadius: 1,
                      }}
                    />
                  </>
                )}
                <Typography
                  ref={titleRef}
                  variant="h5"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.3rem', md: '1.5rem' },
                    letterSpacing: '-0.01em',
                    minWidth: 0,
                  }}
                >
                  {product.title}
                </Typography>
              </Stack>
              {/* Phones: a rating chip and the category; SKU is under
                  Specifications. */}
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 1.25, display: { xs: 'flex', md: 'none' } }}
              >
                {product.rating > 0 && (
                  <Chip
                    size="small"
                    icon={<FiStar fill="currentColor" />}
                    label={`${product.rating.toFixed(1)} (${product.reviewCount})`}
                    onClick={() => openSection('reviews')}
                    aria-label={`Rated ${product.rating.toFixed(1)}, ${product.reviewCount} reviews`}
                    sx={{
                      height: 28,
                      bgcolor: 'warning.light',
                      color: 'text.primary',
                      '& .MuiChip-icon': { color: 'warning.main' },
                    }}
                  />
                )}
                {product.category && (
                  <Chip
                    size="small"
                    component={RouterLink}
                    to={`/products?category=${product.category.id}`}
                    clickable
                    label={product.category.name}
                    variant="outlined"
                    sx={{ height: 28 }}
                  />
                )}
              </Stack>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{
                  mt: 1.25,
                  color: 'text.secondary',
                  display: { xs: 'none', md: 'flex' },
                }}
                divider={
                  <Box component="span" sx={{ color: 'divider' }}>
                    |
                  </Box>
                }
              >
                {product.rating > 0 && (
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Rating
                      value={product.rating}
                      precision={0.1}
                      readOnly
                      size="small"
                    />
                    <Link
                      component="button"
                      type="button"
                      onClick={() => openSection('reviews')}
                      underline="hover"
                      variant="body2"
                    >
                      {product.rating.toFixed(1)} · {product.reviewCount} review
                      {product.reviewCount === 1 ? '' : 's'}
                    </Link>
                  </Stack>
                )}
                {(variant?.sku || product.sku) && (
                  <Typography variant="body2">
                    SKU {variant?.sku || product.sku}
                  </Typography>
                )}
                {product.category && (
                  <Link
                    component={RouterLink}
                    to={`/products?category=${product.category.id}`}
                    variant="body2"
                    underline="hover"
                  >
                    {product.category.name}
                  </Link>
                )}
              </Stack>
            </Box>

            {/* Price and availability (phones: plain, the buy bar acts) */}
            <Box
              sx={{
                bgcolor: { xs: 'transparent', md: 'background.neutral' },
                borderRadius: 1,
                px: { xs: 0, md: 2 },
                py: { xs: 0, md: 1.5 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="baseline"
                  flexWrap="wrap"
                  useFlexGap
                  data-testid="product-price"
                >
                  <Typography
                    component="p"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '1.25rem', md: '1.4rem' },
                      letterSpacing: '-0.01em',
                    }}
                  >
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
                <Typography variant="caption">
                  {shop.finance?.pricesIncludeTax
                    ? `Includes ${shop.finance.taxLabel} · delivery calculated at checkout`
                    : `${shop.finance?.taxLabel || 'Tax'} and delivery calculated at checkout`}
                </Typography>
              </Box>
              <Box
                data-testid="stock-status"
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: needsChoice
                    ? 'text.secondary'
                    : !inStock
                      ? 'error.main'
                      : lowStock
                        ? 'warning.main'
                        : 'success.main',
                  bgcolor: 'background.paper',
                }}
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
              </Box>
            </Box>

            {product.attributes.length > 0 && (
              <Stack spacing={1.75} ref={optionsRef}>
                {product.attributes.map((a) => (
                  <OptionPicker
                    key={a.name}
                    attribute={a}
                    selected={selected}
                    onSelect={choose}
                    available={available}
                  />
                ))}
              </Stack>
            )}

            {shopper ? (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Stack
                  direction="row"
                  alignItems="center"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '8px',
                    height: 40,
                    flexShrink: 0,
                  }}
                >
                  <IconButton
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    sx={{ borderRadius: '8px', width: 36, height: 36 }}
                  >
                    <FiMinus size={14} />
                  </IconButton>
                  <Typography
                    sx={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}
                    aria-label="Quantity"
                  >
                    {quantity}
                  </Typography>
                  <IconButton
                    aria-label="Increase quantity"
                    onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                    disabled={quantity >= maxQty}
                    sx={{ borderRadius: '8px', width: 36, height: 36 }}
                  >
                    <FiPlus size={14} />
                  </IconButton>
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<FiShoppingCart />}
                  onClick={add}
                  disabled={!needsChoice && !inStock}
                  // Phones use the buy bar at the bottom of the screen.
                  sx={{
                    flex: 1,
                    maxWidth: 300,
                    height: 40,
                    display: { xs: 'none', md: 'inline-flex' },
                  }}
                >
                  Add to cart
                </Button>
                <Tooltip
                  title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <IconButton
                    onClick={toggleWishlist}
                    aria-label={
                      saved ? 'Remove from wishlist' : 'Add to wishlist'
                    }
                    sx={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: '8px',
                      border: 1,
                      borderColor: saved ? 'error.main' : 'divider',
                      color: saved ? 'error.main' : 'text.secondary',
                      // Phones: it's in the header.
                      display: { xs: 'none', md: 'inline-flex' },
                    }}
                  >
                    <FiHeart fill={saved ? 'currentColor' : 'none'} />
                  </IconButton>
                </Tooltip>
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

            {shopper && (
              <BoughtTogether
                product={product}
                options={selected}
                variant={variant}
                price={special ?? price}
                needsChoice={needsChoice}
              />
            )}

            {/* Reassurance */}
            <Box
              sx={{
                // Phones: under "Delivery & returns" below.
                display: { xs: 'none', md: 'grid' },
                gap: 1.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {[
                [
                  <FiTruck key="t" />,
                  'Delivery',
                  shop.finance?.freeShippingOver
                    ? `Free over ${formatMoney(shop.finance.freeShippingOver)}`
                    : 'Delivered in 1–5 days',
                ],
                [
                  <FiRotateCcw key="r" />,
                  'Easy returns',
                  'Return delivered items from your account',
                ],
                [
                  <FiShield key="s" />,
                  'Secure payment',
                  'Card or cash on delivery',
                ],
              ].map(([icon, title, text]) => (
                <Stack
                  key={title}
                  direction="row"
                  spacing={1.5}
                  sx={{
                    p: 1.25,
                    borderRadius: '8px',
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ color: 'primary.main', fontSize: 17, mt: 0.25 }}>
                    {icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">{title}</Typography>
                    <Typography variant="caption" component="div">
                      {text}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>

            {product.tags.length > 0 && (
              <Stack
                direction="row"
                spacing={0.75}
                flexWrap="wrap"
                useFlexGap
                alignItems="center"
              >
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
        </Grid>
      </Grid>

      <Box
        sx={{
          mt: { xs: 5, md: 8 },
          display: 'grid',
          gap: { xs: 3, lg: 5 },
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1fr) 360px',
          },
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0, scrollMarginTop: 96 }} ref={detailsRef}>
          {phone ? (
            // Phones: one section open at a time, so the page stays short.
            sections.map((sec) => (
              <Accordion
                key={sec.value}
                disableGutters
                expanded={tab === sec.value}
                onChange={(_, open) => setTab(open ? sec.value : '')}
                sx={{
                  bgcolor: 'transparent',
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&::before': { display: 'none' },
                }}
              >
                <AccordionSummary
                  expandIcon={<FiChevronDown />}
                  sx={{ px: 0, minHeight: 56 }}
                >
                  <Typography variant="h6" component="h2">
                    {sec.label}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0, pb: 3 }}>
                  {sec.content}
                </AccordionDetails>
              </Accordion>
            ))
          ) : (
            <>
              <Tabs
                value={tab || false}
                onChange={(_, v) => setTab(v)}
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
              >
                {sections.map((sec) => (
                  <Tab key={sec.value} value={sec.value} label={sec.label} />
                ))}
              </Tabs>
              {sections.find((sec) => sec.value === tab)?.content}
            </>
          )}
        </Box>
        {specRows(product, variant).length > 0 && (
          <Box
            component="aside"
            aria-label="At a glance"
            sx={{
              bgcolor: 'background.neutral',
              borderRadius: 1,
              p: 3,
              position: { lg: 'sticky' },
              top: { lg: 200 },
            }}
          >
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              At a glance
            </Typography>
            <Stack spacing={1.5} divider={<Divider />}>
              {specRows(product, variant)
                .slice(0, 6)
                .map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" component="div">
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
            </Stack>
            <Button
              size="small"
              sx={{ mt: 2, px: 0 }}
              onClick={() => openSection('specifications')}
            >
              All specifications
            </Button>
          </Box>
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
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(5, minmax(0, 1fr))',
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
      {phone && canShop(user) && (
        <BuyDock
          price={special ?? price}
          wasPrice={special != null ? price : null}
          needsChoice={needsChoice}
          inStock={inStock}
          onAdd={add}
          onBuy={buyNow}
        />
      )}
    </Container>
  );
};

export default ProductDetailsPage;
