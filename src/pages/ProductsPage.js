// src/pages/ProductsPage.js — Aurora-style catalogue: compact hero,
// breadcrumb, results bar, filter sidebar and product grid.
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FiCheck, FiFilter, FiX } from 'react-icons/fi';
import {
  LuArrowUpDown,
  LuLayoutGrid,
  LuList,
  LuSlidersHorizontal,
} from 'react-icons/lu';
import { squareButtonSx } from '../components/layout/Header';
import { usePageTool } from '../components/layout/pageHeader';
import PageBreadcrumbs from '../components/common/PageBreadcrumbs';
import HeroSection from '../components/layout/HeroSection';
import ProductCard from '../components/common/ProductCard';
import { ProductCardSkeleton } from '../components/skeletons';
import ResponsiveSheet from '../components/common/ResponsiveSheet';
import ProductFilters, {
  useProductQuery,
} from '../components/products/ProductFilters';
import { EmptyState } from '../components/ui';
import { StandardPagination } from '../components/admin/DataTable';
import { fetchCategories } from '../redux/categoriesSlice';
import { catalog } from '../api';
import { friendlyError } from '../utils/friendlyError';

const PAGE_SIZE = 24;
const VIEW_KEY = 'product-view';

const savedView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

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

/**
 * Phones: categories as a row of chips you swipe through — the top level,
 * or a category's subcategories once one is chosen.
 */
const CategoryChips = ({ categories, chosen, category, parent, onPick }) => {
  const top = parent || (category?.subcategories?.length ? category : null);
  const items = top ? [top, ...(top.subcategories || [])] : categories;
  const selected = (c) => chosen.length === 1 && String(c.id) === chosen[0];
  return (
    <Stack
      direction="row"
      spacing={1}
      component="nav"
      aria-label="Categories"
      sx={{
        // Same width as the title and the grid; swipe for the rest.
        pb: 2,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Chip
        label="All"
        onClick={() => onPick(null)}
        color={chosen.length ? 'default' : 'primary'}
        variant={chosen.length ? 'outlined' : 'filled'}
        aria-pressed={!chosen.length}
      />
      {items.map((c) => (
        <Chip
          key={c.id}
          label={c.name}
          onClick={() => onPick(String(c.id))}
          color={selected(c) ? 'primary' : 'default'}
          variant={selected(c) ? 'filled' : 'outlined'}
          aria-pressed={selected(c)}
          sx={{ flexShrink: 0 }}
        />
      ))}
    </Stack>
  );
};

CategoryChips.propTypes = {
  categories: PropTypes.array.isRequired,
  chosen: PropTypes.array.isRequired,
  category: PropTypes.object,
  parent: PropTypes.object,
  onPick: PropTypes.func.isRequired,
};

const ProductsPage = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const categories = useSelector((s) => s.categories.categories || []);
  const { filters, update, clearAll } = useProductQuery();
  const [showFilters, setShowFilters] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Phones: grid or list, remembered on this device.
  const [view, setView] = useState(savedView);
  const listView = !desktop && view === 'list';
  const changeView = (next) => {
    if (!next) return;
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage unavailable: keep it for this visit
    }
  };
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
        ({ products, total, match }) =>
          active && setResult({ products, total, match, error: null })
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
              : filters.sort === 'popular'
                ? 'Best viewed this week'
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

  // Phones: Filters sits beside the search field in the header.
  const filtersTool = useMemo(
    () => (
      <IconButton
        aria-label={`Filters${chips.length ? `, ${chips.length} on` : ''}`}
        onClick={() => setDrawerOpen(true)}
        sx={squareButtonSx}
      >
        <Badge badgeContent={chips.length} color="primary">
          <LuSlidersHorizontal />
        </Badge>
      </IconButton>
    ),
    [chips.length]
  );
  usePageTool(desktop ? null : filtersTool);

  const count = result.products
    ? `${result.total} result${result.total === 1 ? '' : 's'}`
    : '';

  const panel = (
    <ProductFilters
      facets={facets}
      categories={categories}
      filters={filters}
      update={update}
      clearAll={clearAll}
    />
  );

  return (
    <Container maxWidth="xl" sx={{ pb: 6 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <HeroSection compact />
      </Box>

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

      {desktop ? (
        <Box
          sx={{
            display: 'grid',
            alignItems: 'center',
            gap: { xs: 1.25, md: 2 },
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr) minmax(0, 1fr)',
              md: 'auto minmax(0, 1fr) auto auto',
            },
            py: { xs: 2, md: 2.5 },
          }}
        >
          <Stack
            direction="row"
            alignItems="baseline"
            spacing={1.5}
            sx={{
              gridColumn: { xs: '1 / -1', md: '2' },
              gridRow: { xs: 1, md: 1 },
              minWidth: 0,
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              noWrap
              sx={{ fontSize: { xs: '1.4rem', md: undefined }, minWidth: 0 }}
            >
              {title}
            </Typography>
          </Stack>
          <Button
            variant="contained"
            color="inherit"
            startIcon={<FiFilter />}
            onClick={() =>
              desktop ? setShowFilters(!showFilters) : setDrawerOpen(true)
            }
            sx={{
              gridColumn: { xs: '1', md: '1' },
              gridRow: { xs: 2, md: 1 },
              height: 40,
              bgcolor: 'primary.light',
              color: 'primary.main',
              boxShadow: 'none',
              '&:hover': { bgcolor: 'primary.light' },
            }}
          >
            {desktop && showFilters
              ? 'Hide filters'
              : `Filters${chips.length ? ` (${chips.length})` : ''}`}
          </Button>
          {desktop && (
            <Typography
              color="text.secondary"
              aria-live="polite"
              sx={{ gridRow: 1 }}
            >
              {count}
            </Typography>
          )}
          <Select
            size="small"
            value={filters.sort}
            displayEmpty
            onChange={(e) => update({ sort: e.target.value })}
            inputProps={{ 'aria-label': 'Sort by' }}
            sx={{
              gridRow: { xs: 2, md: 1 },
              minWidth: { md: 190 },
              height: 40,
              bgcolor: 'background.neutral',
            }}
          >
            {SORTS.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      ) : (
        // Phones: title and count; Sort and the grid/list switch beside them.
        // Filters lives in the header, next to the search.
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ pt: 1, pb: 1.5 }}
        >
          <Stack
            direction="row"
            alignItems="baseline"
            spacing={1}
            sx={{ flex: 1, minWidth: 0 }}
          >
            <Typography
              variant="h4"
              component="h1"
              noWrap
              sx={{ fontSize: '1.5rem', minWidth: 0 }}
            >
              {title}
            </Typography>
            <Typography
              color="text.secondary"
              aria-live="polite"
              sx={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}
            >
              {count}
            </Typography>
          </Stack>
          <IconButton
            aria-label={`Sort: ${SORTS.find((x) => x.value === filters.sort)?.label || 'Newest'}`}
            onClick={() => setSortOpen(true)}
            sx={{
              ...squareButtonSx,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <LuArrowUpDown />
          </IconButton>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, v) => changeView(v)}
            aria-label="View"
            sx={{
              p: 0.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: '8px',
              '& .MuiToggleButton-root': {
                border: 0,
                borderRadius: '6px !important',
                width: 36,
                height: 34,
                color: 'text.secondary',
                '&.Mui-selected, &.Mui-selected:hover': {
                  bgcolor: 'primary.light',
                  color: 'primary.main',
                },
              },
            }}
          >
            <ToggleButton value="grid" aria-label="Grid view">
              <LuLayoutGrid />
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <LuList />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}
      {!desktop && categories.length > 0 && (
        <CategoryChips
          categories={categories}
          chosen={filters.categoryIds}
          category={category}
          parent={parent}
          onPick={(id) => update({ category: id })}
        />
      )}
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
        <Box sx={{ pt: { xs: 1.5, md: 3 }, minWidth: 0 }}>
          {chips.length > 0 && (
            <Stack
              direction="row"
              flexWrap="wrap"
              alignItems="center"
              gap={1}
              sx={{ mb: 2 }}
            >
              {chips.map((c) => (
                <Chip
                  key={c.label}
                  label={c.label}
                  onDelete={() => update(c.clear)}
                />
              ))}
              {/* Phones: Clear all sits at the right end of the row. */}
              <Button
                size="small"
                onClick={clearAll}
                sx={{ ml: { xs: 'auto', md: 0 } }}
              >
                Clear all
              </Button>
            </Stack>
          )}
          {result.error && <Alert severity="error">{result.error}</Alert>}
          {result.match === 'related' && filters.search && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No exact match for “{filters.search}”. Here are the closest
              matches.
            </Alert>
          )}
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
              data-view={listView ? 'list' : 'grid'}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: listView ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                  sm: listView ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                  lg: showFilters
                    ? 'repeat(4, minmax(0, 1fr))'
                    : 'repeat(5, minmax(0, 1fr))',
                },
                gap: { xs: 1, md: 1.5 },
                // Phones: cards keep their padding (for the hover tint) but
                // their photos line up with the title and categories.
                mx: { xs: -1, sm: 0 },
              }}
            >
              {(result.products || Array.from({ length: 8 })).map((p, i) =>
                p ? (
                  <ProductCard
                    key={p.id}
                    product={p}
                    layout={listView ? 'list' : 'grid'}
                  />
                ) : (
                  <ProductCardSkeleton key={i} />
                )
              )}
            </Box>
          )}
          {result.total > 0 && (
            <Box
              sx={{
                mt: 4,
                borderRadius: 1,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <StandardPagination
                count={result.total}
                page={filters.page - 1}
                rowsPerPage={PAGE_SIZE}
                label="products"
                maxShowAll={0}
                onRowsPerPageChange={() => {}}
                onPageChange={(_, p) => {
                  update({ page: p + 1 }, { keepPage: true });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Phones: sort choices slide up from the bottom. */}
      <ResponsiveSheet
        open={sortOpen && !desktop}
        onClose={() => setSortOpen(false)}
        aria-labelledby="sort-title"
      >
        <Typography variant="h6" id="sort-title" sx={{ px: 2, pt: 2, pb: 1 }}>
          Sort by
        </Typography>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, pb: 2 }}>
          {SORTS.map((s) => {
            const on = filters.sort === s.value;
            return (
              <li key={s.value}>
                <ListItemButton
                  selected={on}
                  aria-current={on || undefined}
                  onClick={() => {
                    setSortOpen(false);
                    if (!on) update({ sort: s.value });
                  }}
                  sx={{ minHeight: 48, px: 2 }}
                >
                  <ListItemText primary={s.label} />
                  {on && <FiCheck />}
                </ListItemButton>
              </li>
            );
          })}
        </Box>
      </ResponsiveSheet>

      {/* Phones: filters slide up from the bottom. */}
      <ResponsiveSheet
        open={drawerOpen && !desktop}
        onClose={() => setDrawerOpen(false)}
        aria-labelledby="filters-title"
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" id="filters-title">
            Filters
          </Typography>
          <IconButton
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          >
            <FiX />
          </IconButton>
        </Stack>
        <Box sx={{ p: 2, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {panel}
        </Box>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => setDrawerOpen(false)}
          >
            {result.products
              ? `Show ${result.total} result${result.total === 1 ? '' : 's'}`
              : 'Show results'}
          </Button>
        </Box>
      </ResponsiveSheet>
    </Container>
  );
};

export default ProductsPage;
