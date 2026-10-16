// src/components/home/HomeSections.js — home page sections that show live
// data: brands, curated categories, this week's most viewed products and the
// featured product grid.
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { catalog } from '../../api';
import ProductCard from '../common/ProductCard';
import { ProductCardSkeleton } from '../skeletons';

/** Loads once on mount; [] while loading or after an error. */
const useLoad = (load) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let active = true;
    load()
      .then((d) => active && setData(d))
      .catch(() => active && setData([]));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
};

export const SectionTitle = ({ children, action, id }) => (
  <Stack
    direction="row"
    alignItems="center"
    justifyContent={action ? 'space-between' : 'center'}
    sx={{ mb: { xs: 2.5, md: 4 } }}
  >
    <Typography
      variant="h3"
      component="h2"
      id={id}
      sx={{ textAlign: 'center' }}
    >
      {children}
    </Typography>
    {action}
  </Stack>
);

SectionTitle.propTypes = {
  children: PropTypes.node.isRequired,
  action: PropTypes.node,
  id: PropTypes.string,
};

// ---------- brands ----------

export const BrandsStrip = () => {
  const brands = useLoad(() => catalog.brands());
  const navigate = useNavigate();
  const list = (brands || []).filter((b) => b.logo);
  if (brands && !list.length) return null;
  const tile = (b, copy) => (
    <Box
      key={`${b.id}-${copy}`}
      component="button"
      type="button"
      onClick={() => navigate(`/products?brand=${b.id}`)}
      aria-label={copy ? undefined : b.name}
      aria-hidden={copy ? true : undefined}
      tabIndex={copy ? -1 : 0}
      title={b.name}
      sx={{
        flex: '0 0 auto',
        width: { xs: 120, md: 150 },
        height: 84,
        mx: 0.75,
        border: 0,
        borderRadius: 1,
        bgcolor: 'background.neutral',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'background-color .15s',
        '&:hover': { bgcolor: 'background.neutralDeep' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
        },
      }}
    >
      <Box
        component="img"
        src={b.logo}
        alt=""
        sx={{ maxWidth: '62%', maxHeight: 44 }}
      />
    </Box>
  );
  return (
    <Box component="section" aria-labelledby="brands-title">
      <SectionTitle id="brands-title">Our brands</SectionTitle>
      {!brands ? (
        // The logo tiles, same size and spacing.
        <Stack direction="row" sx={{ overflow: 'hidden' }} aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={84}
              sx={{
                flex: '0 0 auto',
                width: { xs: 120, md: 150 },
                mx: 0.75,
                borderRadius: 1,
              }}
            />
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            overflow: 'hidden',
            maskImage:
              'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
            '&:hover .marquee, &:focus-within .marquee': {
              animationPlayState: 'paused',
            },
            '@keyframes marquee': {
              from: { transform: 'translateX(0)' },
              to: { transform: 'translateX(-50%)' },
            },
            '@media (prefers-reduced-motion: reduce)': {
              '& .marquee': { animation: 'none' },
            },
          }}
        >
          {/* Two copies, so the strip loops seamlessly. */}
          <Box
            className="marquee"
            data-testid="brand-marquee"
            sx={{
              display: 'flex',
              width: 'max-content',
              animation: `marquee ${list.length * 2.5}s linear infinite`,
            }}
          >
            {list.map((b) => tile(b, false))}
            {list.map((b) => tile(b, true))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ---------- phones: category circles under the hero ----------

/** Phones: every category with a photo, as circles you swipe through. */
export const CategoryCircles = () => {
  const categories = useLoad(() => catalog.getCategories());
  const list = (categories || []).filter((c) => c.image);
  if (categories && !list.length) return null;
  return (
    <Box
      component="nav"
      aria-label="Shop by category"
      sx={{ display: { xs: 'block', md: 'none' }, mt: 3 }}
    >
      <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
        Categories
      </Typography>

      <Box
        data-testid="curated-circles"
        sx={{
          display: { xs: 'flex', md: 'none' },
          gap: 2,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollPaddingInline: 16,
          mx: -2,
          px: 2,
          pb: 1,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {(categories ? list : Array.from({ length: 5 })).map((cat, i) =>
          cat ? (
            <Box
              key={cat.id}
              component={RouterLink}
              to={`/products?category=${cat.id}`}
              sx={{
                flexShrink: 0,
                width: 76,
                textAlign: 'center',
                textDecoration: 'none',
                color: 'text.primary',
                scrollSnapAlign: 'start',
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  mx: 'auto',
                  borderRadius: '50%',
                  p: '3px',
                  border: 2,
                  borderColor: 'primary.main',
                }}
              >
                <Box
                  component="img"
                  src={cat.image}
                  alt=""
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                noWrap
                component="div"
                sx={{ mt: 0.75, fontWeight: 600, color: 'text.primary' }}
              >
                {cat.name}
              </Typography>
            </Box>
          ) : (
            <Skeleton
              key={i}
              variant="circular"
              width={72}
              height={72}
              sx={{ flexShrink: 0 }}
            />
          )
        )}
      </Box>
    </Box>
  );
};

const TRAIN_SECONDS_PER_CARD = 4;

/**
 * Phones: Curated picks as photo cards moving right to left without end —
 * the list runs twice, side by side, so the loop never shows a gap. Touch
 * or hover pauses it; with reduced motion it's a row you swipe instead.
 */
const CuratedTrain = ({ list }) => {
  const card = (cat, copy) => (
    <Box
      key={`${copy}-${cat.id}`}
      component={RouterLink}
      to={`/products?category=${cat.id}`}
      aria-hidden={copy ? true : undefined}
      tabIndex={copy ? -1 : undefined}
      sx={{
        position: 'relative',
        flex: '0 0 auto',
        width: 168,
        height: 112,
        borderRadius: '12px',
        overflow: 'hidden',
        color: 'common.white',
        textDecoration: 'none',
      }}
    >
      <Box
        component="img"
        src={cat.image}
        alt=""
        loading="lazy"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          p: 1.25,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 100%)',
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }} noWrap>
          {cat.name}
        </Typography>
      </Box>
    </Box>
  );

  if (!list) {
    return (
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ display: { xs: 'flex', md: 'none' }, overflow: 'hidden' }}
      >
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width={168}
            height={112}
            sx={{ flexShrink: 0, borderRadius: '12px' }}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Box
      data-testid="curated-train"
      sx={{
        display: { xs: 'block', md: 'none' },
        mx: -2,
        pl: 2,
        overflow: 'hidden',
        '@media (prefers-reduced-motion: reduce)': { overflowX: 'auto' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          width: 'max-content',
          animation: `curatedTrain ${list.length * TRAIN_SECONDS_PER_CARD}s linear infinite`,
          '&:hover, &:active': { animationPlayState: 'paused' },
          '@keyframes curatedTrain': {
            // One full copy plus its gap: the second copy lands where the
            // first began, so the loop is seamless.
            from: { transform: 'translateX(0)' },
            to: { transform: 'translateX(calc(-50% - 6px))' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        {list.map((cat) => card(cat, 0))}
        {list.map((cat) => card(cat, 1))}
      </Box>
    </Box>
  );
};
CuratedTrain.propTypes = { list: PropTypes.array };

// ---------- curated categories ----------

export const CuratedPicks = () => {
  const categories = useLoad(() => catalog.getCategories());
  const navigate = useNavigate();
  const list = (categories || []).filter((c) => c.image);
  if (categories && !list.length) return null;
  return (
    <Box component="section" aria-labelledby="curated-title">
      <SectionTitle id="curated-title">Curated picks</SectionTitle>
      {/* Phones: the photo cards travel past like a train, round and round. */}
      <CuratedTrain list={categories ? list : null} />
      <Grid container spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
        {(categories ? list : Array.from({ length: 4 })).map((cat, i) => (
          <Grid item xs={6} sm={4} md={3} lg key={cat?.id ?? i}>
            {cat ? (
              <Card
                onClick={() => navigate(`/products?category=${cat.id}`)}
                sx={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  height: { xs: 110, md: 140 },
                  transition: 'transform .3s ease, box-shadow .3s ease',
                  '&:hover': {
                    transform: 'scale(1.03)',
                    boxShadow: '0 4px 10px rgba(0,0,0,.2)',
                  },
                }}
              >
                <CardActionArea sx={{ height: '100%' }} aria-label={cat.name}>
                  <Box
                    component="img"
                    src={cat.image}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(0,0,0,.32)',
                    }}
                  >
                    <Typography
                      sx={{
                        color: '#fff',
                        fontWeight: 700,
                        textShadow: '0 1px 3px rgba(0,0,0,.8)',
                      }}
                    >
                      {cat.name}
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            ) : (
              <Skeleton
                variant="rounded"
                height={140}
                sx={{ borderRadius: '12px' }}
              />
            )}
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// ---------- best viewed this week ----------

export const BestViewed = () => {
  const products = useLoad(() =>
    catalog.getProducts({ sort: 'popular', limit: 12 })
  );
  // Phones: the top four in two rows, then the full list.
  const phone = useMediaQuery((t) => t.breakpoints.down('md'));
  const rail = useRef(null);
  const scroll = (dir) =>
    rail.current?.scrollBy({
      left: dir * rail.current.clientWidth * 0.8,
      behavior: 'smooth',
    });
  if (products && !products.length) return null;
  if (phone) {
    return (
      <Box component="section" aria-labelledby="best-viewed-title">
        <SectionTitle id="best-viewed-title">
          Best viewed this week
        </SectionTitle>
        <Box
          data-testid="best-viewed"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1.5,
          }}
        >
          {(products || Array.from({ length: 4 }))
            .slice(0, 4)
            .map((p, i) =>
              p ? (
                <ProductCard key={p.id} product={p} compact />
              ) : (
                <ProductCardSkeleton key={i} compact />
              )
            )}
        </Box>
        <Box sx={{ textAlign: 'center', mt: 2.5 }}>
          <Button
            component={RouterLink}
            to="/products?sort=popular"
            variant="contained"
            size="large"
            sx={{ borderRadius: 99, px: 4 }}
          >
            View more
          </Button>
        </Box>
      </Box>
    );
  }
  return (
    <Box component="section" aria-labelledby="best-viewed-title">
      <SectionTitle id="best-viewed-title">Best viewed this week</SectionTitle>
      <Box sx={{ position: 'relative' }}>
        <IconButton
          aria-label="Scroll left"
          onClick={() => scroll(-1)}
          sx={{
            position: 'absolute',
            left: -8,
            top: '40%',
            zIndex: 1,
            bgcolor: 'background.paper',
            boxShadow: 1,
            display: { xs: 'none', md: 'inline-flex' },
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <FiChevronLeft />
        </IconButton>
        <Box
          ref={rail}
          data-testid="best-viewed"
          sx={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: {
              xs: '62%',
              sm: '36%',
              md: '24%',
              lg: 'calc((100% - 5 * 12px) / 6)',
            },
            gap: 1.5,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            pb: 1,
            scrollbarWidth: 'thin',
            '& > *': { scrollSnapAlign: 'start' },
          }}
        >
          {(products || Array.from({ length: 6 })).map((p, i) =>
            p ? (
              <ProductCard key={p.id} product={p} compact />
            ) : (
              <ProductCardSkeleton key={i} compact />
            )
          )}
        </Box>
        <IconButton
          aria-label="Scroll right"
          onClick={() => scroll(1)}
          sx={{
            position: 'absolute',
            right: -8,
            top: '40%',
            zIndex: 1,
            bgcolor: 'background.paper',
            boxShadow: 1,
            display: { xs: 'none', md: 'inline-flex' },
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <FiChevronRight />
        </IconButton>
      </Box>
    </Box>
  );
};

// ---------- featured grid ----------

// 2 rows × 7 columns on desktop. Narrower screens show only full rows:
// 12 at 3 or 4 columns, all 14 at 2 — never one card alone on a row.
const FEATURED_COUNT = 14;

export const FeaturedGrid = () => {
  const products = useLoad(async () => {
    const featured = await catalog.getProducts({
      featured: true,
      limit: FEATURED_COUNT,
    });
    if (featured.length >= FEATURED_COUNT) return featured;
    // Top up with the newest products.
    const newest = await catalog.getProducts({ limit: FEATURED_COUNT * 2 });
    const ids = new Set(featured.map((p) => p.id));
    return [...featured, ...newest.filter((p) => !ids.has(p.id))].slice(
      0,
      FEATURED_COUNT
    );
  });
  if (products && !products.length) return null;
  return (
    <Box component="section" aria-labelledby="featured-title">
      <SectionTitle id="featured-title">
        Featured products just for you
      </SectionTitle>
      <Box
        data-testid="featured-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
            lg: 'repeat(7, minmax(0, 1fr))',
          },
          gap: { xs: 1, md: 1.5 },
          '@media (min-width: 600px) and (max-width: 1199.95px)': {
            '& > :nth-of-type(n + 13)': { display: 'none' },
          },
        }}
      >
        {(products || Array.from({ length: FEATURED_COUNT })).map((p, i) =>
          p ? (
            <ProductCard key={p.id} product={p} />
          ) : (
            <ProductCardSkeleton key={i} />
          )
        )}
      </Box>
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          component={RouterLink}
          to="/products"
          variant="contained"
          endIcon={<FiArrowRight />}
        >
          Load more products
        </Button>
      </Box>
    </Box>
  );
};
