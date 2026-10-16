// src/components/layout/SearchSheet.js — search on phones: a full screen
// that opens from any page, with live suggestions as you type, recent
// searches and the categories. Back closes it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Avatar,
  Box,
  Chip,
  Dialog,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  ListSubheader,
  Slide,
  Stack,
  Typography,
} from '@mui/material';
import {
  FiArrowLeft,
  FiChevronRight,
  FiClock,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import { catalog } from '../../api';
import { formatMoney } from '../../utils/format';
import useBackToClose from '../../hooks/useBackToClose';
import { SEARCH_SCOPES } from './searchScopes';

const RECENT_KEY = 'recent-searches';

const readRecent = () => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.slice(0, 6) : [];
  } catch {
    return [];
  }
};

const remember = (q) => {
  try {
    const list = [q, ...readRecent().filter((x) => x !== q)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable: nothing to remember
  }
};

const SlideUp = React.forwardRef((props, ref) => (
  <Slide direction="up" ref={ref} {...props} />
));

const SearchSheet = ({
  open,
  onClose,
  initialQuery = '',
  initialScope = '',
}) => {
  const navigate = useNavigate();
  const closeThen = useBackToClose(open, onClose);
  const categories = useSelector((s) => s.categories.categories || []);
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState(initialScope);
  const [products, setProducts] = useState([]);
  const [recent, setRecent] = useState(readRecent);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setScope(initialScope);
    setRecent(readRecent());
  }, [open, initialQuery, initialScope]);

  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) {
      setProducts([]);
      return undefined;
    }
    let live = true;
    const t = setTimeout(() => {
      catalog
        .suggest(q)
        .then((list) => live && setProducts(list))
        .catch(() => live && setProducts([]));
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const allCategories = useMemo(
    () =>
      categories.flatMap((c) => [
        c,
        ...(c.subcategories || []).map((s) => ({ ...s, parent: c.name })),
      ]),
    [categories]
  );
  const matchingCategories = q
    ? allCategories
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 4)
    : [];

  const go = (to) => closeThen(() => navigate(to));

  const search = (text) => {
    const params = new URLSearchParams(
      SEARCH_SCOPES.find((s) => s.value === scope)?.params
    );
    const term = text.trim();
    if (term) {
      params.set('search', term);
      remember(term);
    }
    go(`/products${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={() => closeThen()}
      TransitionComponent={SlideUp}
      TransitionProps={{ onEntered: () => inputRef.current?.focus() }}
      PaperProps={{ 'aria-label': 'Search' }}
    >
      <Box
        component="form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          pt: 'calc(env(safe-area-inset-top) + 8px)',
          pb: 1,
          px: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton aria-label="Close search" onClick={() => closeThen()}>
            <FiArrowLeft />
          </IconButton>
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              flex: 1,
              height: 44,
              bgcolor: 'background.neutral',
              borderRadius: '8px',
              pl: 1.5,
              pr: 0.5,
            }}
          >
            <Box component={FiSearch} sx={{ color: 'text.secondary' }} />
            <InputBase
              inputRef={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, brands and categories"
              inputProps={{
                'aria-label': 'Search products',
                enterKeyHint: 'search',
                type: 'search',
              }}
              sx={{
                flex: 1,
                px: 1,
                fontSize: '1rem',
                minWidth: 0,
                // Our own clear button replaces the browser's.
                '& input::-webkit-search-cancel-button': { display: 'none' },
              }}
            />
            {query && (
              <IconButton
                size="small"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                <FiX />
              </IconButton>
            )}
          </Stack>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: 1,
            px: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {SEARCH_SCOPES.map((s) => (
            <Chip
              key={s.value || 'all'}
              label={s.label}
              color={scope === s.value ? 'primary' : 'default'}
              variant={scope === s.value ? 'filled' : 'outlined'}
              onClick={() => setScope(s.value)}
              aria-pressed={scope === s.value}
            />
          ))}
        </Stack>
      </Box>

      <Box sx={{ pb: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        {q ? (
          <List aria-label="Suggestions">
            <ListItemButton onClick={() => search(query)}>
              <ListItemAvatar>
                <Avatar variant="rounded" sx={{ bgcolor: 'primary.light' }}>
                  <Box component={FiSearch} sx={{ color: 'primary.main' }} />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={`See all results for “${q}”`}
                primaryTypographyProps={{ fontWeight: 600 }}
              />
            </ListItemButton>
            {matchingCategories.map((c) => (
              <ListItemButton
                key={`c${c.id}`}
                onClick={() => go(`/products?category=${c.id}`)}
              >
                <ListItemAvatar>
                  <Avatar variant="rounded" src={c.image || undefined}>
                    {c.name[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={c.name}
                  secondary={c.parent ? `In ${c.parent}` : 'Category'}
                />
              </ListItemButton>
            ))}
            {products.map((p) => {
              const onSale =
                p.specialPrice !== null && p.specialPrice !== undefined;
              return (
                <ListItemButton
                  key={p.id}
                  onClick={() => go(`/products/${p.id}`)}
                >
                  <ListItemAvatar>
                    <Avatar
                      variant="rounded"
                      src={p.images?.[0]}
                      alt=""
                      sx={{ bgcolor: 'background.neutral' }}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={p.title}
                    primaryTypographyProps={{ noWrap: true }}
                    secondary={formatMoney(onSale ? p.specialPrice : p.price)}
                  />
                </ListItemButton>
              );
            })}
          </List>
        ) : (
          <>
            {recent.length > 0 && (
              <List
                aria-label="Recent searches"
                subheader={
                  <ListSubheader
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    Recent searches
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem(RECENT_KEY);
                        } catch {
                          // nothing stored
                        }
                        setRecent([]);
                      }}
                      sx={{
                        border: 0,
                        bgcolor: 'transparent',
                        color: 'primary.main',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </Typography>
                  </ListSubheader>
                }
              >
                {recent.map((r) => (
                  <ListItemButton key={r} onClick={() => search(r)}>
                    <Box
                      component={FiClock}
                      sx={{ color: 'text.secondary', mr: 2 }}
                    />
                    <ListItemText primary={r} />
                  </ListItemButton>
                ))}
              </List>
            )}
            <List
              aria-label="Browse"
              subheader={<ListSubheader>Browse</ListSubheader>}
            >
              <ListItemButton onClick={() => go('/products?on_sale=1')}>
                <ListItemText
                  primary="Today’s deals"
                  primaryTypographyProps={{
                    fontWeight: 700,
                    color: 'warning.main',
                  }}
                />
                <FiChevronRight />
              </ListItemButton>
              {categories.map((c) => (
                <ListItemButton
                  key={c.id}
                  onClick={() => go(`/products?category=${c.id}`)}
                >
                  <ListItemAvatar>
                    <Avatar variant="rounded" src={c.image || undefined}>
                      {c.name[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={c.name} />
                  <FiChevronRight />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Box>
    </Dialog>
  );
};

SearchSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialQuery: PropTypes.string,
  initialScope: PropTypes.string,
};

export default SearchSheet;
