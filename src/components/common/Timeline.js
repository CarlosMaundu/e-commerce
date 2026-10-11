// src/components/common/Timeline.js — a vertical list of steps, newest
// first: a round icon marker per step joined by a line (solid from the
// latest step, dashed below), the title centred on its marker, then the
// text and the date. Used for order updates and return updates.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { formatDateTime } from '../../utils/format';

const MARKER = 40;

const Timeline = ({ items, testId }) => {
  const theme = useTheme();
  return (
    <Box
      component="ol"
      data-testid={testId}
      sx={{ listStyle: 'none', p: 0, m: 0 }}
    >
      {items.map((item, i) => {
        const latest = i === 0;
        const last = i === items.length - 1;
        const tone =
          theme.palette[item.tone]?.main || theme.palette.primary.main;
        return (
          <Box
            component="li"
            key={item.key ?? i}
            data-testid={item.testId}
            sx={{ display: 'flex', gap: 2 }}
          >
            {/* Marker and the line down to the next step. */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                width: MARKER,
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: MARKER,
                  height: MARKER,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                  ...(latest
                    ? {
                        color: tone,
                        bgcolor: alpha(tone, 0.08),
                        border: `2px solid ${tone}`,
                        boxShadow: `0 0 0 4px ${alpha(tone, 0.12)}`,
                      }
                    : {
                        color: 'text.secondary',
                        bgcolor: 'background.neutral',
                        border: 1,
                        borderColor: 'divider',
                      }),
                }}
              >
                {item.icon}
              </Box>
              {!last && (
                <Box
                  aria-hidden
                  sx={{
                    flex: 1,
                    minHeight: 16,
                    my: 0.5,
                    borderLeft: latest
                      ? `2px solid ${tone}`
                      : `2px dashed ${theme.palette.divider}`,
                  }}
                />
              )}
            </Box>

            {/* Title on the marker's centre line, then text and date. */}
            <Box sx={{ flex: 1, minWidth: 0, pb: last ? 0 : 2.5 }}>
              <Box
                sx={{
                  minHeight: MARKER,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Typography
                  variant="subtitle1"
                  component="p"
                  sx={{ fontWeight: 600, lineHeight: 1.3 }}
                >
                  {item.title}
                </Typography>
                {item.badge}
              </Box>
              {item.text && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-line' }}
                >
                  {item.text}
                </Typography>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mt: 0.5 }}
              >
                {[formatDateTime(item.date), ...(item.meta || [])]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

Timeline.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.any,
      title: PropTypes.node.isRequired,
      text: PropTypes.node,
      date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      meta: PropTypes.arrayOf(PropTypes.string),
      icon: PropTypes.node,
      tone: PropTypes.string,
      badge: PropTypes.node,
      testId: PropTypes.string,
    })
  ).isRequired,
  testId: PropTypes.string,
};

export default Timeline;
