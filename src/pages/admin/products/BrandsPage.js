// src/pages/admin/products/BrandsPage.js — brands and logos in the standard
// table; add and edit in a dialog.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
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
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission } from '../../../auth/permissions';
import { adminCatalog } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import ConfirmationDialog from '../../../components/common/ConfirmationDialog';
import {
  EmptyRow,
  LoadingRows,
  PageHeader,
  PanelToolbar,
  RowActions,
  SearchField,
  StandardPagination,
  TablePanel,
  usePaging,
} from '../../../components/admin/DataTable';
import BrandDialog from './BrandDialog';

const BrandsPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const paging = usePaging();
  const [brands, setBrands] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {} = new
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const canCreate = hasPermission(user, 'catalog.brands.create');
  const canUpdate = hasPermission(user, 'catalog.brands.update');
  const canDelete = hasPermission(user, 'catalog.brands.delete');

  const load = () =>
    adminCatalog
      .brands()
      .then(setBrands)
      .catch((error) => {
        notify.error(error, 'We couldn’t load brands.');
        setBrands([]);
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (brands || []).filter((b) => !q || b.name.toLowerCase().includes(q));
  }, [brands, search]);

  const remove = async () => {
    setBusy(true);
    try {
      await adminCatalog.deleteBrand(deleting.id);
      notify.success('Brand deleted.');
      setDeleting(null);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t delete the brand.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Products', to: '/admin/products' },
          { label: 'Brands', to: '/admin/products/brands' },
        ]}
        title="Brands"
        subtitle="Shoppers can filter by brand; logos scroll across the home page and appear on product pages."
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={() => setEditing({})}
            >
              Add brand
            </Button>
          )
        }
      />
      <TablePanel>
        <PanelToolbar>
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              paging.reset();
            }}
            placeholder="Search brands"
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Brands" sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow>
                <TableCell>Logo</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell align="right">Products</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!brands && <LoadingRows cols={4} />}
              {brands && !filtered.length && (
                <EmptyRow cols={4}>
                  {search ? 'No brands match your search.' : 'No brands yet.'}
                </EmptyRow>
              )}
              {paging.slice(filtered).map((b) => (
                <TableRow key={b.id} hover data-testid={`brand-${b.name}`}>
                  <TableCell sx={{ width: 120 }}>
                    <Box
                      sx={{
                        width: 88,
                        height: 44,
                        borderRadius: '8px',
                        bgcolor: 'background.neutral',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {b.logo ? (
                        <Box
                          component="img"
                          src={b.logo}
                          alt={`${b.name} logo`}
                          sx={{ maxWidth: '80%', maxHeight: 30 }}
                        />
                      ) : (
                        <Typography variant="caption">No logo</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {b.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Link
                      component={RouterLink}
                      to={`/admin/products?brand=${b.id}`}
                      underline="hover"
                    >
                      {b.productCount}
                    </Link>
                  </TableCell>
                  <TableCell align="right">
                    <RowActions
                      label={`Actions for ${b.name}`}
                      items={[
                        {
                          label: 'Edit',
                          icon: <FiEdit2 />,
                          onClick: () => setEditing(b),
                          hidden: !canUpdate,
                        },
                        {
                          label: 'Delete',
                          icon: <FiTrash2 />,
                          color: 'error',
                          onClick: () => setDeleting(b),
                          hidden: !canDelete,
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <StandardPagination count={filtered.length} {...paging.props} />
      </TablePanel>

      <BrandDialog
        open={Boolean(editing)}
        brand={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
      <ConfirmationDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        content={
          deleting?.productCount
            ? `${deleting.productCount} product${deleting.productCount === 1 ? '' : 's'} will no longer have a brand.`
            : 'This brand has no products.'
        }
        confirmText="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Stack>
  );
};

export default BrandsPage;
