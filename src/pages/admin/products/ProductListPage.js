// src/pages/admin/products/ProductListPage.js — Aurora-style product list:
// Vendor / Tagged with / Status / more filters, search, selectable rows with
// bulk actions, and dedicated SKU, Variants and Published on columns.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../auth/permissions';
import { adminCatalog, catalog } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import ConfirmationDialog from '../../../components/common/ConfirmationDialog';
import {
  EmptyRow,
  FilterMenu,
  LoadingRows,
  PAGE_SIZE,
  PageHeader,
  PanelToolbar,
  Pill,
  RowActions,
  SearchField,
  StandardPagination,
  TablePanel,
} from '../../../components/admin/DataTable';
import { formatDate, formatMoney } from '../../../utils/format';
import { PRODUCT_STATUSES, statusInfo } from '../../../utils/productStatus';

const priceText = (p) =>
  p.minPrice < p.maxPrice
    ? `${formatMoney(p.minPrice)} – ${formatMoney(p.maxPrice)}`
    : formatMoney(p.specialPrice ?? p.price);

const toCsv = (rows) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = [
    'ID',
    'Name',
    'SKU',
    'Status',
    'Category',
    'Vendor',
    'Variants',
    'Price',
    'Sale price',
    'Stock',
    'Published on',
    'Tags',
  ];
  return [
    header.map(cell).join(','),
    ...rows.map((p) =>
      [
        p.id,
        p.title,
        p.sku,
        statusInfo(p.status).label,
        p.category?.name,
        p.brand?.name,
        p.variants.length,
        p.price,
        p.specialPrice,
        p.quantity,
        p.publishedAt ? formatDate(p.publishedAt) : '',
        p.tags.join(' '),
      ]
        .map(cell)
        .join(',')
    ),
  ].join('\n');
};

// eslint-disable-next-line react/prop-types
const Inventory = ({ p }) => {
  if (!p.trackInventory)
    return <Typography variant="body2">Not tracked</Typography>;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography
        variant="body2"
        sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 24 }}
      >
        {String(p.quantity).padStart(2, '0')}
      </Typography>
      {!p.inStock ? (
        <Pill label="Out" tone="error" />
      ) : p.lowStock ? (
        <Pill label="Low" tone="warning" />
      ) : null}
    </Stack>
  );
};

const ProductListPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const page = Number(params.get('page') || 0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);
  const [search, setSearch] = useState(get('search'));
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [tags, setTags] = useState([]);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
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
    if (!('page' in changes)) next.delete('page');
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
    adminCatalog
      .tags()
      .then((t) => setTags(t.map((x) => x.tag)))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setData(null);
    try {
      setData(
        await adminCatalog.listProducts({
          status: get('status') || undefined,
          stock: get('stock') || undefined,
          search: get('search') || undefined,
          categoryId: get('category') || undefined,
          brandIds: get('brand') ? [get('brand')] : undefined,
          tag: get('tag') || undefined,
          sort: get('sort') || undefined,
          limit: rowsPerPage,
          page: page + 1,
        })
      );
    } catch (error) {
      notify.error(error, 'We couldn’t load products.');
      setData({ products: [], total: 0, counts: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, rowsPerPage, page, notify]);

  useEffect(() => {
    load();
    setSelected([]);
  }, [load]);

  const setStatus = async (ids, status) => {
    setBusy(true);
    try {
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await adminCatalog.patchProduct(id, { status });
      }
      notify.success(
        `${ids.length} product${ids.length === 1 ? '' : 's'} set to ${statusInfo(status).label}.`
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

  const rows = data?.products || [];
  const exportCsv = () => {
    const chosen = selected.length
      ? rows.filter((p) => selected.includes(p.id))
      : rows;
    const url = URL.createObjectURL(
      new Blob([toCsv(chosen)], { type: 'text/csv' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const allChecked = rows.length > 0 && selected.length === rows.length;
  const counts = data?.counts || {};
  const filtered = [
    'status',
    'brand',
    'tag',
    'category',
    'stock',
    'search',
  ].some((k) => get(k));

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Products', to: '/admin/products' },
        ]}
        title="Product list"
        subtitle={
          counts.all !== undefined
            ? `${counts.all} products · ${counts.published} active`
            : undefined
        }
        actions={
          <>
            <Button
              startIcon={<FiDownload />}
              onClick={exportCsv}
              disabled={!rows.length}
              sx={{ bgcolor: 'background.neutral' }}
            >
              {selected.length ? `Export ${selected.length}` : 'Export'}
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
          </>
        }
      />

      <TablePanel>
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(q) => setParam({ search: q })}
            suggest={(q) => adminCatalog.suggestProducts(q)}
            placeholder="Search by name, SKU, vendor or tag"
            label="Search products"
          />
        </PanelToolbar>
        {data?.match === 'related' && get('search') && (
          <Alert severity="info" sx={{ mx: 2, mb: 1.5 }}>
            No exact match for “{get('search')}”. Showing the closest matches.
          </Alert>
        )}
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ px: 2, pb: 1.5 }}
        >
          <FilterMenu
            label="Vendor"
            value={get('brand')}
            onChange={(v) => setParam({ brand: v })}
            options={[
              { value: '', label: 'All' },
              ...brands.map((b) => ({ value: String(b.id), label: b.name })),
            ]}
          />
          <FilterMenu
            label="Tagged with"
            value={get('tag')}
            onChange={(v) => setParam({ tag: v })}
            options={[
              { value: '', label: 'All' },
              ...tags.map((t) => ({ value: t, label: `#${t}` })),
            ]}
          />
          <FilterMenu
            label="Status"
            value={get('status')}
            onChange={(v) => setParam({ status: v })}
            options={[
              {
                value: '',
                label: `All${counts.all !== undefined ? ` (${counts.all})` : ''}`,
              },
              ...PRODUCT_STATUSES.map((s) => ({
                value: s.value,
                label: `${s.label}${counts[s.value] !== undefined ? ` (${counts[s.value]})` : ''}`,
              })),
            ]}
          />
          <FilterMenu
            label="Category"
            value={get('category')}
            onChange={(v) => setParam({ category: v })}
            options={[
              { value: '', label: 'All' },
              ...categories.flatMap((c) => [
                { value: String(c.id), label: c.name },
                ...(c.subcategories || []).map((s) => ({
                  value: String(s.id),
                  label: `— ${s.name}`,
                })),
              ]),
            ]}
          />
          <FilterMenu
            label="Inventory"
            value={get('stock')}
            onChange={(v) => setParam({ stock: v })}
            options={[
              { value: '', label: 'All' },
              { value: 'in', label: 'In stock' },
              {
                value: 'low',
                label: `Low stock${counts.low !== undefined ? ` (${counts.low})` : ''}`,
              },
              {
                value: 'out',
                label: `Out of stock${counts.out !== undefined ? ` (${counts.out})` : ''}`,
              },
            ]}
          />
          <FilterMenu
            label="Sort"
            value={get('sort')}
            onChange={(v) => setParam({ sort: v })}
            options={[
              { value: '', label: 'Newest' },
              { value: 'published', label: 'Recently published' },
              { value: 'name', label: 'Name A–Z' },
              { value: 'price_asc', label: 'Price: low to high' },
              { value: 'price_desc', label: 'Price: high to low' },
              { value: 'stock_asc', label: 'Inventory: low to high' },
            ]}
          />
          {filtered && (
            <Button
              size="small"
              onClick={() => {
                setSearch('');
                setParams({}, { replace: true });
              }}
            >
              Clear filters
            </Button>
          )}
        </Stack>

        {selected.length > 0 && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ px: 2, py: 1, bgcolor: 'primary.light' }}
            role="region"
            aria-label="Bulk actions"
          >
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {selected.length} selected
            </Typography>
            {canUpdate &&
              PRODUCT_STATUSES.map((s) => (
                <Button
                  key={s.value}
                  size="small"
                  disabled={busy}
                  onClick={() => setStatus(selected, s.value)}
                >
                  Set {s.label}
                </Button>
              ))}
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
          <Table aria-label="Products" sx={{ minWidth: 1080 }}>
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
                <TableCell sx={{ minWidth: 240 }}>Name</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell align="right">Variants</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Inventory</TableCell>
                <TableCell>Published on</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!data && <LoadingRows cols={11} />}
              {data && !rows.length && (
                <EmptyRow cols={11}>
                  {filtered
                    ? 'No products match these filters.'
                    : 'No products yet.'}
                </EmptyRow>
              )}
              {rows.map((p) => {
                const st = statusInfo(p.status);
                return (
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
                        <Link
                          component={RouterLink}
                          to={`/admin/products/${p.id}`}
                          underline="hover"
                          sx={{ fontWeight: 600 }}
                        >
                          {p.title}
                        </Link>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {p.sku || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {p.category ? <Pill label={p.category.name} /> : '—'}
                    </TableCell>
                    <TableCell>
                      {p.brand ? (
                        <Link
                          component={RouterLink}
                          to={`/admin/products?brand=${p.brand.id}`}
                          underline="hover"
                        >
                          {p.brand.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {p.variants.length || '—'}
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
                      <Pill label={st.label} tone={st.tone} />
                    </TableCell>
                    <TableCell>
                      <Inventory p={p} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="body2"
                        color={
                          p.publishedAt ? 'text.primary' : 'text.secondary'
                        }
                      >
                        {p.publishedAt ? formatDate(p.publishedAt) : 'Not yet'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <RowActions
                        label={`Actions for ${p.title}`}
                        items={[
                          {
                            label: canUpdate ? 'Edit' : 'View',
                            icon: <FiEdit2 />,
                            onClick: () => navigate(`/admin/products/${p.id}`),
                          },
                          {
                            label: 'View in shop',
                            icon: <FiExternalLink />,
                            hidden: p.status !== 'published',
                            onClick: () =>
                              window.open(
                                `/products/${p.id}`,
                                '_blank',
                                'noopener'
                              ),
                          },
                          ...PRODUCT_STATUSES.filter(
                            (s) => s.value !== p.status
                          ).map((s) => ({
                            label: `Set ${s.label}`,
                            hidden: !canUpdate,
                            onClick: () => setStatus([p.id], s.value),
                          })),
                          {
                            label: 'Delete',
                            icon: <FiTrash2 />,
                            color: 'error',
                            hidden: !canDelete,
                            onClick: () => setConfirm([p.id]),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <StandardPagination
          count={data?.total || 0}
          page={page}
          rowsPerPage={rowsPerPage}
          label="products"
          onPageChange={(_, p) => setParam({ page: p || null })}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setParam({ page: null });
          }}
        />
      </TablePanel>

      <ConfirmationDialog
        open={Boolean(confirm)}
        title={`Delete ${confirm?.length === 1 ? 'this product' : `${confirm?.length} products`}?`}
        content="Past orders keep their details, but the product leaves the shop and carts for good. To keep it on record, set it to Archive instead."
        confirmText="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </Stack>
  );
};

export default ProductListPage;
