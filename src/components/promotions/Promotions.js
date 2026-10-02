// src/components/promotions/Promotions.js — storefront offers from
// GET /rest/promotions: a slim rotating strip under the header and a compact
// banner on the home page. Each offer has a title, countdown and "View deal"
// link to the matching product list.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { catalog } from '../../api';

let cache = null; // one request per page load

export const usePromotions = () => {
  const [promos, setPromos] = useState(cache || []);
  useEffect(() => {
    if (cache) return undefined;
    let active = true;
    catalog
      .promotions()
      .then((list) => {
        cache = list;
        if (active) setPromos(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return promos;
};

/** Rotates through items every `ms` (paused while hovered). */
const useRotation = (count, ms = 6000) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms, paused]);
  return {
    index: count ? index % count : 0,
    setIndex,
    pause: {
      onMouseEnter: () => setPaused(true),
      onMouseLeave: () => setPaused(false),
    },
  };
};

const useTimeLeft = (endsAt) => {
  const calc = () => Math.max(0, new Date(endsAt).getTime() - Date.now());
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  return left;
};

export const Countdown = ({ endsAt, tone = 'promo.text', size = 'small' }) => {
  const left = useTimeLeft(endsAt);
  const days = Math.floor(left / 86400000);
  const parts = [
    Math.floor((left % 86400000) / 3600000),
    Math.floor((left % 3600000) / 60000),
    Math.floor((left % 60000) / 1000),
  ].map((n) => String(n).padStart(2, '0'));
  const boxes = days ? [String(days), ...parts] : parts;
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      role="timer"
      aria-label={`Ends in ${days ? `${days} days ` : ''}${parts[0]} hours ${parts[1]} minutes`}
    >
      {boxes.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Typography aria-hidden sx={{ color: tone }}>
              :
            </Typography>
          )}
          <Box
            aria-hidden
            sx={{
              bgcolor: alpha('#F27A1A', 0.12),
              color: tone,
              borderRadius: '6px',
              px: size === 'small' ? 0.75 : 1.25,
              py: size === 'small' ? 0.25 : 0.75,
              minWidth: size === 'small' ? 28 : 44,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              fontSize: size === 'small' ? '0.85rem' : '1.1rem',
              fontWeight: 600,
            }}
          >
            {p}
            {days && i === 0 ? 'd' : ''}
          </Box>
        </React.Fragment>
      ))}
    </Stack>
  );
};

Countdown.propTypes = {
  endsAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)])
    .isRequired,
  tone: PropTypes.string,
  size: PropTypes.oneOf(['small', 'large']),
};

/** Slim strip under the header. */
export const PromoStrip = ({ onClose }) => {
  const navigate = useNavigate();
  const promos = usePromotions();
  const { index, pause } = useRotation(promos.length);
  const promo = promos[index];
  if (!promo) return null;
  return (
    <Box
      sx={{ bgcolor: 'promo.main', borderTop: 1, borderColor: 'divider' }}
      aria-label="Current offers"
      {...pause}
    >
      <Container maxWidth="xl">
        <Stack
          key={promo.id}
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={{ xs: 1, md: 2.5 }}
          sx={{
            py: 0.75,
            pr: 5,
            position: 'relative',
            flexWrap: 'wrap',
            rowGap: 0.5,
            animation: 'promoIn .35s ease',
            '@keyframes promoIn': {
              from: { opacity: 0, transform: 'translateY(4px)' },
              to: { opacity: 1 },
            },
          }}
        >
          <Typography sx={{ color: 'promo.text', fontWeight: 700 }}>
            {promo.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'promo.text', display: { xs: 'none', md: 'block' } }}
          >
            {promo.subtitle}
          </Typography>
          <Countdown endsAt={promo.endsAt} />
          <Button
            size="small"
            variant="contained"
            color="warning"
            onClick={() => navigate(promo.link)}
            sx={{ color: '#fff', py: 0.25 }}
          >
            View deal
          </Button>
          <IconButton
            size="small"
            aria-label="Hide offers"
            onClick={onClose}
            sx={{ position: 'absolute', right: 0, color: 'promo.text' }}
          >
            <FiX />
          </IconButton>
        </Stack>
      </Container>
    </Box>
  );
};

PromoStrip.propTypes = { onClose: PropTypes.func.isRequired };

/** Compact sale banner for the home page, rotating between offers. */
export const PromoBanner = () => {
  const navigate = useNavigate();
  const promos = usePromotions();
  const { index, setIndex, pause } = useRotation(promos.length, 7000);
  const promo = promos[index];
  if (!promo) return null;
  const step = (d) => setIndex((i) => (i + d + promos.length) % promos.length);
  return (
    <Box
      component="section"
      aria-roledescription="carousel"
      aria-label="Offers"
      {...pause}
      sx={{
        bgcolor: 'promo.main',
        borderRadius: 1,
        px: { xs: 2, md: 4 },
        py: { xs: 2.5, md: 3 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'auto 1fr auto auto' },
        alignItems: 'center',
        gap: { xs: 1.5, md: 3 },
        position: 'relative',
        '@keyframes promoIn': {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1 },
        },
      }}
    >
      {promos.length > 1 && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          <IconButton
            size="small"
            aria-label="Previous offer"
            onClick={() => step(-1)}
          >
            <FiChevronLeft />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Next offer"
            onClick={() => step(1)}
          >
            <FiChevronRight />
          </IconButton>
        </Stack>
      )}
      <Box key={promo.id} sx={{ minWidth: 0, animation: 'promoIn .35s ease' }}>
        <Typography variant="h4" component="h2" sx={{ color: 'promo.text' }}>
          {promo.title}
        </Typography>
        <Typography sx={{ color: 'promo.text', opacity: 0.85 }}>
          {promo.subtitle}
          {promo.code && (
            <Box
              component="span"
              sx={{
                ml: 1,
                px: 1,
                py: 0.25,
                borderRadius: '6px',
                border: '1px dashed',
                fontWeight: 700,
              }}
            >
              {promo.code}
            </Box>
          )}
        </Typography>
      </Box>
      <Stack spacing={0.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Typography variant="caption" sx={{ color: 'promo.text' }}>
          {promo.daily ? 'Today only — ends in' : 'Ends in'}
        </Typography>
        <Countdown endsAt={promo.endsAt} size="large" />
      </Stack>
      <Button
        variant="contained"
        color="warning"
        size="large"
        onClick={() => navigate(promo.link)}
        sx={{ color: '#fff', justifySelf: { xs: 'stretch', md: 'end' } }}
      >
        View deal
      </Button>
      {promos.length > 1 && (
        <Stack
          direction="row"
          spacing={0.75}
          justifyContent="center"
          sx={{ gridColumn: '1 / -1' }}
        >
          {promos.map((p, i) => (
            <Box
              key={p.id}
              component="button"
              aria-label={`Show offer ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              sx={{
                width: i === index ? 20 : 8,
                height: 8,
                p: 0,
                border: 0,
                cursor: 'pointer',
                borderRadius: 999,
                bgcolor: i === index ? 'warning.main' : alpha('#7A3C0A', 0.25),
                transition: 'width .2s',
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};
