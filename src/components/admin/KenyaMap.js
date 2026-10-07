// src/components/admin/KenyaMap.js — a simplified outline of Kenya with a dot
// per town that orders ship to (bigger dot, bigger share). Towns we don't
// have coordinates for are still listed beside the map, just not plotted.
import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

// [lon, lat] around the border, simplified.
const OUTLINE = [
  [34.0, -1.0],
  [33.95, 0.1],
  [34.1, 1.0],
  [34.6, 1.9],
  [34.9, 3.0],
  [34.4, 4.2],
  [35.3, 5.0],
  [35.9, 4.6],
  [36.9, 4.4],
  [38.1, 3.6],
  [39.5, 3.5],
  [40.0, 4.2],
  [41.0, 3.9],
  [41.9, 3.95],
  [41.0, 2.8],
  [41.0, -0.85],
  [41.56, -1.68],
  [40.9, -2.1],
  [40.2, -2.8],
  [39.7, -3.7],
  [39.2, -4.68],
  [37.7, -3.1],
  [37.6, -2.9],
];

export const TOWNS = {
  nairobi: [36.82, -1.29],
  mombasa: [39.67, -4.04],
  kisumu: [34.77, -0.09],
  nakuru: [36.08, -0.3],
  eldoret: [35.27, 0.51],
  thika: [37.07, -1.03],
  machakos: [37.26, -1.52],
  nyeri: [36.95, -0.42],
  meru: [37.65, 0.05],
  kakamega: [34.75, 0.28],
  malindi: [40.12, -3.22],
  kitale: [35.0, 1.02],
  garissa: [39.65, -0.45],
  kericho: [35.28, -0.37],
  naivasha: [36.43, -0.72],
  kisii: [34.77, -0.68],
  embu: [37.45, -0.53],
  nanyuki: [37.07, 0.02],
  lamu: [40.9, -2.27],
  lodwar: [35.6, 3.12],
  kiambu: [36.83, -1.17],
  ruiru: [36.96, -1.15],
  kitengela: [36.96, -1.47],
  'diani beach': [39.57, -4.28],
};

const W = 260;
const H = 314;
const project = ([lon, lat]) => [
  ((lon - 33.8) / (42.0 - 33.8)) * W,
  ((5.1 - lat) / (5.1 + 4.8)) * H,
];

const KenyaMap = ({ places }) => {
  const theme = useTheme();
  const main = theme.palette.primary.main;
  const outline = OUTLINE.map(project);
  const hub = project(TOWNS.nairobi);
  const dots = places
    .map((p) => ({ ...p, at: TOWNS[p.city.toLowerCase()] }))
    .filter((p) => p.at)
    .map((p) => ({ ...p, xy: project(p.at) }));
  const max = Math.max(1, ...dots.map((d) => d.orders));

  return (
    <Box
      component="svg"
      viewBox={`-10 -10 ${W + 80} ${H + 20}`}
      role="img"
      aria-label={`Map of orders by town: ${dots
        .map((d) => `${d.city} ${d.orders}`)
        .join(', ')}`}
      sx={{ width: '100%', maxWidth: 420, height: 'auto', display: 'block' }}
    >
      <polygon
        points={outline.map((p) => p.join(',')).join(' ')}
        fill={alpha(main, 0.1)}
        stroke={alpha(main, 0.35)}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Light mesh from the capital to the border, for texture. */}
      {outline
        .filter((_, i) => i % 3 === 0)
        .map(([x, y], i) => (
          <line
            key={i}
            x1={hub[0]}
            y1={hub[1]}
            x2={x}
            y2={y}
            stroke={alpha(main, 0.14)}
            strokeWidth="1"
          />
        ))}
      {dots.map((d) => {
        const r = 4 + (d.orders / max) * 8;
        return (
          <g key={d.city}>
            <circle
              cx={d.xy[0]}
              cy={d.xy[1]}
              r={r + 3}
              fill="#fff"
              opacity="0.9"
            />
            <circle cx={d.xy[0]} cy={d.xy[1]} r={r} fill={main} />
            <text
              x={d.xy[0] + r + 5}
              y={d.xy[1] + 4}
              fontSize="14"
              fontWeight="600"
              fill={theme.palette.text.primary}
              fontFamily={theme.typography.fontFamily}
            >
              {d.city}
            </text>
          </g>
        );
      })}
    </Box>
  );
};

KenyaMap.propTypes = {
  places: PropTypes.arrayOf(
    PropTypes.shape({ city: PropTypes.string, orders: PropTypes.number })
  ).isRequired,
};

export default KenyaMap;
