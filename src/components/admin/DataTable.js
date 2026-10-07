// src/components/admin/DataTable.js — the back office's standard table kit,
// taken from the Product list: a page header with breadcrumb and actions, a
// bordered panel with optional status tabs and a toolbar, loading and empty
// rows, a row-actions menu, and one pagination (10 rows by default).
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  Link,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Popper,
  Skeleton,
  Stack,
  Tab,
  TableCell,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  FiArrowLeft,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiMoreVertical,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
const pageItems = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const set = new Set([0, total - 1, current - 1, current, current + 1]);
  const pages = [...set]
    .filter((p) => p >= 0 && p < total)
    .sort((a, b) => a - b);
  const out = [];
  pages.forEach((p, i) => {
    if (i && p - pages[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
};

/**
 * The standard paginator: "Showing 1–10 out of 23 items · Show all" and
 * first / previous / page numbers / next / last. Pages are 0-based.
 * onRowsPerPageChange receives an event-like { target: { value } }.
 */
export const StandardPagination = ({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  label = 'items',
  maxShowAll = 100,
}) => {
  const pages = Math.max(1, Math.ceil(count / rowsPerPage));
  const current = Math.min(page, pages - 1);
  const from = count ? current * rowsPerPage + 1 : 0;
  const to = Math.min(count, (current + 1) * rowsPerPage);
  const go = (p) => onPageChange(null, Math.max(0, Math.min(pages - 1, p)));
  const showingAll = rowsPerPage >= count && count > PAGE_SIZE;
  const canShowAll = count > rowsPerPage && count <= maxShowAll;
  const navButton = (labelText, icon, target, disabled) => (
    <IconButton
      size="small"
      aria-label={labelText}
      onClick={() => go(target)}
      disabled={disabled}
      sx={{ borderRadius: '8px', width: 32, height: 32 }}
    >
      {icon}
    </IconButton>
  );
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems="center"
      justifyContent="space-between"
      spacing={1.5}
      sx={{
        px: 2.5,
        py: 1.5,
        bgcolor: 'background.neutral',
        borderTop: 1,
        borderColor: 'divider',
      }}
      role="navigation"
      aria-label="Pagination"
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          Showing{' '}
          <Box component="strong" sx={{ color: 'text.primary' }}>
            {from}–{to}
          </Box>{' '}
          out of{' '}
          <Box component="strong" sx={{ color: 'text.primary' }}>
            {count}
          </Box>{' '}
          {label}
        </Typography>
        {canShowAll && (
          <Link
            component="button"
            type="button"
            underline="hover"
            variant="body2"
            onClick={() => onRowsPerPageChange({ target: { value: count } })}
          >
            Show all
          </Link>
        )}
        {showingAll && (
          <Link
            component="button"
            type="button"
            underline="hover"
            variant="body2"
            onClick={() =>
              onRowsPerPageChange({ target: { value: PAGE_SIZE } })
            }
          >
            Show fewer
          </Link>
        )}
      </Stack>
      {pages > 1 && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          {navButton('First page', <FiChevronsLeft />, 0, current === 0)}
          {navButton(
            'Previous page',
            <FiChevronLeft />,
            current - 1,
            current === 0
          )}
          {pageItems(current, pages).map((p) =>
            typeof p === 'string' ? (
              <Typography key={p} color="text.secondary" sx={{ px: 0.5 }}>
                …
              </Typography>
            ) : (
              <Box
                key={p}
                component="button"
                type="button"
                onClick={() => go(p)}
                aria-current={p === current ? 'page' : undefined}
                aria-label={`Page ${p + 1}`}
                sx={{
                  minWidth: 32,
                  height: 32,
                  px: 1,
                  border: 0,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  bgcolor: p === current ? 'primary.main' : 'transparent',
                  color:
                    p === current ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor:
                      p === current ? 'primary.dark' : 'background.neutralDeep',
                  },
                }}
              >
                {p + 1}
              </Box>
            )
          )}
          {navButton(
            'Next page',
            <FiChevronRight />,
            current + 1,
            current >= pages - 1
          )}
          {navButton(
            'Last page',
            <FiChevronsRight />,
            pages - 1,
            current >= pages - 1
          )}
        </Stack>
      )}
    </Stack>
  );
};

StandardPagination.propTypes = {
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  rowsPerPage: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onRowsPerPageChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  maxShowAll: PropTypes.number,
};

/** Breadcrumb, title, optional subtitle and actions. */
export const PageHeader = ({ crumbs, title, subtitle, actions }) => (
  <Box>
    {crumbs && <PageBreadcrumbs items={crumbs} />}
    {/* Phones: a back arrow to the level above instead of breadcrumbs. */}
    {crumbs && crumbs.length > 2 && (
      <Button
        component={RouterLink}
        to={crumbs[crumbs.length - 2].to}
        startIcon={<FiArrowLeft />}
        size="small"
        sx={{ display: { md: 'none' }, ml: -1, color: 'text.secondary' }}
      >
        {crumbs[crumbs.length - 2].label}
      </Button>
    )}
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ mt: crumbs ? { xs: 0.5, md: 1 } : 0 }}
      flexWrap="wrap"
      useFlexGap
    >
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{ fontSize: { xs: '1.6rem', md: undefined } }}
        >
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

/** Any list shown 10 at a time with the standard paginator, in a bordered box. */
export const PagedList = ({ rows, label, padded = false, children }) => {
  const paging = usePaging();
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={padded ? { px: 2, py: 0.5 } : undefined}>
        {children(rows ? paging.slice(rows) : rows)}
      </Box>
      {rows && rows.length > 0 && (
        <StandardPagination
          count={rows.length}
          {...paging.props}
          maxShowAll={0}
          label={label}
        />
      )}
    </Box>
  );
};
PagedList.propTypes = {
  rows: PropTypes.array,
  label: PropTypes.string.isRequired,
  padded: PropTypes.bool,
  children: PropTypes.func.isRequired,
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

/**
 * Search box for lists. Typing updates the list a moment after you stop
 * (no Enter needed); clearing it restores the full list at once. With
 * `suggest(q)` it also shows predictive suggestions as you type:
 * [{ key, label, secondary, image, to }].
 */
export const SearchField = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  suggest,
  delay = 300,
}) => {
  const navigate = useNavigate();
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const anchorRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const first = useRef(true);

  // Server lists: apply after a short pause, or straight away when cleared.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    if (!submitRef.current) return undefined;
    if (!value.trim()) {
      submitRef.current('');
      return undefined;
    }
    const t = setTimeout(() => submitRef.current(value.trim()), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  // Predictive suggestions.
  useEffect(() => {
    if (!suggest) return undefined;
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    let live = true;
    const t = setTimeout(() => {
      suggest(q)
        .then((list) => {
          if (!live) return;
          setSuggestions(list || []);
          setActive(-1);
        })
        .catch(() => live && setSuggestions([]));
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const go = (item) => {
    setOpen(false);
    navigate(item.to);
  };
  const showList = open && suggestions.length > 0;

  return (
    <Box
      component="form"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (showList && active >= 0) go(suggestions[active]);
        else {
          setOpen(false);
          submitRef.current?.(value.trim());
        }
      }}
      sx={{ flex: 1, maxWidth: { md: 420 }, position: 'relative' }}
      ref={anchorRef}
    >
      <TextField
        size="small"
        fullWidth
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        inputProps={{
          'aria-label': label || placeholder,
          role: suggest ? 'combobox' : undefined,
          'aria-expanded': suggest ? showList : undefined,
          'aria-autocomplete': suggest ? 'list' : undefined,
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <FiSearch />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="Clear search"
                onClick={() => onChange('')}
                edge="end"
              >
                <FiX />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />
      <Popper
        open={showList}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        sx={{ zIndex: 1300, width: anchorRef.current?.offsetWidth }}
      >
        <Paper
          role="listbox"
          aria-label="Suggestions"
          sx={{
            mt: 0.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: '8px',
            boxShadow: '0 16px 32px rgba(27,33,36,0.12)',
            overflow: 'hidden',
          }}
        >
          {suggestions.map((item, i) => (
            <Stack
              key={item.key}
              role="option"
              aria-selected={i === active}
              direction="row"
              spacing={1.5}
              alignItems="center"
              onMouseDown={(e) => {
                e.preventDefault();
                go(item);
              }}
              onMouseEnter={() => setActive(i)}
              sx={{
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                bgcolor: i === active ? 'background.neutral' : 'transparent',
              }}
            >
              {item.image !== undefined && (
                <Box
                  component={item.image ? 'img' : 'div'}
                  src={item.image || undefined}
                  alt=""
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '6px',
                    objectFit: 'contain',
                    bgcolor: 'background.neutral',
                    flexShrink: 0,
                  }}
                />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                {item.secondary && (
                  <Typography variant="caption" noWrap component="div">
                    {item.secondary}
                  </Typography>
                )}
              </Box>
            </Stack>
          ))}
        </Paper>
      </Popper>
    </Box>
  );
};

SearchField.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  suggest: PropTypes.func,
  delay: PropTypes.number,
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

/**
 * A toolbar filter like "Status ▾": a text button that opens a menu of
 * options. The chosen option's label appears next to the name.
 */
export const FilterMenu = ({ label, value, options, onChange }) => {
  const [anchor, setAnchor] = useState(null);
  const chosen = options.find((o) => o.value === value);
  const active = value !== '' && value !== undefined && value !== null;
  return (
    <>
      <Button
        color="inherit"
        endIcon={<FiChevronDown />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-label={`${label}${active ? `: ${chosen?.label}` : ''}`}
        sx={{
          fontWeight: 600,
          color: active ? 'primary.main' : 'text.primary',
          bgcolor: active ? 'primary.light' : 'transparent',
        }}
      >
        {label}
        {active && chosen ? `: ${chosen.label}` : ''}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        {options.map((o) => (
          <MenuItem
            key={o.value}
            selected={o.value === value}
            onClick={() => {
              setAnchor(null);
              onChange(o.value);
            }}
          >
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

FilterMenu.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.any,
  options: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.any, label: PropTypes.node })
  ).isRequired,
  onChange: PropTypes.func.isRequired,
};

/** Small coloured status label used in tables (Paid, Fulfilled, Active…). */
export const Pill = ({ label, tone = 'default' }) => {
  const tones = {
    success: ['success.light', 'success.main'],
    warning: ['warning.light', 'warning.main'],
    error: ['error.light', 'error.main'],
    info: ['info.light', 'info.main'],
    primary: ['primary.light', 'primary.main'],
    default: ['background.neutralDeep', 'text.primary'],
  };
  const [bg, fg] = tones[tone] || tones.default;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        px: 1,
        borderRadius: '6px',
        border: 1,
        borderColor: 'divider',
        bgcolor: bg,
        color: fg,
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
};

Pill.propTypes = { label: PropTypes.node.isRequired, tone: PropTypes.string };
