// src/components/product/BoughtTogether.js — "Frequently bought together",
// under the Add to cart row: small thumbnails joined by "+", a tick list of
// this item and up to three complementary products with their prices, the
// bundle total, and one button to add the ticked items to the cart.
// Complements with options use their first in-stock variant.
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Box, Button, Checkbox, Link, Stack, Typography } from '@mui/material';
import { FiPlus, FiShoppingCart } from 'react-icons/fi';
import { catalog } from '../../api';
import { addToCart } from '../../redux/cartSlice';
import { useNotify } from '../../notification/NotificationProvider';
import { formatMoney, optionText } from '../../utils/format';

/** A complement as it would go into the cart (default variant, its price). */
const asItem = (p) => {
  if (p.variants?.length) {
    const v =
      p.variants.find((x) => x.inStock && x.quantity > 0) || p.variants[0];
    return {
      key: p.id,
      product: p,
      variant: v,
      options: v.options,
      price: v.unitPrice,
      image: v.images?.[0] || p.images[0],
    };
  }
  return {
    key: p.id,
    product: p,
    variant: null,
    options: {},
    price: p.specialPrice ?? p.price,
    image: p.images[0],
  };
};

const BoughtTogether = ({ product, options, variant, price, needsChoice }) => {
  const dispatch = useDispatch();
  const notify = useNotify();
  const [others, setOthers] = useState(null);
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    catalog
      .boughtTogether(product.id)
      .then((list) => {
        if (!live) return;
        setOthers(list.map(asItem));
        setChecked(
          Object.fromEntries([['main', true], ...list.map((p) => [p.id, true])])
        );
      })
      .catch(() => live && setOthers([]));
    return () => {
      live = false;
    };
  }, [product.id]);

  const main = useMemo(
    () => ({
      key: 'main',
      product,
      variant,
      options,
      price,
      image: variant?.images?.[0] || product.images[0],
      isMain: true,
    }),
    [product, variant, options, price]
  );

  if (!others || !others.length) return null;
  const items = [main, ...others];
  const chosen = items.filter((i) => checked[i.key]);
  const total = chosen.reduce((s, i) => s + (i.price || 0), 0);

  const addBundle = async () => {
    if (checked.main && needsChoice) {
      const missing = product.attributes.find((a) => !options[a.name]);
      notify.error(
        `Please choose a ${missing?.name.toLowerCase() || 'option'} for ${product.title} first.`
      );
      return;
    }
    setBusy(true);
    try {
      for (const i of chosen) {
        // eslint-disable-next-line no-await-in-loop
        await dispatch(
          addToCart({
            product: i.product,
            quantity: 1,
            options: i.options,
            variant: i.variant,
          })
        ).unwrap();
      }
      notify.success(
        `${chosen.length} item${chosen.length === 1 ? '' : 's'} added to your cart.`
      );
    } catch (message) {
      notify.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      component="section"
      aria-labelledby="bought-together-title"
      data-testid="bought-together"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
    >
      <Typography
        id="bought-together-title"
        variant="subtitle1"
        sx={{ fontWeight: 700, mb: 1.5 }}
      >
        Frequently bought together
      </Typography>

      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1.5, overflowX: 'auto' }}
      >
        {items.map((i, n) => (
          <React.Fragment key={i.key}>
            {n > 0 && (
              <Box
                sx={{ color: 'text.disabled', display: 'flex', flexShrink: 0 }}
              >
                <FiPlus />
              </Box>
            )}
            <Box
              component={i.isMain ? 'div' : RouterLink}
              to={i.isMain ? undefined : `/products/${i.product.id}`}
              sx={{
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: '8px',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.neutral',
                overflow: 'hidden',
                opacity: checked[i.key] ? 1 : 0.35,
                transition: 'opacity .15s',
              }}
            >
              <Box
                component="img"
                src={i.image}
                alt={i.product.title}
                sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
          </React.Fragment>
        ))}
      </Stack>

      <Stack spacing={0.25}>
        {items.map((i) => (
          <Stack key={i.key} direction="row" alignItems="center" spacing={0.5}>
            <Checkbox
              size="small"
              checked={!!checked[i.key]}
              onChange={(e) =>
                setChecked((c) => ({ ...c, [i.key]: e.target.checked }))
              }
              inputProps={{
                'aria-label': `Include ${i.product.title}`,
              }}
              sx={{ ml: -1, p: 0.75 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {i.isMain ? (
                  <>
                    <strong>This item:</strong> {i.product.title}
                  </>
                ) : (
                  <Link
                    component={RouterLink}
                    to={`/products/${i.product.id}`}
                    underline="hover"
                    color="text.primary"
                  >
                    {i.product.title}
                  </Link>
                )}
              </Typography>
              {(optionText(i.options) || (i.isMain && needsChoice)) && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  component="div"
                >
                  {i.isMain && needsChoice
                    ? 'Choose your options above'
                    : optionText(i.options)}
                </Typography>
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {formatMoney(i.price || 0)}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1.25}
        sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}
      >
        <Typography variant="body2">
          Total for {chosen.length} item{chosen.length === 1 ? '' : 's'}:{' '}
          <Box component="strong" data-testid="bundle-total">
            {formatMoney(total)}
          </Box>
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FiShoppingCart />}
          onClick={addBundle}
          disabled={!chosen.length || busy}
        >
          {busy ? 'Adding…' : 'Add bundle to cart'}
        </Button>
      </Stack>
    </Box>
  );
};

BoughtTogether.propTypes = {
  product: PropTypes.object.isRequired,
  options: PropTypes.object.isRequired,
  variant: PropTypes.object,
  price: PropTypes.number,
  needsChoice: PropTypes.bool,
};

export default BoughtTogether;
