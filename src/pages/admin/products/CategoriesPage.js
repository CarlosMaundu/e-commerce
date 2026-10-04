// src/pages/admin/products/CategoriesPage.js — categories in the standard
// table; add and edit in a dialog.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Avatar,
  Button,
  Chip,
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
import { adminCatalog, catalog } from '../../../api';
import { fetchCategories } from '../../../redux/categoriesSlice';
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
import CategoryDialog from './CategoryDialog';

const total = (c) =>
  c.productCount +
  (c.subcategories || []).reduce((s, x) => s + x.productCount, 0);

const CategoriesPage = () => {
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const dispatch = useDispatch();
  const paging = usePaging();
  const [categories, setCategories] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {} = new
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const canCreate = hasPermission(user, 'catalog.categories.create');
  const canUpdate = hasPermission(user, 'catalog.categories.update');
  const canDelete = hasPermission(user, 'catalog.categories.delete');

  const load = () =>
    catalog
      .getCategories()
      .then(setCategories)
      .catch((error) => {
        notify.error(error, 'We couldn’t load categories.');
        setCategories([]);
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = () => {
    load();
    dispatch(fetchCategories()); // header menu and filters
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (categories || []).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.subcategories.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [categories, search]);

  const remove = async () => {
    setBusy(true);
    try {
      await adminCatalog.deleteCategory(deleting.id);
      notify.success('Category deleted.');
      setDeleting(null);
      changed();
    } catch (error) {
      notify.error(error, 'We couldn’t delete the category.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Categories', to: '/admin/categories' },
        ]}
        title="Categories"
        subtitle="How shoppers browse the shop. Category images appear in Curated picks."
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={() => setEditing({})}
            >
              Add category
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
            placeholder="Search categories and subcategories"
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Categories" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Subcategories</TableCell>
                <TableCell align="right">Products</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!categories && <LoadingRows cols={4} />}
              {categories && !filtered.length && (
                <EmptyRow cols={4}>
                  {search
                    ? 'No categories match your search.'
                    : 'No categories yet.'}
                </EmptyRow>
              )}
              {paging.slice(filtered).map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  data-testid={`category-row-${c.name}`}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        variant="rounded"
                        src={c.image || undefined}
                        alt=""
                        sx={{ width: 44, height: 44, borderRadius: '8px' }}
                      >
                        {c.name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {c.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {c.subcategories.length ? (
                        c.subcategories.map((s) => (
                          <Chip
                            key={s.id}
                            size="small"
                            variant="outlined"
                            label={`${s.name} (${s.productCount})`}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Link
                      component={RouterLink}
                      to={`/admin/products?category=${c.id}`}
                      underline="hover"
                    >
                      {total(c)}
                    </Link>
                  </TableCell>
                  <TableCell align="right">
                    <RowActions
                      label={`Actions for ${c.name}`}
                      items={[
                        {
                          label: 'Edit',
                          icon: <FiEdit2 />,
                          onClick: () => setEditing(c),
                          hidden: !canUpdate,
                        },
                        {
                          label: 'Delete',
                          icon: <FiTrash2 />,
                          color: 'error',
                          onClick: () => setDeleting(c),
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

      <CategoryDialog
        open={Boolean(editing)}
        category={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          changed();
        }}
      />
      <ConfirmationDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        content={
          deleting && total(deleting)
            ? 'This category still has products. Move or delete them first.'
            : 'Its subcategories are deleted too.'
        }
        confirmText="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Stack>
  );
};

export default CategoriesPage;
