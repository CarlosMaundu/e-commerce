// src/pages/admin/products/BrandsPage.js — brands and their logos.
import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  IconButton,
  Link,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission } from '../../../auth/permissions';
import { adminCatalog } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import ConfirmationDialog from '../../../components/common/ConfirmationDialog';
import { EmptyState } from '../../../components/ui';
import BrandDialog from './BrandDialog';

const BrandsPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const [brands, setBrands] = useState(null);
  const [editing, setEditing] = useState(null); // {} = new
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const canCreate = hasPermission(user, 'catalog.categories.create');
  const canUpdate = hasPermission(user, 'catalog.categories.update');
  const canDelete = hasPermission(user, 'catalog.categories.delete');

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
      <Box>
        <Breadcrumbs aria-label="Breadcrumb">
          <Link component={RouterLink} to="/admin/products" underline="hover">
            Products
          </Link>
          <Typography color="text.primary">Brands</Typography>
        </Breadcrumbs>
        <Stack direction="row" alignItems="center" sx={{ mt: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h3" component="h1">
              Brands
            </Typography>
            <Typography color="text.secondary">
              Shoppers can filter by brand, and logos appear on the home page
              and product pages.
            </Typography>
          </Box>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={() => setEditing({})}
            >
              Add brand
            </Button>
          )}
        </Stack>
      </Box>

      {brands && !brands.length ? (
        <EmptyState title="No brands yet">
          Add your first brand and its logo.
        </EmptyState>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(3, 1fr)',
              xl: 'repeat(4, 1fr)',
            },
            gap: 2,
          }}
        >
          {(brands || Array.from({ length: 6 })).map((b, i) =>
            b ? (
              <Card key={b.id} sx={{ p: 2.5 }} data-testid={`brand-${b.name}`}>
                <Box
                  sx={{
                    height: 72,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'background.paper',
                    borderRadius: '8px',
                    mb: 2,
                  }}
                >
                  {b.logo ? (
                    <Box
                      component="img"
                      src={b.logo}
                      alt={`${b.name} logo`}
                      sx={{ maxWidth: '85%', maxHeight: 52 }}
                    />
                  ) : (
                    <Typography variant="h6" color="text.secondary">
                      {b.name}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1">{b.name}</Typography>
                    <Link
                      component={RouterLink}
                      to={`/admin/products?brand=${b.id}`}
                      variant="body2"
                      underline="hover"
                    >
                      {b.productCount} product{b.productCount === 1 ? '' : 's'}
                    </Link>
                  </Box>
                  {canUpdate && (
                    <Tooltip title="Edit">
                      <IconButton
                        aria-label={`Edit ${b.name}`}
                        onClick={() => setEditing(b)}
                      >
                        <FiEdit2 />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete">
                      <IconButton
                        aria-label={`Delete ${b.name}`}
                        onClick={() => setDeleting(b)}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Card>
            ) : (
              <Skeleton
                key={i}
                variant="rounded"
                height={170}
                sx={{ borderRadius: 1 }}
              />
            )
          )}
        </Box>
      )}

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
