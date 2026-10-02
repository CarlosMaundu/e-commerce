// src/components/products/ProductFilters.js — Aurora-style filter sidebar for
// the product list. Filters are kept in the URL (see useProductQuery).
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  FormControlLabel,
  InputAdornment,
  Rating,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
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
      categoryIds: csv(params.get('category')),
      brandIds: csv(params.get('brand')),
      priceMin: num('price_min'),
      priceMax: num('price_max'),
      rating: num('rating'),
      inStock: params.get('in_stock') === '1',
      onSale: params.get('on_sale') === '1',
      featured: params.get('featured') === '1',
      tags: csv(params.get('tag')),
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

/** A checkbox row: label, optional count, optional leading visual. */
const CheckRow = ({
  checked,
  onChange,
  label,
  count,
  lead,
  indent = false,
}) => (
  <FormControlLabel
    sx={{ mr: 0, ...(indent ? { pl: 3 } : {}) }}
    control={<Checkbox size="small" checked={checked} onChange={onChange} />}
    label={
      <Stack direction="row" spacing={1} alignItems="center">
        {lead}
        <Typography variant="body2" component="span">
          {label}
          {count !== undefined && <Count n={count} />}
        </Typography>
      </Stack>
    }
  />
);

CheckRow.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.node.isRequired,
  count: PropTypes.number,
  lead: PropTypes.node,
  indent: PropTypes.bool,
};

/** Long lists show the first few with "Show more". */
const MoreList = ({ items, limit = 6, children }) => {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <Stack>
      {shown.map(children)}
      {items.length > limit && (
        <Button
          size="small"
          onClick={() => setAll(!all)}
          sx={{ alignSelf: 'flex-start', mt: 0.5 }}
        >
          {all ? 'Show less' : `Show ${items.length - limit} more`}
        </Button>
      )}
    </Stack>
  );
};

MoreList.propTypes = {
  items: PropTypes.array.isRequired,
  limit: PropTypes.number,
  children: PropTypes.func.isRequired,
};

const ProductFilters = ({ facets, categories, filters, update, clearAll }) => {
  const toggle = (list, value) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const cats = filters.categoryIds;

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
        <Stack>
          {categories.map((c) => {
            const open =
              cats.includes(String(c.id)) ||
              c.subcategories?.some((s) => cats.includes(String(s.id)));
            return (
              <React.Fragment key={c.id}>
                <CheckRow
                  checked={cats.includes(String(c.id))}
                  onChange={() =>
                    update({ category: toggle(cats, String(c.id)) })
                  }
                  label={c.name}
                />
                {open &&
                  c.subcategories?.map((s) => (
                    <CheckRow
                      key={s.id}
                      indent
                      checked={cats.includes(String(s.id))}
                      onChange={() =>
                        update({ category: toggle(cats, String(s.id)) })
                      }
                      label={s.name}
                    />
                  ))}
              </React.Fragment>
            );
          })}
        </Stack>
      </Section>
      <Divider />

      <Section title="Availability">
        <Stack>
          <CheckRow
            checked={filters.inStock}
            onChange={(e) => update({ in_stock: e.target.checked })}
            label="In stock"
          />
          <CheckRow
            checked={filters.onSale}
            onChange={(e) => update({ on_sale: e.target.checked })}
            label="On sale"
          />
          <CheckRow
            checked={filters.featured}
            onChange={(e) => update({ featured: e.target.checked })}
            label="Featured"
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
            <MoreList items={facets.brands}>
              {(b) => (
                <CheckRow
                  key={b.id}
                  checked={filters.brandIds.includes(String(b.id))}
                  onChange={() =>
                    update({ brand: toggle(filters.brandIds, String(b.id)) })
                  }
                  label={b.name}
                  count={b.productCount}
                  lead={
                    b.logo ? (
                      <Box
                        component="img"
                        src={b.logo}
                        alt=""
                        sx={{ height: 18, width: 28, objectFit: 'contain' }}
                      />
                    ) : null
                  }
                />
              )}
            </MoreList>
          </Section>
          <Divider />
        </>
      )}

      <Section title="Rating">
        <Stack>
          {[4, 3, 2].map((stars) => (
            <CheckRow
              key={stars}
              checked={filters.rating === stars}
              onChange={() =>
                update({ rating: filters.rating === stars ? null : stars })
              }
              label={
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  component="span"
                >
                  <Rating value={stars} readOnly size="small" />
                  <span>& up</span>
                </Stack>
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
              <MoreList items={attr.values} limit={8}>
                {({ value, count }) => (
                  <CheckRow
                    key={value}
                    checked={chosen.includes(value)}
                    onChange={() => update({ [key]: toggle(chosen, value) })}
                    label={value}
                    count={count}
                    lead={
                      colour ? (
                        <Box
                          aria-hidden
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '4px',
                            background: swatchFor(value),
                            border: 1,
                            borderColor: 'divider',
                          }}
                        />
                      ) : null
                    }
                  />
                )}
              </MoreList>
            </Section>
          </React.Fragment>
        );
      })}

      {facets?.tags?.length > 0 && (
        <>
          <Divider />
          <Section title="Tags" defaultOpen={false}>
            <MoreList items={facets.tags}>
              {({ tag, count }) => (
                <CheckRow
                  key={tag}
                  checked={filters.tags.includes(tag)}
                  onChange={() => update({ tag: toggle(filters.tags, tag) })}
                  label={`#${tag}`}
                  count={count}
                />
              )}
            </MoreList>
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
