// src/components/layout/HeroSection.js — home-page hero: a large offer card
// with a tilted photo, a yellow highlight card and a dark member card. All
// wording, links and photos come from Back office → Store settings; the
// bundled photos are only defaults. `compact` shows just the offer card
// (product list page).
import React from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FiArrowRight } from 'react-icons/fi';
import { useStore } from '../../context/StoreContext';
import defaultMainImage from '../../images/hero-flatlay.jpg';
import defaultSideImage from '../../images/hero-headphones.jpg';

/** Shop links route in-app; full https:// links open as normal links. */
const linkProps = (to) =>
  /^https:\/\//i.test(to || '')
    ? { component: 'a', href: to }
    : { component: RouterLink, to: to || '/products' };

const eyebrowSx = {
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontWeight: 800,
  fontSize: '0.75rem',
};

const ArrowLink = ({ to, label, bg, color, hover }) => (
  <IconButton
    {...linkProps(to)}
    aria-label={label}
    sx={{
      width: 56,
      height: 56,
      borderRadius: '8px',
      bgcolor: bg,
      color,
      '&:hover': { bgcolor: hover },
    }}
  >
    <FiArrowRight />
  </IconButton>
);
ArrowLink.propTypes = {
  to: PropTypes.string,
  label: PropTypes.string.isRequired,
  bg: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  hover: PropTypes.string.isRequired,
};

const MainCard = ({ hero, compact }) => {
  const theme = useTheme();
  return (
    <Box
      component="section"
      aria-label={hero.title || 'Featured offer'}
      data-testid="hero-main"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        minHeight: compact ? { xs: 240, md: 280 } : { xs: 420, md: 0 },
        height: compact ? 'auto' : { md: '100%' },
        p: compact ? { xs: 3, md: 5 } : { xs: 3.5, md: 6, lg: 7.5 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        isolation: 'isolate',
      }}
    >
      {/* Decoration: a soft ring top right and a warm disc at the bottom. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: compact ? 300 : 460,
          height: compact ? 300 : 460,
          top: compact ? -170 : -230,
          right: compact ? -40 : -60,
          borderRadius: '50%',
          border: `${compact ? 50 : 80}px solid ${alpha('#fff', 0.06)}`,
          zIndex: -1,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: compact ? 260 : 400,
          height: compact ? 260 : 400,
          left: { xs: '55%', md: '38%' },
          bottom: compact ? -190 : -230,
          borderRadius: '50%',
          bgcolor: 'warning.main',
          zIndex: -1,
        }}
      />
      <Box
        aria-hidden
        component="img"
        src={hero.image || defaultMainImage}
        alt=""
        sx={{
          display: { xs: 'none', md: 'block' },
          position: 'absolute',
          right: { md: -60, lg: 16 },
          bottom: compact ? -40 : -56,
          width: compact ? '34%' : { md: '46%', lg: '40%' },
          height: compact ? '92%' : '88%',
          objectFit: 'cover',
          transform: 'rotate(4deg)',
          borderRadius: 1,
          border: `8px solid ${alpha('#fff', 0.22)}`,
          boxShadow: `0 30px 60px ${alpha(theme.palette.text.primary, 0.25)}`,
          zIndex: -1,
        }}
      />

      <Box sx={{ maxWidth: { md: compact ? '60%' : '58%' } }}>
        {hero.eyebrow && (
          <Box
            sx={{
              ...eyebrowSx,
              display: 'inline-block',
              px: 2,
              py: 1,
              mb: compact ? 2 : 3.5,
              borderRadius: '8px',
              bgcolor: alpha('#fff', 0.16),
            }}
          >
            {hero.eyebrow}
          </Box>
        )}
        <Typography
          component={compact ? 'h2' : 'h1'}
          sx={{
            fontWeight: 800,
            letterSpacing: '-0.05em',
            lineHeight: 0.98,
            fontSize: compact
              ? { xs: '2rem', md: '2.75rem' }
              : {
                  xs: '2.75rem',
                  sm: '3.5rem',
                  md: '3.5rem',
                  lg: '4.5rem',
                  xl: '5.5rem',
                },
          }}
        >
          {hero.title}
        </Typography>
        {hero.text && (
          <Typography
            sx={{
              mt: compact ? 1.5 : 3,
              maxWidth: 480,
              fontSize: { xs: '1rem', md: '1.125rem' },
              color: alpha('#fff', 0.86),
            }}
          >
            {hero.text}
          </Typography>
        )}
        {hero.ctaLabel && (
          <Button
            {...linkProps(hero.link)}
            endIcon={<FiArrowRight />}
            sx={{
              mt: compact ? 2.5 : 4.5,
              height: 56,
              px: 4,
              gap: 2,
              bgcolor: 'common.white',
              color: 'text.primary',
              fontWeight: 700,
              '&:hover': { bgcolor: alpha('#fff', 0.9) },
            }}
          >
            {hero.ctaLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
};
MainCard.propTypes = {
  hero: PropTypes.object.isRequired,
  compact: PropTypes.bool,
};

const SideCard = ({ hero }) => {
  const theme = useTheme();
  return (
    <Box
      component="section"
      aria-label={hero.title || 'Highlight'}
      data-testid="hero-side"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: 'highlight.main',
        color: 'text.primary',
        p: { xs: 3, md: 4 },
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        isolation: 'isolate',
      }}
    >
      <Box
        aria-hidden
        component="img"
        src={hero.image || defaultSideImage}
        alt=""
        sx={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '50%',
          height: '72%',
          objectFit: 'cover',
          clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)',
          borderTopLeftRadius: 12,
          zIndex: -1,
        }}
      />
      <Box sx={{ maxWidth: '62%' }}>
        {hero.eyebrow && (
          <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>{hero.eyebrow}</Typography>
        )}
        <Typography
          component="h2"
          sx={{
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
            fontSize: { xs: '1.75rem', lg: '2.1rem' },
          }}
        >
          {hero.title}
        </Typography>
      </Box>
      <Box sx={{ mt: 3 }}>
        <ArrowLink
          to={hero.link}
          label={hero.title || 'Shop now'}
          bg={theme.palette.text.primary}
          color="#fff"
          hover={alpha(theme.palette.text.primary, 0.85)}
        />
      </Box>
    </Box>
  );
};
SideCard.propTypes = { hero: PropTypes.object.isRequired };

const MemberCard = ({ hero }) => {
  const theme = useTheme();
  return (
    <Box
      component="section"
      aria-label={hero.title || 'Members'}
      data-testid="hero-member"
      sx={{
        borderRadius: 1,
        bgcolor: 'ink.main',
        color: 'common.white',
        p: { xs: 3, md: 4 },
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Box>
        {hero.eyebrow && (
          <Typography sx={{ ...eyebrowSx, mb: 1.5, color: alpha('#fff', 0.7) }}>
            {hero.eyebrow}
          </Typography>
        )}
        <Typography
          component="h2"
          sx={{
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
            fontSize: { xs: '1.75rem', lg: '2.1rem' },
            maxWidth: 300,
          }}
        >
          {hero.title}
        </Typography>
      </Box>
      <Box
        sx={{
          mt: 3,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Typography sx={{ color: alpha('#fff', 0.72), maxWidth: 260 }}>
          {hero.text}
        </Typography>
        <ArrowLink
          to={hero.link}
          label={hero.title || 'Learn more'}
          bg={theme.palette.warning.main}
          color="#fff"
          hover={alpha(theme.palette.warning.main, 0.85)}
        />
      </Box>
    </Box>
  );
};
MemberCard.propTypes = { hero: PropTypes.object.isRequired };

const HeroSection = ({ compact = false }) => {
  const { hero } = useStore();
  if (compact) return <MainCard hero={hero.main} compact />;
  return (
    <Box
      sx={{
        mt: { xs: 2, md: 4 },
        display: 'grid',
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(0, 1fr) 340px',
          lg: 'minmax(0, 1fr) 450px',
        },
        gridTemplateRows: { md: '1fr 1fr' },
        height: { md: 540, lg: 560 },
      }}
    >
      <Box sx={{ gridRow: { md: 'span 2' } }}>
        <MainCard hero={hero.main} />
      </Box>
      <SideCard hero={hero.side} />
      <MemberCard hero={hero.member} />
    </Box>
  );
};

HeroSection.propTypes = { compact: PropTypes.bool };

export default HeroSection;
