// src/pages/admin/products/ProductFormPage.js — one page to create, view and
// edit a product, laid out like Aurora's numbered product listing steps:
// vital info, description, images, variations, pricing and quantity,
// inventory, and tags.
import React, { useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  FiExternalLink,
  FiPlus,
  FiStar,
  FiTrash2,
  FiUpload,
  FiX,
} from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../auth/permissions';
import { adminCatalog, catalog } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import ConfirmationDialog from '../../../components/common/ConfirmationDialog';
import { formatMoney } from '../../../utils/format';
import BrandDialog from './BrandDialog';
import PageBreadcrumbs from '../../../components/common/PageBreadcrumbs';
import VariationsEditor, { LinkImagesDialog } from './VariationsEditor';
import { Pill } from '../../../components/admin/DataTable';
import { PRODUCT_STATUSES, statusInfo } from '../../../utils/productStatus';

const MAX_IMAGES = 10;
const NEW_BRAND = '__new__';

const EMPTY = {
  title: '',
  description: '',
  categoryId: '',
  brandId: '',
  sku: '',
  images: [],
  hasVariants: false,
  attributes: [],
  variants: [],
  price: '',
  specialPrice: '',
  quantity: 0,
  trackInventory: true,
  lowStockThreshold: 5,
  tags: [],
  featured: false,
  status: 'published',
  imageLinks: {},
};

/** Photos linked to each option value, recovered from the variants. */
const linksFrom = (attributes, variants) => {
  const links = {};
  attributes.forEach((a) => {
    a.values.forEach((value) => {
      const withValue = variants.filter((v) => v.options[a.name] === value);
      if (!withValue.length) return;
      const common = withValue[0].images.filter((src) =>
        withValue.every((v) => v.images.includes(src))
      );
      if (common.length)
        links[a.name] = { ...(links[a.name] || {}), [value]: common };
    });
  });
  return links;
};

/** A variant's photos: those linked to each of its option values. */
export const variantImages = (options, links) => [
  ...new Set(
    Object.entries(options).flatMap(
      ([name, value]) => links[name]?.[value] || []
    )
  ),
];

/** Trimmed names and values, without blanks or duplicates. */
const cleanAttributes = (attributes) =>
  attributes.map((a) => ({
    name: a.name.trim(),
    values: [...new Set(a.values.map((v) => v.trim()).filter(Boolean))],
  }));

const baseFromProduct = (p) => ({
  title: p.title,
  description: p.description,
  categoryId: p.category?.id || '',
  brandId: p.brand?.id || '',
  sku: p.sku,
  images: p.images,
  hasVariants: p.attributes.length > 0,
  attributes: p.attributes.map((a) => ({
    name: a.name,
    values: [...a.values],
  })),
  variants: p.variants.map((v) => ({
    // Stored options lose their order; follow the variations' order.
    options: Object.fromEntries(
      p.attributes.map((a) => [a.name, v.options[a.name]])
    ),
    sku: v.sku,
    price: v.ownPrice ? v.price : '',
    specialPrice: v.ownPrice && v.specialPrice !== null ? v.specialPrice : '',
    quantity: v.quantity,
    images: v.images,
  })),
  price: p.price,
  specialPrice: p.specialPrice ?? '',
  quantity: p.quantity ?? 0,
  trackInventory: p.trackInventory,
  lowStockThreshold: p.lowStockThreshold,
  tags: p.tags,
  featured: p.featured,
  status: p.status,
  imageLinks: linksFrom(p.attributes, p.variants),
});

const sameList = (a, b) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** A variant's photos: its own pick, or those linked to its values. */
const photosOf = (v, links) => v.ownImages ?? variantImages(v.options, links);

const fromProduct = (p) => {
  const form = baseFromProduct(p);
  // Variants whose photos differ from their values' links keep their own.
  form.variants = form.variants.map((v) => {
    const linked = variantImages(v.options, form.imageLinks);
    return { ...v, ownImages: sameList(v.images, linked) ? null : v.images };
  });
  return form;
};

const combos = (attributes) =>
  attributes
    .filter((a) => a.name.trim() && a.values.length)
    .reduce(
      (acc, a) =>
        acc.flatMap((c) => a.values.map((v) => ({ ...c, [a.name.trim()]: v }))),
      [{}]
    );

const sameOptions = (a, b) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
};

/** Rebuilds the variant list for the attributes, keeping what was entered. */
const syncVariants = (attributes, current) => {
  const valid = attributes.filter((a) => a.name.trim() && a.values.length);
  if (!valid.length) return [];
  return combos(valid).map(
    (options) =>
      current.find((v) => sameOptions(v.options, options)) || {
        options,
        sku: '',
        price: '',
        specialPrice: '',
        quantity: 0,
        images: [],
      }
  );
};

const label = (options) => Object.values(options).join(' / ');

const num = (v) =>
  v === '' || v === null || v === undefined ? null : Number(v);

const validate = (f) => {
  const errors = {};
  if (!f.title.trim()) errors.title = 'Please enter a product name.';
  if (!(num(f.price) > 0))
    errors.price = 'Please enter a price greater than zero.';
  if (num(f.specialPrice) !== null && num(f.specialPrice) >= num(f.price)) {
    errors.specialPrice =
      'The sale price must be lower than the regular price.';
  }
  if (f.hasVariants) {
    const names = f.attributes.map((a) => a.name.trim().toLowerCase());
    if (!f.attributes.length)
      errors.attributes =
        'Add at least one variation, or choose “does not have variants”.';
    else if (names.some((n) => !n))
      errors.attributes = 'Please name every variation.';
    else if (new Set(names).size !== names.length)
      errors.attributes = 'Each variation needs a different name.';
    else if (f.attributes.some((a) => !a.values.length))
      errors.attributes = 'Add at least one value to every variation.';
    f.variants.forEach((v) => {
      const price = num(v.price) ?? num(f.price);
      if (num(v.specialPrice) !== null && num(v.specialPrice) >= price) {
        errors.variants = `The sale price for ${label(v.options)} must be lower than its price.`;
      }
    });
  }
  return errors;
};

// ---------- layout ----------

const Step = ({ n, title, open, onToggle, done, children, error }) => (
  <Box
    component="section"
    sx={{ borderBottom: 1, borderColor: 'divider' }}
    aria-labelledby={`step-${n}`}
  >
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      component="button"
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      sx={{
        width: '100%',
        py: 2.5,
        px: 0,
        border: 0,
        bgcolor: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'text.primary',
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: '0.85rem',
          bgcolor: open
            ? 'primary.main'
            : error
              ? 'error.light'
              : 'background.neutralDeep',
          color: open ? '#fff' : error ? 'error.main' : 'text.primary',
        }}
      >
        {n}
      </Box>
      <Typography variant="h6" component="h2" id={`step-${n}`} sx={{ flex: 1 }}>
        {title}
      </Typography>
      {!open && done && (
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ maxWidth: '45%' }}
        >
          {done}
        </Typography>
      )}
    </Stack>
    <Collapse in={open} unmountOnExit={false}>
      <Box sx={{ pl: { md: 6 }, pb: 3 }}>{children}</Box>
    </Collapse>
  </Box>
);

Step.propTypes = {
  n: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  open: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  done: PropTypes.node,
  children: PropTypes.node.isRequired,
  error: PropTypes.bool,
};

const StepNav = ({ onPrev, onNext }) => (
  <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
    {onPrev && (
      <Button onClick={onPrev} sx={{ bgcolor: 'background.neutral' }}>
        Previous
      </Button>
    )}
    {onNext && (
      <Button onClick={onNext} sx={{ bgcolor: 'background.neutral' }}>
        Next
      </Button>
    )}
  </Stack>
);

StepNav.propTypes = { onPrev: PropTypes.func, onNext: PropTypes.func };

const ImagePicker = ({ images, chosen, onChange, labelText }) => (
  <Stack
    direction="row"
    spacing={1}
    flexWrap="wrap"
    useFlexGap
    role="group"
    aria-label={labelText}
  >
    {images.map((src, i) => {
      const on = chosen.includes(src);
      return (
        <Box
          key={src}
          component="button"
          type="button"
          aria-pressed={on}
          aria-label={`${labelText}: photo ${i + 1}`}
          onClick={() =>
            onChange(on ? chosen.filter((s) => s !== src) : [...chosen, src])
          }
          sx={{
            p: 0,
            width: 52,
            height: 52,
            borderRadius: '8px',
            overflow: 'hidden',
            cursor: 'pointer',
            border: 2,
            borderColor: on ? 'primary.main' : 'transparent',
            opacity: on ? 1 : 0.55,
            bgcolor: 'transparent',
          }}
        >
          <Box
            component="img"
            src={src}
            alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      );
    })}
  </Stack>
);

ImagePicker.propTypes = {
  images: PropTypes.array.isRequired,
  chosen: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  labelText: PropTypes.string.isRequired,
};

// ---------- page ----------

const ProductFormPage = () => {
  const { id } = useParams();
  const isNew = !id;
  const { user } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const canEdit = hasPermission(
    user,
    isNew ? PERMISSIONS.productsCreate : PERMISSIONS.productsUpdate
  );
  const canDelete = !isNew && hasPermission(user, PERMISSIONS.productsDelete);
  const canAddBrand = hasPermission(user, 'catalog.brands.create');

  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [original, setOriginal] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [open, setOpen] = useState(1);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [brandDialog, setBrandDialog] = useState(null); // { name }
  const [deleting, setDeleting] = useState(false);
  const [variantPhotos, setVariantPhotos] = useState(null); // variant index
  const [bulk, setBulk] = useState({
    price: '',
    specialPrice: '',
    quantity: '',
  });

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
      .then((t) => setTagOptions(t.map((x) => x.tag)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY);
      setOriginal(null);
      return;
    }
    let active = true;
    setForm(null);
    adminCatalog
      .getProduct(id)
      .then((p) => {
        if (!active) return;
        setOriginal(p);
        setForm(fromProduct(p));
      })
      .catch((error) => {
        notify.error(error, 'We couldn’t load that product.');
        navigate('/admin/products');
      });
    return () => {
      active = false;
    };
  }, [id, isNew, navigate, notify]);

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));

  const setAttributes = (attributes) =>
    setForm((f) => ({
      ...f,
      attributes,
      variants: syncVariants(cleanAttributes(attributes), f.variants),
    }));

  const setVariant = (index, changes) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) =>
        i === index ? { ...v, ...changes } : v
      ),
    }));

  /** Uploads photos into the gallery; returns their URLs. */
  const uploadFiles = async (files) => {
    const list = Array.from(files || []).slice(
      0,
      MAX_IMAGES - form.images.length
    );
    const urls = [];
    if (!list.length) {
      if (files?.length)
        notify.error(`You can add up to ${MAX_IMAGES} photos.`);
      return urls;
    }
    setUploading(list.length);
    for (const file of list) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { url } = await adminCatalog.uploadFile(file);
        urls.push(url);
        setForm((f) => ({ ...f, images: [...f.images, url] }));
      } catch (error) {
        notify.error(error, `We couldn’t upload ${file.name}.`);
      }
      setUploading((n) => n - 1);
    }
    return urls;
  };

  const removeImage = (src) =>
    setForm((f) => ({
      ...f,
      images: f.images.filter((x) => x !== src),
      imageLinks: Object.fromEntries(
        Object.entries(f.imageLinks).map(([name, byValue]) => [
          name,
          Object.fromEntries(
            Object.entries(byValue).map(([v, urls]) => [
              v,
              urls.filter((x) => x !== src),
            ])
          ),
        ])
      ),
    }));

  const makeCover = (src) =>
    setForm((f) => ({
      ...f,
      images: [src, ...f.images.filter((s) => s !== src)],
    }));

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!/^https:\/\/\S+$/i.test(url)) {
      notify.error('Please enter a full https:// link to an image.');
      return;
    }
    set({ images: [...form.images, url] });
    setImageUrl('');
  };

  const applyBulk = () =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => ({
        ...v,
        ...(bulk.price !== '' ? { price: bulk.price } : {}),
        ...(bulk.specialPrice !== ''
          ? { specialPrice: bulk.specialPrice }
          : {}),
        ...(bulk.quantity !== '' ? { quantity: bulk.quantity } : {}),
      })),
    }));

  const save = async (status) => {
    const next = { ...form, status: status || form.status };
    const found = validate({
      ...next,
      attributes: cleanAttributes(next.attributes),
    });
    setErrors(found);
    if (Object.keys(found).length) {
      setOpen(
        found.title
          ? 1
          : found.attributes
            ? 4
            : found.price || found.specialPrice || found.variants
              ? 5
              : open
      );
      notify.error(Object.values(found)[0]);
      return;
    }
    const payload = next.hasVariants
      ? {
          ...next,
          attributes: cleanAttributes(next.attributes),
          variants: next.variants.map((v) => ({
            ...v,
            images: photosOf(v, next.imageLinks),
          })),
        }
      : { ...next, attributes: [], variants: [] };
    setSaving(true);
    try {
      const saved = isNew
        ? await adminCatalog.createProduct(payload)
        : await adminCatalog.updateProduct(id, payload);
      notify.success(
        isNew
          ? `${saved.title} ${saved.status === 'draft' ? 'saved as a draft' : 'is now in the shop'}.`
          : 'Product saved.'
      );
      if (isNew) navigate(`/admin/products/${saved.id}`, { replace: true });
      else {
        setOriginal(saved);
        setForm(fromProduct(saved));
      }
    } catch (error) {
      notify.error(error, 'We couldn’t save the product.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await adminCatalog.deleteProduct(id);
      notify.success('Product deleted.');
      navigate('/admin/products', { replace: true });
    } catch (error) {
      notify.error(error, 'We couldn’t delete the product.');
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <Stack spacing={2}>
        <Skeleton height={60} width="40%" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={72} />
        ))}
      </Stack>
    );
  }

  const step = (n) => ({
    n,
    open: open === n,
    onToggle: () => setOpen(open === n ? 0 : n),
  });
  const nav = (n) => (
    <StepNav
      onPrev={n > 1 ? () => setOpen(n - 1) : undefined}
      onNext={n < 7 ? () => setOpen(n + 1) : undefined}
    />
  );
  const categoryOptions = categories.flatMap((c) => [
    { id: c.id, name: c.name, depth: 0 },
    ...(c.subcategories || []).map((s) => ({
      id: s.id,
      name: s.name,
      depth: 1,
    })),
  ]);
  const brand =
    brands.find((b) => String(b.id) === String(form.brandId)) || null;
  const totalVariantStock = form.variants.reduce(
    (s, v) => s + (Number(v.quantity) || 0),
    0
  );
  const readOnly = !canEdit;

  return (
    <Box component="form" onSubmit={(e) => e.preventDefault()} noValidate>
      <fieldset
        disabled={readOnly || saving}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <PageBreadcrumbs
          items={[
            { label: 'Products', to: '/admin/products' },
            isNew
              ? { label: 'Add product', to: '/admin/products/new' }
              : {
                  label: original?.title || 'Product',
                  to: `/admin/products/${id}`,
                },
          ]}
        />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'center' }}
          sx={{
            position: 'sticky',
            top: 72,
            zIndex: 2,
            bgcolor: 'background.paper',
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h3" component="h1" noWrap>
                {isNew ? 'Add product' : form.title || 'Untitled product'}
              </Typography>
              {!isNew && (
                <Pill
                  label={statusInfo(original?.status).label}
                  tone={statusInfo(original?.status).tone}
                />
              )}
            </Stack>
            {readOnly && (
              <Typography variant="body2" color="text.secondary">
                You can view this product but not change it.
              </Typography>
            )}
          </Box>
          {!isNew && original?.status === 'published' && (
            <Button
              component="a"
              href={`/products/${id}`}
              target="_blank"
              startIcon={<FiExternalLink />}
            >
              View in shop
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                onClick={() => save('draft')}
                disabled={saving}
                sx={{ bgcolor: 'background.neutral' }}
              >
                {form.status === 'draft' || isNew
                  ? 'Save draft'
                  : 'Move to drafts'}
              </Button>
              <Button
                variant="contained"
                onClick={() => save('published')}
                disabled={saving || uploading > 0}
              >
                {saving
                  ? 'Saving…'
                  : isNew || form.status === 'draft'
                    ? 'Publish'
                    : 'Save changes'}
              </Button>
            </>
          )}
        </Stack>

        <Box sx={{ maxWidth: 980 }}>
          <Step
            {...step(1)}
            title="Vital info"
            error={Boolean(errors.title)}
            done={form.title}
          >
            <Stack spacing={2}>
              <TextField
                label="Product name"
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                error={Boolean(errors.title)}
                helperText={errors.title}
                required
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Category"
                  value={form.categoryId}
                  onChange={(e) => set({ categoryId: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="">No category</MenuItem>
                  {categoryOptions.map((c) => (
                    <MenuItem
                      key={c.id}
                      value={c.id}
                      sx={{ pl: c.depth ? 4 : 2 }}
                    >
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Autocomplete
                  fullWidth
                  options={[
                    ...brands,
                    ...(canAddBrand
                      ? [{ id: NEW_BRAND, name: 'Add a new brand…' }]
                      : []),
                  ]}
                  value={brand}
                  getOptionLabel={(b) => b.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, b) => {
                    if (b?.id === NEW_BRAND) setBrandDialog({ name: '' });
                    else set({ brandId: b?.id || '' });
                  }}
                  renderOption={(props, b) => (
                    <li {...props} key={b.id}>
                      {b.id === NEW_BRAND ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ color: 'primary.main', fontWeight: 600 }}
                        >
                          <FiPlus /> <span>{b.name}</span>
                        </Stack>
                      ) : (
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              width: 56,
                              height: 24,
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            {b.logo && (
                              <Box
                                component="img"
                                src={b.logo}
                                alt=""
                                sx={{ maxWidth: '100%', maxHeight: 24 }}
                              />
                            )}
                          </Box>
                          <span>{b.name}</span>
                        </Stack>
                      )}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Brand"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: brand?.logo ? (
                          <InputAdornment position="start">
                            <Box
                              component="img"
                              src={brand.logo}
                              alt=""
                              sx={{ height: 20, maxWidth: 50 }}
                            />
                          </InputAdornment>
                        ) : null,
                      }}
                    />
                  )}
                />
              </Stack>
              {!form.hasVariants && (
                <TextField
                  label="SKU (stock keeping unit)"
                  value={form.sku}
                  onChange={(e) => set({ sku: e.target.value })}
                  helperText="Optional. Must be unique."
                  fullWidth
                />
              )}
            </Stack>
            {nav(1)}
          </Step>

          <Step
            {...step(2)}
            title="Product information"
            done={form.description ? `${form.description.slice(0, 60)}…` : null}
          >
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              multiline
              minRows={6}
              fullWidth
              helperText="Shown on the product page. Start lines with • for a bullet list."
            />
            {nav(2)}
          </Step>

          <Step
            {...step(3)}
            title="Images"
            done={
              form.images.length
                ? `${form.images.length} photo${form.images.length === 1 ? '' : 's'}`
                : null
            }
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 1.5,
              }}
            >
              {form.images.map((src, i) => (
                <Box
                  key={src}
                  sx={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    component="img"
                    src={src}
                    alt={`Product photo ${i + 1}`}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {i === 0 && (
                    <Chip
                      size="small"
                      label="Cover"
                      color="primary"
                      sx={{ position: 'absolute', left: 6, top: 6 }}
                    />
                  )}
                  {canEdit && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ position: 'absolute', right: 4, bottom: 4 }}
                    >
                      {i > 0 && (
                        <Tooltip title="Make cover">
                          <IconButton
                            size="small"
                            aria-label={`Make photo ${i + 1} the cover`}
                            onClick={() => makeCover(src)}
                            sx={{
                              bgcolor: 'background.paper',
                              '&:hover': { bgcolor: 'background.paper' },
                            }}
                          >
                            <FiStar />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          aria-label={`Remove photo ${i + 1}`}
                          onClick={() => removeImage(src)}
                          sx={{
                            bgcolor: 'background.paper',
                            '&:hover': { bgcolor: 'background.paper' },
                          }}
                        >
                          <FiX />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </Box>
              ))}
              {canEdit && form.images.length < MAX_IMAGES && (
                <Box
                  component="button"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  sx={{
                    aspectRatio: '1 / 1',
                    borderRadius: '8px',
                    border: '2px dashed',
                    borderColor: 'divider',
                    bgcolor: 'background.neutral',
                    cursor: 'pointer',
                    color: 'text.secondary',
                    display: 'grid',
                    placeItems: 'center',
                    font: 'inherit',
                  }}
                >
                  <Stack alignItems="center" spacing={0.5}>
                    <FiUpload size={20} />
                    <span>
                      {uploading ? `Uploading ${uploading}…` : 'Upload photos'}
                    </span>
                  </Stack>
                </Box>
              )}
            </Box>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="image/png,image/jpeg,image/webp,image/gif"
              aria-label="Product photos"
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {canEdit && (
              <Stack direction="row" spacing={1} sx={{ mt: 2, maxWidth: 560 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Or add an image link"
                  placeholder="https://…"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <Button onClick={addImageUrl} disabled={!imageUrl.trim()}>
                  Add
                </Button>
              </Stack>
            )}
            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
              Up to {MAX_IMAGES} photos, 5 MB each. The cover appears in lists.
              Square photos look best.
            </Typography>
            {nav(3)}
          </Step>

          <Step
            {...step(4)}
            title="Variations"
            error={Boolean(errors.attributes)}
            done={
              form.hasVariants
                ? `${form.attributes.map((a) => a.name).join(', ')} · ${form.variants.length} variants`
                : 'No variants'
            }
          >
            <RadioGroup
              value={form.hasVariants ? 'yes' : 'no'}
              onChange={(e) => {
                const yes = e.target.value === 'yes';
                set({ hasVariants: yes });
                if (yes && !form.attributes.length)
                  setAttributes([{ name: 'Color', values: [''] }]);
              }}
            >
              <FormControlLabel
                value="no"
                control={<Radio />}
                label="This product does not have variants"
              />
              <FormControlLabel
                value="yes"
                control={<Radio />}
                label="This product has variants, like size or color"
              />
            </RadioGroup>
            {form.hasVariants && (
              <Stack spacing={2} sx={{ mt: 2 }}>
                {errors.attributes && (
                  <Alert severity="error">{errors.attributes}</Alert>
                )}
                <VariationsEditor
                  attributes={form.attributes}
                  onChange={setAttributes}
                  links={form.imageLinks}
                  onLinksChange={(imageLinks) => set({ imageLinks })}
                  images={form.images}
                  onUpload={uploadFiles}
                  uploading={uploading > 0}
                />
                {form.variants.length > 0 && (
                  <Typography color="text.secondary">
                    {form.variants.length} combination
                    {form.variants.length === 1 ? '' : 's'}:{' '}
                    {form.variants
                      .slice(0, 6)
                      .map((v) => label(v.options))
                      .join(', ')}
                    {form.variants.length > 6 ? '…' : ''}
                  </Typography>
                )}
                {form.variants.length > 200 && (
                  <Alert severity="warning">
                    That’s more than 200 combinations. Please remove some
                    values.
                  </Alert>
                )}
              </Stack>
            )}
            {nav(4)}
          </Step>

          <Step
            {...step(5)}
            title="Pricing and quantity"
            error={Boolean(
              errors.price || errors.specialPrice || errors.variants
            )}
            done={
              num(form.price)
                ? `${formatMoney(num(form.price))}${num(form.specialPrice) ? ` · sale ${formatMoney(num(form.specialPrice))}` : ''}`
                : null
            }
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ maxWidth: 640 }}
            >
              <TextField
                label={form.hasVariants ? 'Default price' : 'Regular price'}
                type="number"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
                error={Boolean(errors.price)}
                helperText={
                  errors.price ||
                  (form.hasVariants
                    ? 'Used by variants without their own price.'
                    : ' ')
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, step: '0.01' }}
                required
                fullWidth
              />
              <TextField
                label={form.hasVariants ? 'Default sale price' : 'Sale price'}
                type="number"
                value={form.specialPrice}
                onChange={(e) => set({ specialPrice: e.target.value })}
                error={Boolean(errors.specialPrice)}
                helperText={
                  errors.specialPrice || 'Optional. Leave empty for no sale.'
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, step: '0.01' }}
                fullWidth
              />
              {!form.hasVariants && form.trackInventory && (
                <TextField
                  label="Quantity"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => set({ quantity: e.target.value })}
                  inputProps={{ min: 0 }}
                  helperText=" "
                  fullWidth
                />
              )}
            </Stack>

            {form.hasVariants && form.variants.length > 0 && (
              <Box sx={{ mt: 3 }}>
                {errors.variants && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {errors.variants}
                  </Alert>
                )}
                <TableContainer
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                >
                  <Table
                    size="small"
                    aria-label="Variant prices and quantities"
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Variant</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Sale price</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow sx={{ bgcolor: 'background.neutral' }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Set all
                          </Typography>
                        </TableCell>
                        {['quantity', 'price', 'specialPrice'].map((k) => (
                          <TableCell key={k}>
                            <TextField
                              size="small"
                              type="number"
                              value={bulk[k]}
                              onChange={(e) =>
                                setBulk({ ...bulk, [k]: e.target.value })
                              }
                              inputProps={{
                                'aria-label': `Set all ${k === 'specialPrice' ? 'sale prices' : k === 'price' ? 'prices' : 'quantities'}`,
                                min: 0,
                              }}
                              sx={{ width: 110 }}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          sx={{ textAlign: 'right', py: 0.5 }}
                        >
                          <Button
                            size="small"
                            onClick={applyBulk}
                            disabled={
                              !bulk.price &&
                              !bulk.specialPrice &&
                              bulk.quantity === ''
                            }
                          >
                            Apply to all variants
                          </Button>
                        </TableCell>
                      </TableRow>
                      {form.variants.map((v, i) => (
                        <TableRow
                          key={label(v.options)}
                          data-testid={`variant-${label(v.options)}`}
                        >
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Tooltip
                                title={
                                  v.ownImages
                                    ? 'Photos picked for this variant'
                                    : 'Photos linked to its options'
                                }
                              >
                                <Box
                                  component="button"
                                  type="button"
                                  onClick={() => setVariantPhotos(i)}
                                  aria-label={`Photos for ${label(v.options)}`}
                                  sx={{
                                    p: 0,
                                    width: 36,
                                    height: 36,
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    border: 2,
                                    borderColor: v.ownImages
                                      ? 'primary.main'
                                      : 'divider',
                                    bgcolor: 'background.neutralDeep',
                                    flexShrink: 0,
                                  }}
                                >
                                  {photosOf(v, form.imageLinks)[0] && (
                                    <Box
                                      component="img"
                                      src={photosOf(v, form.imageLinks)[0]}
                                      alt=""
                                      sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                      }}
                                    />
                                  )}
                                </Box>
                              </Tooltip>
                              <Typography variant="body2">
                                {label(v.options)}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={v.quantity}
                              disabled={!form.trackInventory}
                              onChange={(e) =>
                                setVariant(i, { quantity: e.target.value })
                              }
                              inputProps={{
                                'aria-label': `Quantity for ${label(v.options)}`,
                                min: 0,
                              }}
                              sx={{ width: 110 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={v.price}
                              placeholder={form.price ? String(form.price) : ''}
                              onChange={(e) =>
                                setVariant(i, { price: e.target.value })
                              }
                              inputProps={{
                                'aria-label': `Price for ${label(v.options)}`,
                                min: 0,
                                step: '0.01',
                              }}
                              sx={{ width: 110 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={v.specialPrice}
                              placeholder={
                                v.price === '' && form.specialPrice
                                  ? String(form.specialPrice)
                                  : ''
                              }
                              onChange={(e) =>
                                setVariant(i, { specialPrice: e.target.value })
                              }
                              inputProps={{
                                'aria-label': `Sale price for ${label(v.options)}`,
                                min: 0,
                                step: '0.01',
                              }}
                              sx={{ width: 110 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  Leave a variant’s price empty to use the default price and
                  sale price.
                  {form.trackInventory && ` Total stock: ${totalVariantStock}.`}
                </Typography>
              </Box>
            )}
            {nav(5)}
          </Step>

          <Step
            {...step(6)}
            title="Inventory"
            done={
              form.trackInventory
                ? `Tracked · alert at ${form.lowStockThreshold}`
                : 'Not tracked'
            }
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.trackInventory}
                    onChange={(e) => set({ trackInventory: e.target.checked })}
                  />
                }
                label="Track quantity (sell only what’s in stock)"
              />
              {form.trackInventory && (
                <TextField
                  label="Low stock alert at"
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(e) => set({ lowStockThreshold: e.target.value })}
                  helperText="Shown as “Low stock” in lists and on the dashboard."
                  inputProps={{ min: 0 }}
                  sx={{ maxWidth: 260 }}
                />
              )}
            </Stack>
            {form.hasVariants && form.variants.length > 0 && (
              <TableContainer
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mt: 2,
                }}
              >
                <Table size="small" aria-label="Variant SKUs">
                  <TableHead>
                    <TableRow>
                      <TableCell>Variant</TableCell>
                      <TableCell>SKU (stock keeping unit)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {form.variants.map((v, i) => (
                      <TableRow key={label(v.options)}>
                        <TableCell>{label(v.options)}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={v.sku}
                            onChange={(e) =>
                              setVariant(i, { sku: e.target.value })
                            }
                            inputProps={{
                              'aria-label': `SKU for ${label(v.options)}`,
                            }}
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {nav(6)}
          </Step>

          <Step
            {...step(7)}
            title="Tags and visibility"
            done={
              form.tags.length ? form.tags.map((t) => `#${t}`).join(' ') : null
            }
          >
            <Stack spacing={2.5}>
              <Autocomplete
                multiple
                freeSolo
                options={tagOptions.filter((t) => !form.tags.includes(t))}
                value={form.tags}
                onChange={(_, tags) =>
                  set({
                    tags: [
                      ...new Set(
                        tags
                          .map((t) =>
                            t.trim().toLowerCase().replace(/\s+/g, '-')
                          )
                          .filter(Boolean)
                      ),
                    ],
                  })
                }
                renderTags={(values, getTagProps) =>
                  values.map((t, i) => (
                    <Chip
                      {...getTagProps({ index: i })}
                      key={t}
                      size="small"
                      label={`#${t}`}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder={
                      form.tags.length ? '' : 'e.g. summer, gift, new-season'
                    }
                    helperText="Shoppers can search and filter by tags; promotions can link to a tag."
                  />
                )}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.featured}
                    onChange={(e) => set({ featured: e.target.checked })}
                  />
                }
                label="Feature on the home page"
              />
              <RadioGroup
                value={form.status}
                onChange={(e) => set({ status: e.target.value })}
              >
                {PRODUCT_STATUSES.map((st) => (
                  <FormControlLabel
                    key={st.value}
                    value={st.value}
                    control={<Radio />}
                    label={`${st.label} — ${st.help.charAt(0).toLowerCase()}${st.help.slice(1)}`}
                  />
                ))}
              </RadioGroup>
            </Stack>
            {nav(7)}
          </Step>

          {canDelete && (
            <Box
              sx={{
                mt: 4,
                p: 2.5,
                border: 1,
                borderColor: 'error.light',
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle1">Delete product</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Removes it from the shop and from customers’ carts. Past orders
                keep their details.
              </Typography>
              <Button
                color="error"
                variant="outlined"
                startIcon={<FiTrash2 />}
                onClick={() => setDeleting(true)}
              >
                Delete product
              </Button>
            </Box>
          )}
        </Box>
      </fieldset>

      {variantPhotos !== null && form.variants[variantPhotos] && (
        <LinkImagesDialog
          open
          title={`Photos for ${label(form.variants[variantPhotos].options)}`}
          images={form.images}
          chosen={photosOf(form.variants[variantPhotos], form.imageLinks)}
          uploading={uploading > 0}
          onUpload={uploadFiles}
          onChange={(urls) => {
            const linked = variantImages(
              form.variants[variantPhotos].options,
              form.imageLinks
            );
            setVariant(variantPhotos, {
              ownImages: sameList(urls, linked) ? null : urls,
            });
          }}
          onClose={() => setVariantPhotos(null)}
        />
      )}
      <BrandDialog
        open={Boolean(brandDialog)}
        initialName={brandDialog?.name}
        onClose={() => setBrandDialog(null)}
        onSaved={(b) => {
          setBrands((list) =>
            [...list, b].sort((x, y) => x.name.localeCompare(y.name))
          );
          set({ brandId: b.id });
          setBrandDialog(null);
        }}
      />
      <ConfirmationDialog
        open={deleting}
        title={`Delete ${original?.title}?`}
        content="This can’t be undone."
        confirmText="Delete"
        loading={saving}
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </Box>
  );
};

export default ProductFormPage;
