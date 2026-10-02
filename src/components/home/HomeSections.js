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
} from '@mui/material';
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { catalog } from '../../api';
import ProductCard from '../common/ProductCard';

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
  const list = (brands || []).filter((b) => b.productCount > 0);
  if (brands && !list.length) return null;
  return (
    <Box component="section" aria-labelledby="brands-title">
      <SectionTitle id="brands-title">Our brands</SectionTitle>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(4, 1fr)',
            lg: 'repeat(8, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {(brands ? list : Array.from({ length: 8 })).map((b, i) =>
          b ? (
            <Card
              key={b.id}
              sx={{
                bgcolor: 'background.neutral',
                transition: 'background-color .15s',
                '&:hover': { bgcolor: 'background.neutralDeep' },
              }}
            >
              <CardActionArea
                onClick={() => navigate(`/products?brand=${b.id}`)}
                aria-label={`${b.name}, ${b.productCount} products`}
                sx={{
                  height: 88,
                  display: 'grid',
                  placeItems: 'center',
                  px: 2,
                }}
              >
                {b.logo ? (
                  <Box
                    component="img"
                    src={b.logo}
                    alt=""
                    sx={{ maxWidth: '100%', maxHeight: 56 }}
                  />
                ) : (
                  <Typography variant="subtitle1">{b.name}</Typography>
                )}
              </CardActionArea>
            </Card>
          ) : (
            <Skeleton
              key={i}
              variant="rounded"
              height={88}
              sx={{ borderRadius: 1 }}
            />
          )
        )}
      </Box>
    </Box>
  );
};

// ---------- curated categories ----------

export const CuratedPicks = () => {
  const categories = useLoad(() => catalog.getCategories());
  const navigate = useNavigate();
  const list = (categories || []).filter((c) => c.image);
  if (categories && !list.length) return null;
  return (
    <Box component="section" aria-labelledby="curated-title">
      <SectionTitle id="curated-title">Curated picks</SectionTitle>
      <Grid container spacing={2}>
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
  const rail = useRef(null);
  const scroll = (dir) =>
    rail.current?.scrollBy({
      left: dir * rail.current.clientWidth * 0.8,
      behavior: 'smooth',
    });
  if (products && !products.length) return null;
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
              <Skeleton
                key={i}
                variant="rounded"
                height={320}
                sx={{ borderRadius: 1 }}
              />
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

const FEATURED_COUNT = 15; // 3 rows × 5 columns on desktop

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
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(4, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: { xs: 1, md: 1.5 },
        }}
      >
        {(products || Array.from({ length: 10 })).map((p, i) =>
          p ? (
            <ProductCard key={p.id} product={p} />
          ) : (
            <Skeleton
              key={i}
              variant="rounded"
              height={380}
              sx={{ borderRadius: 1 }}
            />
          )
        )}
      </Box>
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          component={RouterLink}
          to="/products"
          variant="contained"
          size="large"
          endIcon={<FiArrowRight />}
          sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: '#000' } }}
        >
          Load more products
        </Button>
      </Box>
    </Box>
  );
};
