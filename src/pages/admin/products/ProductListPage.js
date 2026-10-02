// src/pages/admin/products/ProductListPage.js — Aurora-style product list:
// status tabs, search and filters, selectable rows with bulk actions.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Checkbox,
  Chip,
  IconButton,
  InputAdornment,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../auth/permissions';
import { adminCatalog, catalog } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import ConfirmationDialog from '../../../components/common/ConfirmationDialog';
import { EmptyState } from '../../../components/ui';
import { formatDate, formatMoney } from '../../../utils/format';

const TABS = [
  { value: '', label: 'All', count: 'all' },
  { value: 'published', label: 'Published', count: 'published' },
  { value: 'draft', label: 'Drafts', count: 'draft' },
  { value: 'low', label: 'Low stock', count: 'low' },
  { value: 'out', label: 'Out of stock', count: 'out' },
];

// Brand, tags and date need room; on narrower screens they're in the editor.
const HIDE_LG = { display: { xs: 'none', xl: 'table-cell' } };

const priceText = (p) =>
  p.minPrice < p.maxPrice
    ? `${formatMoney(p.minPrice)} – ${formatMoney(p.maxPrice)}`
    : formatMoney(p.specialPrice ?? p.price);

const StockCell = ({ p }) => {
  if (!p.trackInventory)
    return <Typography variant="body2">Not tracked</Typography>;
  return (
    <Stack spacing={0.25}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {p.quantity}
        </Typography>
        {!p.inStock ? (
          <Chip size="small" color="error" variant="outlined" label="Out" />
        ) : p.lowStock ? (
          <Chip size="small" color="warning" variant="outlined" label="Low" />
        ) : null}
      </Stack>
      {p.variants.length > 0 && (
        <Typography variant="caption">
          {p.variants.length} variant{p.variants.length === 1 ? '' : 's'}
        </Typography>
      )}
    </Stack>
  );
};

const toCsv = (rows) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = [
    'ID',
    'Name',
    'SKU',
    'Status',
    'Category',
    'Brand',
    'Price',
    'Sale price',
    'Stock',
    'Tags',
  ];
  return [
    header.map(cell).join(','),
    ...rows.map((p) =>
      [
        p.id,
        p.title,
        p.sku,
        p.status,
        p.category?.name,
        p.brand?.name,
        p.price,
        p.specialPrice,
        p.quantity,
        p.tags.join(' '),
      ]
        .map(cell)
        .join(',')
    ),
  ].join('\n');
};

const ProductListPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || '';
  const page = Number(params.get('page') || 0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState(params.get('search') || '');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState(params.get('brand') || '');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [menu, setMenu] = useState(null); // { anchor, product }
  const [confirm, setConfirm] = useState(null); // ids to delete
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission(user, PERMISSIONS.productsCreate);
  const canUpdate = hasPermission(user, PERMISSIONS.productsUpdate);
  const canDelete = hasPermission(user, PERMISSIONS.productsDelete);

  const setParam = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) =>
      v || v === 0 ? next.set(k, v) : next.delete(k)
    );
    setParams(next, { replace: true });
  };

  useEffect(() => {
    catalog
      .getCategories()
      .then(setCategories)
      .catch(() => {});
    adminCatalog
      .brands()
      .then(setBrands)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setData(null);
    try {
      const status = ['published', 'draft'].includes(tab) ? tab : undefined;
      const stock = ['low', 'out'].includes(tab) ? tab : undefined;
      setData(
        await adminCatalog.listProducts({
          status,
          stock,
          search: params.get('search') || undefined,
          categoryId: categoryId || undefined,
          brandIds: brandId ? [brandId] : undefined,
          limit: rowsPerPage,
          page: page + 1,
        })
      );
    } catch (error) {
      notify.error(error, 'We couldn’t load products.');
      setData({ products: [], total: 0, counts: {} });
    }
  }, [tab, params, categoryId, brandId, rowsPerPage, page, notify]);

  useEffect(() => {
    load();
    setSelected([]);
  }, [load]);

  const submitSearch = (e) => {
    e.preventDefault();
    setParam({ search: search.trim(), page: null });
  };

  const setStatus = async (ids, status) => {
    setBusy(true);
    try {
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await adminCatalog.patchProduct(id, { status });
      }
      notify.success(
        `${ids.length} product${ids.length === 1 ? '' : 's'} ${status === 'published' ? 'published' : 'moved to drafts'}.`
      );
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t update those products.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      for (const id of confirm) {
        // eslint-disable-next-line no-await-in-loop
        await adminCatalog.deleteProduct(id);
      }
      notify.success(
        `${confirm.length} product${confirm.length === 1 ? '' : 's'} deleted.`
      );
      setConfirm(null);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t delete those products.');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(data?.products || [])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = data?.products || [];
  const allChecked = rows.length > 0 && selected.length === rows.length;

  return (
    <Stack spacing={3}>
      <Box>
        <Breadcrumbs aria-label="Breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover">
            Home
          </Link>
          <Typography color="text.primary">Products</Typography>
        </Breadcrumbs>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ mt: 1 }}
          flexWrap="wrap"
          useFlexGap
        >
          <Typography variant="h3" component="h1" sx={{ flex: 1 }}>
            Product list
          </Typography>
          <Button
            startIcon={<FiDownload />}
            onClick={exportCsv}
            disabled={!rows.length}
            sx={{ bgcolor: 'background.neutral' }}
          >
            Export
          </Button>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              component={RouterLink}
              to="/admin/products/new"
            >
              Add product
            </Button>
          )}
        </Stack>
      </Box>

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setParam({ tab: v, page: null })}
          variant="scrollable"
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{t.label}</span>
                  {data?.counts?.[t.count] !== undefined && (
                    <Chip
                      size="small"
                      label={data.counts[t.count]}
                      sx={{ height: 20 }}
                    />
                  )}
                </Stack>
              }
            />
          ))}
        </Tabs>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ p: 2 }}
          alignItems={{ md: 'center' }}
        >
          <Box
            component="form"
            onSubmit={submitSearch}
            sx={{ flex: 1, maxWidth: { md: 420 } }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Search by name, SKU, brand or tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'aria-label': 'Search products' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FiSearch />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Select
            size="small"
            value={categoryId}
            displayEmpty
            onChange={(e) => {
              setCategoryId(e.target.value);
              setParam({ page: null });
            }}
            inputProps={{ 'aria-label': 'Category' }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All categories</MenuItem>
            {categories.flatMap((c) => [
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>,
              ...(c.subcategories || []).map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ pl: 4 }}>
                  {s.name}
                </MenuItem>
              )),
            ])}
          </Select>
          <Select
            size="small"
            value={brandId}
            displayEmpty
            onChange={(e) => {
              setBrandId(e.target.value);
              setParam({ page: null });
            }}
            inputProps={{ 'aria-label': 'Brand' }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All brands</MenuItem>
            {brands.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.name}
              </MenuItem>
            ))}
          </Select>
        </Stack>

        {selected.length > 0 && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ px: 2, py: 1, bgcolor: 'primary.light' }}
            role="region"
            aria-label="Bulk actions"
          >
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {selected.length} selected
            </Typography>
            {canUpdate && (
              <>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => setStatus(selected, 'published')}
                >
                  Publish
                </Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => setStatus(selected, 'draft')}
                >
                  Move to drafts
                </Button>
              </>
            )}
            {canDelete && (
              <Button
                size="small"
                color="error"
                disabled={busy}
                onClick={() => setConfirm(selected)}
              >
                Delete
              </Button>
            )}
          </Stack>
        )}

        <TableContainer>
          <Table aria-label="Products" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={selected.length > 0 && !allChecked}
                    onChange={() =>
                      setSelected(allChecked ? [] : rows.map((p) => p.id))
                    }
                    inputProps={{
                      'aria-label': 'Select all products on this page',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 260 }}>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell sx={HIDE_LG}>Brand</TableCell>
                <TableCell sx={HIDE_LG}>Tags</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Inventory</TableCell>
                <TableCell sx={HIDE_LG}>Updated</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!data &&
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton height={40} />
                    </TableCell>
                  </TableRow>
                ))}
              {rows.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  selected={selected.includes(p.id)}
                  data-testid={`product-row-${p.id}`}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onChange={() =>
                        setSelected((s) =>
                          s.includes(p.id)
                            ? s.filter((x) => x !== p.id)
                            : [...s, p.id]
                        )
                      }
                      inputProps={{ 'aria-label': `Select ${p.title}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        variant="rounded"
                        src={p.images[0]}
                        alt=""
                        sx={{ width: 44, height: 44, borderRadius: '8px' }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Link
                          component={RouterLink}
                          to={`/admin/products/${p.id}`}
                          underline="hover"
                          sx={{ fontWeight: 600, display: 'block' }}
                        >
                          {p.title}
                        </Link>
                        {p.sku && (
                          <Typography variant="caption">SKU {p.sku}</Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {p.category ? (
                      <Chip
                        size="small"
                        label={p.category.name}
                        sx={{ bgcolor: 'background.neutralDeep' }}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell sx={HIDE_LG}>
                    <Typography variant="body2">
                      {p.brand?.name || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={HIDE_LG}>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {p.tags.slice(0, 2).map((t) => (
                        <Chip
                          key={t}
                          size="small"
                          variant="outlined"
                          label={t}
                        />
                      ))}
                      {p.tags.length > 2 && (
                        <Typography variant="caption">
                          +{p.tags.length - 2}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2">{priceText(p)}</Typography>
                    {p.specialPrice !== null && p.minPrice === p.maxPrice && (
                      <Typography
                        variant="caption"
                        sx={{ textDecoration: 'line-through' }}
                      >
                        {formatMoney(p.price)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={p.status === 'published' ? 'Published' : 'Draft'}
                      color={p.status === 'published' ? 'success' : 'warning'}
                      variant="outlined"
                    />
                    {p.featured && (
                      <Chip size="small" label="Featured" sx={{ ml: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <StockCell p={p} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', ...HIDE_LG }}>
                    <Typography variant="body2">
                      {formatDate(p.updatedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label={`Actions for ${p.title}`}
                      onClick={(e) =>
                        setMenu({ anchor: e.currentTarget, product: p })
                      }
                    >
                      <FiMoreVertical />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {data && !rows.length && (
          <EmptyState
            title="No products here"
            action={
              canCreate && (
                <Button
                  variant="contained"
                  component={RouterLink}
                  to="/admin/products/new"
                >
                  Add product
                </Button>
              )
            }
          >
            Try another tab, search or filter.
          </EmptyState>
        )}
        <TablePagination
          component="div"
          count={data?.total || 0}
          page={page}
          onPageChange={(_, p) => setParam({ page: p || null })}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setParam({ page: null });
          }}
        />
      </Box>

      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
      >
        <MenuItem
          onClick={() => {
            navigate(`/admin/products/${menu.product.id}`);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <FiEdit2 />
          </ListItemIcon>
          {canUpdate ? 'Edit' : 'View'}
        </MenuItem>
        {menu?.product.status === 'published' && (
          <MenuItem
            component="a"
            href={`/products/${menu?.product.id}`}
            target="_blank"
            onClick={() => setMenu(null)}
          >
            <ListItemIcon>
              <FiExternalLink />
            </ListItemIcon>
            View in shop
          </MenuItem>
        )}
        {canUpdate && (
          <MenuItem
            onClick={() => {
              setStatus(
                [menu.product.id],
                menu.product.status === 'published' ? 'draft' : 'published'
              );
              setMenu(null);
            }}
          >
            <ListItemIcon>
              {menu?.product.status === 'published' ? <FiEyeOff /> : <FiEye />}
            </ListItemIcon>
            {menu?.product.status === 'published'
              ? 'Move to drafts'
              : 'Publish'}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => {
              setConfirm([menu.product.id]);
              setMenu(null);
            }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}>
              <FiTrash2 />
            </ListItemIcon>
            Delete
          </MenuItem>
        )}
      </Menu>

      <ConfirmationDialog
        open={Boolean(confirm)}
        title={`Delete ${confirm?.length === 1 ? 'this product' : `${confirm?.length} products`}?`}
        content="Past orders keep their details, but the product leaves the shop and carts for good."
        confirmText="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </Stack>
  );
};

export default ProductListPage;
