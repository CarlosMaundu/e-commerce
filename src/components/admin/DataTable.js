// src/components/admin/DataTable.js — the back office's standard table kit,
// taken from the Product list: a page header with breadcrumb and actions, a
// bordered panel with optional status tabs and a toolbar, loading and empty
// rows, a row-actions menu, and one pagination (10 rows by default).
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  TableCell,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { FiMoreVertical, FiSearch } from 'react-icons/fi';
import PageBreadcrumbs from '../common/PageBreadcrumbs';

export const PAGE_SIZE = 10;
export const PAGE_SIZES = [10, 25, 50];

/** Page state for client- or server-paged tables. */
export const usePaging = (initialSize = PAGE_SIZE) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialSize);
  return {
    page,
    rowsPerPage,
    setPage,
    reset: () => setPage(0),
    slice: (rows) =>
      rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    props: {
      page,
      rowsPerPage,
      onPageChange: (_, p) => setPage(p),
      onRowsPerPageChange: (e) => {
        setRowsPerPage(Number(e.target.value));
        setPage(0);
      },
    },
  };
};

export const StandardPagination = ({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) => (
  <TablePagination
    component="div"
    count={count}
    page={count && page * rowsPerPage >= count ? 0 : page}
    rowsPerPage={rowsPerPage}
    rowsPerPageOptions={PAGE_SIZES}
    onPageChange={onPageChange}
    onRowsPerPageChange={onRowsPerPageChange}
    sx={{ borderTop: 1, borderColor: 'divider' }}
  />
);

StandardPagination.propTypes = {
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  rowsPerPage: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onRowsPerPageChange: PropTypes.func.isRequired,
};

/** Breadcrumb, title, optional subtitle and actions. */
export const PageHeader = ({ crumbs, title, subtitle, actions }) => (
  <Box>
    {crumbs && <PageBreadcrumbs items={crumbs} />}
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ mt: crumbs ? 1 : 0 }}
      flexWrap="wrap"
      useFlexGap
    >
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
      </Box>
      {actions}
    </Stack>
  </Box>
);

PageHeader.propTypes = {
  crumbs: PropTypes.array,
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
};

/** Bordered panel holding tabs, toolbar, table and pagination. */
export const TablePanel = ({ children }) => (
  <Box
    sx={{
      border: 1,
      borderColor: 'divider',
      borderRadius: 1,
      overflow: 'hidden',
      bgcolor: 'background.paper',
    }}
  >
    {children}
  </Box>
);

TablePanel.propTypes = { children: PropTypes.node.isRequired };

/** Status tabs with counts, e.g. All / Published / Drafts. */
export const PanelTabs = ({ value, onChange, tabs }) => (
  <Tabs
    value={value}
    onChange={(_, v) => onChange(v)}
    variant="scrollable"
    sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
  >
    {tabs.map((t) => (
      <Tab
        key={t.value}
        value={t.value}
        label={
          <Stack direction="row" spacing={1} alignItems="center">
            <span>{t.label}</span>
            {t.count !== undefined && t.count !== null && (
              <Chip size="small" label={t.count} sx={{ height: 20 }} />
            )}
          </Stack>
        }
      />
    ))}
  </Tabs>
);

PanelTabs.propTypes = {
  value: PropTypes.any.isRequired,
  onChange: PropTypes.func.isRequired,
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.any,
      label: PropTypes.node,
      count: PropTypes.number,
    })
  ).isRequired,
};

/** Search box and filters above the table. */
export const PanelToolbar = ({ children }) => (
  <Stack
    direction={{ xs: 'column', md: 'row' }}
    spacing={1.5}
    sx={{ p: 2 }}
    alignItems={{ md: 'center' }}
  >
    {children}
  </Stack>
);

PanelToolbar.propTypes = { children: PropTypes.node.isRequired };

/** Search that applies on Enter (server lists) or as you type (onChange only). */
export const SearchField = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
}) => {
  const field = (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ 'aria-label': label || placeholder }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <FiSearch />
          </InputAdornment>
        ),
      }}
    />
  );
  return (
    <Box
      component={onSubmit ? 'form' : 'div'}
      onSubmit={
        onSubmit
          ? (e) => {
              e.preventDefault();
              onSubmit();
            }
          : undefined
      }
      sx={{ flex: 1, maxWidth: { md: 420 } }}
    >
      {field}
    </Box>
  );
};

SearchField.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  placeholder: PropTypes.string,
  label: PropTypes.string,
};

export const LoadingRows = ({ cols, rows = 5 }) =>
  Array.from({ length: rows }).map((_, i) => (
    <TableRow key={`loading-${i}`}>
      <TableCell colSpan={cols}>
        <Skeleton height={36} />
      </TableCell>
    </TableRow>
  ));

export const EmptyRow = ({ cols, children }) => (
  <TableRow>
    <TableCell colSpan={cols} align="center" sx={{ py: 6 }}>
      <Typography color="text.secondary">{children}</Typography>
    </TableCell>
  </TableRow>
);

EmptyRow.propTypes = {
  cols: PropTypes.number.isRequired,
  children: PropTypes.node.isRequired,
};

/**
 * The ⋮ menu at the end of a row. items: [{ label, icon, onClick, color,
 * hidden }] — hidden items are skipped; no visible items, no button.
 */
export const RowActions = ({ label, items }) => {
  const [anchor, setAnchor] = useState(null);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <>
      <IconButton
        aria-label={label}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <FiMoreVertical />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {visible.map((item) => (
          <MenuItem
            key={item.label}
            sx={item.color ? { color: `${item.color}.main` } : undefined}
            onClick={() => {
              setAnchor(null);
              item.onClick();
            }}
          >
            {item.icon && (
              <ListItemIcon
                sx={item.color ? { color: `${item.color}.main` } : undefined}
              >
                {item.icon}
              </ListItemIcon>
            )}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

RowActions.propTypes = {
  label: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
      onClick: PropTypes.func.isRequired,
      color: PropTypes.string,
      hidden: PropTypes.bool,
    })
  ).isRequired,
};
