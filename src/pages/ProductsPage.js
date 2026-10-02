// src/pages/ProductsPage.js — Aurora-style catalogue: compact hero,
// breadcrumb, results bar, filter sidebar and product grid.
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FiFilter, FiX } from 'react-icons/fi';
import PageBreadcrumbs from '../components/common/PageBreadcrumbs';
import HeroSection from '../components/layout/HeroSection';
import ProductCard from '../components/common/ProductCard';
import ProductFilters, {
  useProductQuery,
} from '../components/products/ProductFilters';
import { EmptyState } from '../components/ui';
import { fetchCategories } from '../redux/categoriesSlice';
import { catalog } from '../api';
import { friendlyError } from '../utils/friendlyError';

const PAGE_SIZE = 24;

const SORTS = [
  { value: '', label: 'Newest' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];

/** The chosen category and its parent, from the category tree. */
const findCategory = (tree, id) => {
  for (const c of tree) {
    if (String(c.id) === String(id)) return { category: c, parent: null };
    const sub = (c.subcategories || []).find(
      (s) => String(s.id) === String(id)
    );
    if (sub) return { category: sub, parent: c };
  }
  return { category: null, parent: null };
};

const ProductsPage = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const categories = useSelector((s) => s.categories.categories || []);
  const { filters, update, clearAll } = useProductQuery();
  const [showFilters, setShowFilters] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [facets, setFacets] = useState(null);
  const [result, setResult] = useState({
    products: null,
    total: 0,
    error: null,
  });

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    let active = true;
    catalog
      .filters(filters.categoryIds.join(',') || undefined)
      .then((f) => active && setFacets(f))
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.categoryIds.join(',')]);

  const queryKey = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    setResult((r) => ({ ...r, products: null, error: null }));
    catalog
      .listProducts({ ...filters, limit: PAGE_SIZE, page: filters.page })
      .then(
        ({ products, total }) =>
          active && setResult({ products, total, error: null })
      )
      .catch(
        (error) =>
          active &&
          setResult({ products: [], total: 0, error: friendlyError(error) })
      );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const chosenCategories = filters.categoryIds
    .map((id) => findCategory(categories, id))
    .filter((c) => c.category);
  // Breadcrumb and title follow a single chosen category.
  const { category, parent } =
    chosenCategories.length === 1
      ? chosenCategories[0]
      : { category: null, parent: null };
  const brandNames = (facets?.brands || [])
    .filter((b) => filters.brandIds.includes(String(b.id)))
    .map((b) => b.name);

  const title = filters.search
    ? `Results for “${filters.search}”`
    : category?.name ||
      (brandNames.length === 1
        ? brandNames[0]
        : filters.onSale
          ? 'On sale'
          : filters.tags.length === 1
            ? `#${filters.tags[0]}`
            : chosenCategories.length > 1
              ? chosenCategories.map((c) => c.category.name).join(', ')
              : 'All products');

  // Active filters as removable chips.
  const chips = useMemo(() => {
    const list = [];
    if (filters.search)
      list.push({ label: `“${filters.search}”`, clear: { search: null } });
    chosenCategories.forEach(({ category: c }) =>
      list.push({
        label: c.name,
        clear: {
          category: filters.categoryIds.filter((id) => id !== String(c.id)),
        },
      })
    );
    brandNames.forEach((name) => {
      const b = facets.brands.find((x) => x.name === name);
      list.push({
        label: name,
        clear: { brand: filters.brandIds.filter((id) => id !== String(b.id)) },
      });
    });
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      list.push({
        label: `$${filters.priceMin ?? 0} – ${filters.priceMax !== undefined ? `$${filters.priceMax}` : 'any'}`,
        clear: { price_min: null, price_max: null },
      });
    }
    if (filters.rating)
      list.push({ label: `${filters.rating}★ & up`, clear: { rating: null } });
    if (filters.inStock)
      list.push({ label: 'In stock', clear: { in_stock: null } });
    if (filters.onSale)
      list.push({ label: 'On sale', clear: { on_sale: null } });
    if (filters.featured)
      list.push({ label: 'Featured', clear: { featured: null } });
    filters.tags.forEach((t) =>
      list.push({
        label: `#${t}`,
        clear: { tag: filters.tags.filter((x) => x !== t) },
      })
    );
    Object.entries(filters.attrs).forEach(([name, values]) =>
      values.forEach((v) =>
        list.push({
          label: `${name}: ${v}`,
          clear: { [`attr.${name}`]: values.filter((x) => x !== v) },
        })
      )
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, categories, facets]);

  const panel = (
    <ProductFilters
      facets={facets}
      categories={categories}
      filters={filters}
      update={update}
      clearAll={clearAll}
    />
  );
  const pages = Math.ceil(result.total / PAGE_SIZE);

  return (
    <Container maxWidth="xl" sx={{ pb: 6 }}>
      <HeroSection compact />

      <PageBreadcrumbs
        sx={{ mt: 3 }}
        items={[
          { label: 'Home', to: '/' },
          { label: 'Products', to: '/products' },
          ...(parent
            ? [{ label: parent.name, to: `/products?category=${parent.id}` }]
            : []),
          ...(category
            ? [
                {
                  label: category.name,
                  to: `/products?category=${category.id}`,
                },
              ]
            : []),
        ]}
      />

      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        flexWrap="wrap"
        useFlexGap
        sx={{ py: 2.5 }}
      >
        <Button
          variant="contained"
          color="inherit"
          startIcon={<FiFilter />}
          onClick={() =>
            desktop ? setShowFilters(!showFilters) : setDrawerOpen(true)
          }
          sx={{
            bgcolor: 'primary.light',
            color: 'primary.main',
            boxShadow: 'none',
            '&:hover': { bgcolor: 'primary.light' },
          }}
        >
          {desktop && showFilters ? 'Hide filters' : 'Filters'}
        </Button>
        <Typography variant="h4" component="h1" sx={{ flex: 1, minWidth: 200 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" aria-live="polite">
          {result.products
            ? `${result.total} result${result.total === 1 ? '' : 's'}`
            : ''}
        </Typography>
        <Select
          size="small"
          value={filters.sort}
          displayEmpty
          onChange={(e) => update({ sort: e.target.value })}
          inputProps={{ 'aria-label': 'Sort by' }}
          sx={{ minWidth: 190, bgcolor: 'background.neutral' }}
        >
          {SORTS.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      <Divider />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: showFilters ? '260px 1fr' : '1fr',
          },
          gap: { md: 4 },
        }}
      >
        {desktop && showFilters && (
          <Box sx={{ borderRight: 1, borderColor: 'divider', pr: 3, pt: 1 }}>
            {panel}
          </Box>
        )}
        <Box sx={{ pt: 3, minWidth: 0 }}>
          {chips.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {chips.map((c) => (
                <Chip
                  key={c.label}
                  label={c.label}
                  onDelete={() => update(c.clear)}
                />
              ))}
              <Button size="small" onClick={clearAll}>
                Clear all
              </Button>
            </Stack>
          )}
          {result.error && <Alert severity="error">{result.error}</Alert>}
          {result.products && !result.products.length && !result.error ? (
            <EmptyState
              title="No products match"
              action={
                <Button variant="contained" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            >
              Try fewer filters or a different search.
            </EmptyState>
          ) : (
            <Box
              data-testid="product-grid"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  lg: showFilters ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)',
                },
                gap: { xs: 1, md: 1.5 },
              }}
            >
              {(result.products || Array.from({ length: 8 })).map((p, i) =>
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
          )}
          {pages > 1 && (
            <Stack alignItems="center" sx={{ mt: 4 }}>
              <Pagination
                count={pages}
                page={filters.page}
                onChange={(_, page) => {
                  update({ page }, { keepPage: true });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                shape="rounded"
              />
            </Stack>
          )}
        </Box>
      </Box>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Stack direction="row" justifyContent="flex-end">
            <IconButton
              aria-label="Close filters"
              onClick={() => setDrawerOpen(false)}
            >
              <FiX />
            </IconButton>
          </Stack>
          {panel}
        </Box>
      </Drawer>
    </Container>
  );
};

export default ProductsPage;
