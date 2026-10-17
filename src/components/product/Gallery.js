// src/components/product/Gallery.js — product photos. Desktop: thumbnails
// beside one large photo. Phones: full-width photos you swipe through, with
// dots and a count; tapping one opens them full screen (pinch to zoom,
// swipe, Back or ✕ to close).
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Dialog,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FiX } from 'react-icons/fi';
import useBackToClose from '../../hooks/useBackToClose';

const hideScrollbar = {
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
};

/** Which slide of a scroll-snap row is showing. */
const useSlide = (ref, count) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onScroll = () =>
      setIndex(
        Math.min(count - 1, Math.round(el.scrollLeft / (el.clientWidth || 1)))
      );
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref, count]);
  return [index, setIndex];
};

const slideTo = (el, i, smooth = true) => {
  // (Newer browsers return a promise here; nothing should wait for it.)
  el?.scrollTo({
    left: i * el.clientWidth,
    behavior: smooth ? 'smooth' : 'instant',
  });
};

const Dots = ({ count, index, onPick, light }) =>
  count > 1 && (
    <Stack direction="row" spacing={0.75} justifyContent="center">
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          component="button"
          type="button"
          aria-label={`Photo ${i + 1}`}
          aria-current={i === index}
          onClick={() => onPick(i)}
          sx={{
            p: 0,
            border: 0,
            width: i === index ? 18 : 6,
            height: 6,
            borderRadius: 3,
            cursor: 'pointer',
            transition: 'width 150ms ease',
            bgcolor: light
              ? i === index
                ? 'common.white'
                : 'rgba(255,255,255,0.4)'
              : i === index
                ? 'primary.main'
                : 'divider',
          }}
        />
      ))}
    </Stack>
  );

const Viewer = ({ images, title, start, onClose }) => {
  const rowRef = useRef(null);
  const [index, setIndex] = useSlide(rowRef, images.length);
  const closeThen = useBackToClose(true, onClose);
  useEffect(() => {
    setIndex(start);
    // Open on the photo that was tapped.
    requestAnimationFrame(() => slideTo(rowRef.current, start, false));
  }, [start, setIndex]);

  return (
    <Dialog
      open
      fullScreen
      onClose={() => closeThen()}
      PaperProps={{ sx: { bgcolor: '#000' }, 'aria-label': `${title} photos` }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          px: 1,
          pt: 'calc(env(safe-area-inset-top) + 8px)',
          color: 'common.white',
        }}
      >
        <Typography sx={{ pl: 1.5, fontWeight: 600 }}>
          {index + 1} / {images.length}
        </Typography>
        <IconButton
          aria-label="Close photos"
          onClick={() => closeThen()}
          sx={{ color: 'common.white' }}
        >
          <FiX />
        </IconButton>
      </Stack>
      <Box
        ref={rowRef}
        sx={{
          display: 'flex',
          height: '100%',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          ...hideScrollbar,
        }}
      >
        {images.map((src) => (
          <Box
            key={src}
            sx={{
              flex: '0 0 100%',
              scrollSnapAlign: 'center',
              display: 'grid',
              placeItems: 'center',
              touchAction: 'pan-x pinch-zoom',
            }}
          >
            <Box
              component="img"
              src={src}
              alt=""
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          left: 0,
          right: 0,
        }}
      >
        <Dots
          count={images.length}
          index={index}
          light
          onPick={(i) => slideTo(rowRef.current, i)}
        />
      </Box>
    </Dialog>
  );
};

const PhoneGallery = ({ images, title }) => {
  const rowRef = useRef(null);
  const [index] = useSlide(rowRef, images.length);
  const [viewing, setViewing] = useState(null);
  useEffect(() => {
    slideTo(rowRef.current, 0, false);
  }, [images]);

  return (
    <Box data-testid="phone-gallery" sx={{ mx: { xs: -2, sm: -3 } }}>
      <Box sx={{ position: 'relative' }}>
        <Box
          ref={rowRef}
          role="group"
          aria-label={`${title} photos`}
          sx={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            overscrollBehaviorX: 'contain',
            ...hideScrollbar,
          }}
        >
          {images.map((src, i) => (
            <Box
              key={src}
              component="button"
              type="button"
              aria-label={`Open photo ${i + 1} of ${images.length}`}
              onClick={() => setViewing(i)}
              sx={{
                flex: '0 0 100%',
                p: 0,
                border: 0,
                bgcolor: 'background.neutral',
                aspectRatio: '1 / 1',
                scrollSnapAlign: 'center',
                cursor: 'zoom-in',
              }}
            >
              <Box
                component="img"
                src={src}
                alt={i === 0 ? title : ''}
                loading={i === 0 ? 'eager' : 'lazy'}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </Box>
          ))}
        </Box>
        {/* One indicator: dots over the bottom of the photo. */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            px: 1,
            py: 0.75,
            borderRadius: 99,
            bgcolor: images.length > 1 ? 'rgba(27,33,36,0.28)' : 'transparent',
            lineHeight: 0,
          }}
        >
          <Dots
            count={images.length}
            index={index}
            light
            onPick={(i) => slideTo(rowRef.current, i)}
          />
        </Box>
      </Box>
      {viewing !== null && (
        <Viewer
          images={images}
          title={title}
          start={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </Box>
  );
};

const DesktopGallery = ({ images, title }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [images]);
  const current = images[index] || images[0];
  return (
    <Stack direction={{ xs: 'column-reverse', md: 'row' }} spacing={1.5}>
      {images.length > 0 && (
        <Stack
          direction={{ xs: 'row', md: 'column' }}
          spacing={1}
          sx={{ overflow: 'auto', maxHeight: { md: 'min(480px, 58vh)' } }}
        >
          {images.map((src, i) => (
            <Box
              key={src}
              component="button"
              type="button"
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              sx={{
                p: 0,
                width: 72,
                height: 72,
                flexShrink: 0,
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: 2,
                borderColor: i === index ? 'primary.main' : 'transparent',
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
          ))}
        </Stack>
      )}
      <Box
        sx={{
          flex: 1,
          aspectRatio: '1 / 1',
          maxHeight: { md: 'min(480px, 58vh)' },
          maxWidth: { md: 'min(480px, 58vh)' },
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {current && (
          <Box
            component="img"
            src={current}
            alt={title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
      </Box>
    </Stack>
  );
};

const Gallery = (props) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  return phone && props.images.length ? (
    <PhoneGallery {...props} />
  ) : (
    <DesktopGallery {...props} />
  );
};

const galleryProps = {
  images: PropTypes.array.isRequired,
  title: PropTypes.string,
};
Gallery.propTypes = galleryProps;
PhoneGallery.propTypes = galleryProps;
DesktopGallery.propTypes = galleryProps;
Viewer.propTypes = {
  ...galleryProps,
  start: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
};
Dots.propTypes = {
  count: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  onPick: PropTypes.func.isRequired,
  light: PropTypes.bool,
};

export default Gallery;
