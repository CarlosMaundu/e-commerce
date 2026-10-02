// src/components/products/ProductFilters.js — Aurora-style filter sidebar for
// the product list. Filters are kept in the URL (see useProductQuery).
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Radio,
  Rating,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { isColorAttribute, swatchFor } from '../../utils/colors';

const csv = (v) => (v ? v.split(',').filter(Boolean) : []);
const ATTR = 'attr.';

/** Reads and writes the list filters in the query string. */
export const useProductQuery = () => {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => {
    const attrs = {};
    params.forEach((value, key) => {
      if (key.startsWith(ATTR)) attrs[key.slice(ATTR.length)] = csv(value);
    });
    const num = (k) => (params.get(k) ? Number(params.get(k)) : undefined);
    return {
      search: params.get('search') || '',
      categoryId: params.get('category') || '',
      brandIds: csv(params.get('brand')),
      priceMin: num('price_min'),
      priceMax: num('price_max'),
      rating: num('rating'),
      inStock: params.get('in_stock') === '1',
      onSale: params.get('on_sale') === '1',
      featured: params.get('featured') === '1',
      tag: params.get('tag') || '',
      attrs,
      sort: params.get('sort') || '',
      page: num('page') || 1,
    };
  }, [params]);

  /** Applies changes (null/''/[]/false removes a key) and resets the page. */
  const update = (changes, { keepPage = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      const empty =
        value === null ||
        value === undefined ||
        value === '' ||
        value === false ||
        (Array.isArray(value) && !value.length);
      if (empty) next.delete(key);
      else
        next.set(
          key,
          Array.isArray(value)
            ? value.join(',')
            : value === true
              ? '1'
              : String(value)
        );
    });
    if (!keepPage) next.delete('page');
    setParams(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams();
    if (params.get('search')) next.set('search', params.get('search'));
    if (params.get('sort')) next.set('sort', params.get('sort'));
    setParams(next);
  };

  return { filters, update, clearAll };
};

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = `filter-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <Box sx={{ py: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        component="button"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        sx={{
          width: '100%',
          bgcolor: 'transparent',
          border: 0,
          p: 0,
          cursor: 'pointer',
          color: 'text.primary',
        }}
      >
        <Typography variant="h6" component="h3">
          {title}
        </Typography>
        {open ? <FiChevronUp /> : <FiChevronDown />}
      </Stack>
      <Collapse in={open} id={id}>
        <Box sx={{ pt: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

Section.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  defaultOpen: PropTypes.bool,
};

const Count = ({ n }) => (
  <Typography component="span" variant="caption" sx={{ ml: 0.75 }}>
    ({n})
  </Typography>
);
Count.propTypes = { n: PropTypes.number };

const PriceFilter = ({ range, filters, update }) => {
  const min = Math.floor(range.min);
  const max = Math.ceil(range.max);
  const [value, setValue] = useState([
    filters.priceMin ?? min,
    filters.priceMax ?? max,
  ]);
  useEffect(() => {
    setValue([filters.priceMin ?? min, filters.priceMax ?? max]);
  }, [filters.priceMin, filters.priceMax, min, max]);
  if (max <= min) return null;
  const commit = ([lo, hi]) =>
    update({
      price_min: lo > min ? lo : null,
      price_max: hi < max ? hi : null,
    });
  return (
    <Section title="Price">
      <Box sx={{ px: 1 }}>
        <Slider
          value={value}
          min={min}
          max={max}
          onChange={(_, v) => setValue(v)}
          onChangeCommitted={(_, v) => commit(v)}
          getAriaLabel={(i) => (i === 0 ? 'Minimum price' : 'Maximum price')}
          valueLabelDisplay="auto"
        />
      </Box>
      <Stack direction="row" spacing={1}>
        {['Min', 'Max'].map((label, i) => (
          <TextField
            key={label}
            size="small"
            label={label}
            type="number"
            value={value[i]}
            onChange={(e) => {
              const v = [...value];
              v[i] = Number(e.target.value);
              setValue(v);
            }}
            onBlur={() => commit(value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              ),
            }}
          />
        ))}
      </Stack>
    </Section>
  );
};

PriceFilter.propTypes = {
  range: PropTypes.shape({ min: PropTypes.number, max: PropTypes.number })
    .isRequired,
  filters: PropTypes.object.isRequired,
  update: PropTypes.func.isRequired,
};

const ProductFilters = ({ facets, categories, filters, update, clearAll }) => {
  const toggle = (list, value) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const activeCategory = String(filters.categoryId || '');

  return (
    <Box aria-label="Filters" component="aside">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ pb: 1 }}
      >
        <Typography variant="overline" color="text.secondary">
          Filters
        </Typography>
        <Button size="small" onClick={clearAll}>
          Clear all
        </Button>
      </Stack>
      <Divider />

      <Section title="Category">
        <Stack spacing={0.25}>
          {[
            { id: '', name: 'All products', subcategories: [] },
            ...categories,
          ].map((c) => (
            <React.Fragment key={c.id || 'all'}>
              <FormControlLabel
                control={
                  <Radio
                    size="small"
                    checked={activeCategory === String(c.id)}
                  />
                }
                label={c.name}
                onChange={() => update({ category: c.id })}
              />
              {activeCategory &&
                (String(c.id) === activeCategory ||
                  c.subcategories?.some(
                    (s) => String(s.id) === activeCategory
                  )) &&
                c.subcategories?.map((s) => (
                  <FormControlLabel
                    key={s.id}
                    sx={{ pl: 3 }}
                    control={
                      <Radio
                        size="small"
                        checked={activeCategory === String(s.id)}
                      />
                    }
                    label={s.name}
                    onChange={() => update({ category: s.id })}
                  />
                ))}
            </React.Fragment>
          ))}
        </Stack>
      </Section>
      <Divider />

      <Section title="Availability">
        <Stack>
          <FormControlLabel
            control={<Checkbox size="small" checked={filters.inStock} />}
            label="In stock"
            onChange={(e) => update({ in_stock: e.target.checked })}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={filters.onSale} />}
            label="On sale"
            onChange={(e) => update({ on_sale: e.target.checked })}
          />
        </Stack>
      </Section>
      <Divider />

      {facets?.price && (
        <PriceFilter range={facets.price} filters={filters} update={update} />
      )}
      <Divider />

      {facets?.brands?.length > 0 && (
        <>
          <Section title="Brands">
            <Stack>
              {facets.brands.map((b) => (
                <FormControlLabel
                  key={b.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.brandIds.includes(String(b.id))}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      {b.logo && (
                        <Box
                          component="img"
                          src={b.logo}
                          alt=""
                          sx={{ height: 20, width: 50, objectFit: 'contain' }}
                        />
                      )}
                      <span>
                        {b.name}
                        <Count n={b.productCount} />
                      </span>
                    </Stack>
                  }
                  onChange={() =>
                    update({ brand: toggle(filters.brandIds, String(b.id)) })
                  }
                />
              ))}
            </Stack>
          </Section>
          <Divider />
        </>
      )}

      <Section title="Rating">
        <Stack>
          {[4, 3, 2].map((stars) => (
            <FormControlLabel
              key={stars}
              control={
                <Radio size="small" checked={filters.rating === stars} />
              }
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Rating value={stars} readOnly size="small" />
                  <Typography variant="body2">& up</Typography>
                </Stack>
              }
              onClick={() =>
                update({ rating: filters.rating === stars ? null : stars })
              }
            />
          ))}
        </Stack>
      </Section>

      {(facets?.attributes || []).map((attr) => {
        const chosen = filters.attrs[attr.name] || [];
        const key = `${ATTR}${attr.name}`;
        const colour = isColorAttribute(attr.name);
        return (
          <React.Fragment key={attr.name}>
            <Divider />
            <Section title={attr.name}>
              {colour ? (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {attr.values.map(({ value, count }) => {
                    const on = chosen.includes(value);
                    return (
                      <Tooltip key={value} title={`${value} (${count})`}>
                        <IconButton
                          aria-label={value}
                          aria-pressed={on}
                          onClick={() =>
                            update({ [key]: toggle(chosen, value) })
                          }
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: swatchFor(value),
                            border: 2,
                            borderColor: on ? 'primary.main' : 'divider',
                            color: [
                              'white',
                              'cream',
                              'beige',
                              'silver',
                              'floral',
                            ].includes(value.toLowerCase())
                              ? '#222'
                              : '#fff',
                            '&:hover': {
                              background: swatchFor(value),
                              opacity: 0.85,
                            },
                          }}
                        >
                          {on && <FiCheck size={14} />}
                        </IconButton>
                      </Tooltip>
                    );
                  })}
                </Stack>
              ) : (
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {attr.values.map(({ value, count }) => (
                    <Chip
                      key={value}
                      label={`${value} (${count})`}
                      size="small"
                      clickable
                      color={chosen.includes(value) ? 'primary' : 'default'}
                      variant={chosen.includes(value) ? 'filled' : 'outlined'}
                      aria-pressed={chosen.includes(value)}
                      onClick={() => update({ [key]: toggle(chosen, value) })}
                    />
                  ))}
                </Stack>
              )}
            </Section>
          </React.Fragment>
        );
      })}

      {facets?.tags?.length > 0 && (
        <>
          <Divider />
          <Section title="Tags" defaultOpen={false}>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {facets.tags.map(({ tag, count }) => (
                <Chip
                  key={tag}
                  label={`#${tag} (${count})`}
                  size="small"
                  clickable
                  color={filters.tag === tag ? 'primary' : 'default'}
                  variant={filters.tag === tag ? 'filled' : 'outlined'}
                  onClick={() =>
                    update({ tag: filters.tag === tag ? null : tag })
                  }
                />
              ))}
            </Stack>
          </Section>
        </>
      )}
    </Box>
  );
};

ProductFilters.propTypes = {
  facets: PropTypes.object,
  categories: PropTypes.array.isRequired,
  filters: PropTypes.object.isRequired,
  update: PropTypes.func.isRequired,
  clearAll: PropTypes.func.isRequired,
};

export default ProductFilters;
