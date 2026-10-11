// src/components/skeletons/index.js — loading placeholders that copy the
// real layout piece for piece (same frames, paddings, grids and heights), so
// nothing jumps when the data arrives. Build a page's skeleton from these,
// next to the page, using the same containers the page uses. See README.md.
import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Container,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

// Widths cycle so rows look like text of different lengths.
const WIDTHS = ['72%', '48%', '60%', '36%', '54%', '40%'];
const widthAt = (i) => WIDTHS[i % WIDTHS.length];

/** A block of placeholder text lines. */
export const LinesSkeleton = ({
  lines = 3,
  variant = 'body2',
  last = '45%',
}) => (
  <Box>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === lines - 1 ? last : '100%'}
        sx={{ fontSize: variant === 'body2' ? '0.875rem' : '1rem' }}
      />
    ))}
  </Box>
);
LinesSkeleton.propTypes = {
  lines: PropTypes.number,
  variant: PropTypes.string,
  last: PropTypes.string,
};

/** PageHeader: breadcrumbs, title, subtitle and action buttons. */
export const HeaderSkeleton = ({
  crumbs = true,
  subtitle = true,
  actions = 0,
}) => (
  <Box aria-hidden>
    {crumbs && (
      <Skeleton variant="text" width={180} sx={{ fontSize: '0.8rem' }} />
    )}
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ mt: crumbs ? { xs: 0.5, md: 1 } : 0 }}
    >
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width={260} sx={{ fontSize: '2rem' }} />
        {subtitle && (
          <Skeleton variant="text" width={360} sx={{ maxWidth: '80%' }} />
        )}
      </Box>
      {Array.from({ length: actions }, (_, i) => (
        <Skeleton key={i} variant="rounded" width={140} height={40} />
      ))}
    </Stack>
  </Box>
);
HeaderSkeleton.propTypes = {
  crumbs: PropTypes.bool,
  subtitle: PropTypes.bool,
  actions: PropTypes.number,
};

/** SectionCard: the same frame and title row, with any content inside. */
export const CardSkeleton = ({
  title = true,
  subtitle = false,
  action = false,
  tinted = false,
  children,
  lines = 3,
  sx,
}) => (
  <Box
    aria-hidden
    sx={{
      bgcolor: tinted ? 'background.neutral' : 'background.paper',
      border: tinted ? 'none' : 1,
      borderColor: 'divider',
      borderRadius: 1,
      p: { xs: 2.5, md: 3 },
      ...sx,
    }}
  >
    {(title || action) && (
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box sx={{ flex: 1 }}>
          {title && (
            <Skeleton variant="text" width={160} sx={{ fontSize: '1.4rem' }} />
          )}
          {subtitle && <Skeleton variant="text" width="60%" />}
        </Box>
        {action && <Skeleton variant="rounded" width={96} height={32} />}
      </Stack>
    )}
    {children ?? <LinesSkeleton lines={lines} />}
  </Box>
);
CardSkeleton.propTypes = {
  title: PropTypes.bool,
  subtitle: PropTypes.bool,
  action: PropTypes.bool,
  tinted: PropTypes.bool,
  children: PropTypes.node,
  lines: PropTypes.number,
  sx: PropTypes.object,
};

/** Label/value rows, like a details card. */
export const FieldRowsSkeleton = ({ rows = 4 }) => (
  <Stack spacing={1.5}>
    {Array.from({ length: rows }, (_, i) => (
      <Stack key={i} direction="row" justifyContent="space-between" spacing={2}>
        <Skeleton variant="text" width={110} />
        <Skeleton
          variant="text"
          width={widthAt(i + 2)}
          sx={{ maxWidth: 160 }}
        />
      </Stack>
    ))}
  </Stack>
);
FieldRowsSkeleton.propTypes = { rows: PropTypes.number };

/** Rows of a thumbnail, two lines of text and an amount (items, returns…). */
export const ItemRowsSkeleton = ({ rows = 3, image = 56, amount = true }) => (
  <Stack spacing={2}>
    {Array.from({ length: rows }, (_, i) => (
      <Stack key={i} direction="row" spacing={2} alignItems="center">
        {image > 0 && (
          <Skeleton
            variant="rounded"
            width={image}
            height={image}
            sx={{ flexShrink: 0 }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="text" width={widthAt(i)} />
          <Skeleton variant="text" width="30%" sx={{ fontSize: '0.75rem' }} />
        </Box>
        {amount && <Skeleton variant="text" width={72} />}
      </Stack>
    ))}
  </Stack>
);
ItemRowsSkeleton.propTypes = {
  rows: PropTypes.number,
  image: PropTypes.number,
  amount: PropTypes.bool,
};

/** A timeline: round markers joined by a line, a title, text and date. */
export const TimelineSkeleton = ({ rows = 4 }) => (
  <Box aria-hidden>
    {Array.from({ length: rows }, (_, i) => (
      <Box key={i} sx={{ display: 'flex', gap: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 40,
            flexShrink: 0,
          }}
        >
          <Skeleton variant="circular" width={40} height={40} />
          {i < rows - 1 && (
            <Box
              sx={{
                flex: 1,
                minHeight: 16,
                my: 0.5,
                borderLeft: 2,
                borderColor: 'divider',
                borderLeftStyle: 'dashed',
              }}
            />
          )}
        </Box>
        <Box sx={{ flex: 1, pb: i < rows - 1 ? 2.5 : 0 }}>
          <Box sx={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="text" width={140} sx={{ fontSize: '1rem' }} />
          </Box>
          <Skeleton variant="text" width={widthAt(i)} />
          <Skeleton variant="text" width={90} sx={{ fontSize: '0.75rem' }} />
        </Box>
      </Box>
    ))}
  </Box>
);
TimelineSkeleton.propTypes = { rows: PropTypes.number };

/** Stat cards in a grid: icon tile, label, big number and a note. */
export const StatCardsSkeleton = ({
  count = 4,
  columns = { xs: 2, lg: 4 },
}) => (
  <Box
    aria-hidden
    sx={{
      display: 'grid',
      gap: 2,
      gridTemplateColumns: Object.fromEntries(
        Object.entries(columns).map(([bp, n]) => [
          bp,
          `repeat(${n}, minmax(0, 1fr))`,
        ])
      ),
    }}
  >
    {Array.from({ length: count }, (_, i) => (
      <Box
        key={i}
        sx={{
          p: 2.5,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="rounded" width={40} height={40} />
          <Skeleton variant="text" width={110} />
        </Stack>
        <Skeleton
          variant="text"
          width={90}
          sx={{ fontSize: '1.6rem', mt: 1.5 }}
        />
        <Skeleton variant="text" width="70%" sx={{ fontSize: '0.75rem' }} />
      </Box>
    ))}
  </Box>
);
StatCardsSkeleton.propTypes = {
  count: PropTypes.number,
  columns: PropTypes.object,
};

/** Table cells for loading rows: one placeholder per column. */
export const SkeletonCells = ({ cols, index = 0 }) =>
  Array.from({ length: cols }, (_, c) => (
    <TableCell key={c} align={c === cols - 1 && cols > 2 ? 'right' : 'left'}>
      {c === cols - 1 && cols > 2 ? (
        <Skeleton
          variant="circular"
          width={24}
          height={24}
          sx={{ display: 'inline-block' }}
        />
      ) : (
        <Skeleton
          variant="text"
          width={c === 0 ? widthAt(index) : widthAt(index + c + 1)}
          sx={{ maxWidth: c === 0 ? 220 : 140 }}
        />
      )}
    </TableCell>
  ));

/**
 * A TablePanel while it loads: tab strip, toolbar, the real column headings
 * (or placeholders) and rows with one placeholder per column.
 */
export const TableSkeleton = ({
  columns = 5,
  rows = 8,
  tabs = 0,
  toolbar = true,
}) => {
  const heads = Array.isArray(columns)
    ? columns
    : Array.from({ length: columns }, () => null);
  return (
    <Box
      aria-hidden
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      {tabs > 0 && (
        <Stack
          direction="row"
          spacing={3}
          sx={{
            px: 2,
            height: 48,
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: tabs }, (_, i) => (
            <Skeleton key={i} variant="text" width={72} />
          ))}
        </Stack>
      )}
      {toolbar && (
        <Stack direction="row" spacing={1.5} sx={{ p: 2 }}>
          <Skeleton
            variant="rounded"
            height={40}
            sx={{ flex: 1, maxWidth: 360 }}
          />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="rounded" height={40} width={140} />
        </Stack>
      )}
      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: 'background.neutral' }}>
            <TableRow>
              {heads.map((h, i) => (
                <TableCell key={i}>
                  {h ?? <Skeleton variant="text" width={64} />}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r}>
                <SkeletonCells cols={heads.length} index={r} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
TableSkeleton.propTypes = {
  columns: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
  rows: PropTypes.number,
  tabs: PropTypes.number,
  toolbar: PropTypes.bool,
};

/** Back-office detail page: header, then a wide and a narrow column of cards. */
export const DetailSkeleton = ({
  main,
  side,
  actions = 1,
  testId = 'page-loading',
}) => (
  <Stack spacing={3} data-testid={testId} aria-busy="true">
    <HeaderSkeleton actions={actions} />
    <Grid container spacing={3}>
      <Grid item xs={12} lg={8}>
        <Stack spacing={3}>{main}</Stack>
      </Grid>
      <Grid item xs={12} lg={4}>
        <Stack spacing={3}>{side}</Stack>
      </Grid>
    </Grid>
  </Stack>
);
DetailSkeleton.propTypes = {
  main: PropTypes.node.isRequired,
  side: PropTypes.node.isRequired,
  actions: PropTypes.number,
  testId: PropTypes.string,
};

/** Labelled fields in a grid, like a settings form. */
export const FormSkeleton = ({ fields = 6, columns = 2 }) => (
  <Grid container spacing={2.5}>
    {Array.from({ length: fields }, (_, i) => (
      <Grid item xs={12} sm={12 / columns} key={i}>
        <Skeleton variant="rounded" height={56} />
      </Grid>
    ))}
  </Grid>
);
FormSkeleton.propTypes = {
  fields: PropTypes.number,
  columns: PropTypes.number,
};

/** ProductCard: badge row, square photo, title, chips, price. */
export const ProductCardSkeleton = ({ compact = false }) => (
  <Box
    aria-hidden
    sx={{
      p: { xs: 1, sm: compact ? 1.5 : 2 },
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}
  >
    <Box sx={{ minHeight: 22, mb: 1 }} />
    <Skeleton
      variant="rounded"
      sx={{
        width: '100%',
        height: 'auto',
        aspectRatio: '1 / 1',
        borderRadius: '8px',
      }}
    />
    <Stack spacing={0.75} alignItems="center" sx={{ pt: 1.5 }}>
      <Skeleton variant="text" width="80%" />
      <Stack direction="row" spacing={0.5}>
        <Skeleton
          variant="rounded"
          width={56}
          height={24}
          sx={{ borderRadius: 4 }}
        />
        <Skeleton
          variant="rounded"
          width={48}
          height={24}
          sx={{ borderRadius: 4 }}
        />
      </Stack>
      <Skeleton
        variant="text"
        width={90}
        sx={{ fontSize: compact ? '1.1rem' : '1.4rem' }}
      />
    </Stack>
  </Box>
);
ProductCardSkeleton.propTypes = { compact: PropTypes.bool };

/** A product grid with the same columns as the real one. */
export const ProductGridSkeleton = ({
  count = 8,
  columns = { xs: 2, sm: 3, lg: 4 },
  compact = false,
}) => (
  <Box
    data-testid="products-loading"
    aria-busy="true"
    sx={{
      display: 'grid',
      gap: { xs: 1, sm: 2 },
      gridTemplateColumns: Object.fromEntries(
        Object.entries(columns).map(([bp, n]) => [
          bp,
          `repeat(${n}, minmax(0, 1fr))`,
        ])
      ),
    }}
  >
    {Array.from({ length: count }, (_, i) => (
      <ProductCardSkeleton key={i} compact={compact} />
    ))}
  </Box>
);
ProductGridSkeleton.propTypes = {
  count: PropTypes.number,
  columns: PropTypes.object,
  compact: PropTypes.bool,
};

/** Storefront page frame: the same Container and title spacing. */
export const ShopPageSkeleton = ({ children, title = true }) => (
  <Container
    maxWidth="xl"
    sx={{ py: { xs: 3, md: 5 } }}
    data-testid="page-loading"
    aria-busy="true"
  >
    {title && (
      <Skeleton variant="text" width={240} sx={{ fontSize: '2.2rem', mb: 3 }} />
    )}
    {children}
  </Container>
);
ShopPageSkeleton.propTypes = {
  children: PropTypes.node,
  title: PropTypes.bool,
};

/** A conversation: messages from each side in turn, then the reply box. */
export const ThreadSkeleton = ({ messages = 3, reply = true }) => (
  <Stack spacing={2} aria-hidden>
    {Array.from({ length: messages }, (_, i) => (
      <Box
        key={i}
        sx={{
          alignSelf: i % 2 ? 'flex-end' : 'flex-start',
          width: { xs: '90%', sm: '75%' },
        }}
      >
        <Skeleton variant="text" width={160} sx={{ fontSize: '0.75rem' }} />
        <Skeleton variant="rounded" height={i === 0 ? 96 : 64} />
      </Box>
    ))}
    {reply && <Skeleton variant="rounded" height={120} sx={{ mt: 1 }} />}
  </Stack>
);
ThreadSkeleton.propTypes = {
  messages: PropTypes.number,
  reply: PropTypes.bool,
};

/** An invoice: letterhead, the two parties, the lines and the totals. */
export const InvoiceSkeleton = ({ testId = 'invoice-loading' }) => (
  <Box
    data-testid={testId}
    aria-busy="true"
    sx={{
      border: 1,
      borderColor: 'divider',
      borderRadius: 1,
      bgcolor: 'background.paper',
      p: { xs: 2.5, md: 5 },
    }}
  >
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 4 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Skeleton variant="rounded" width={44} height={44} />
        <Skeleton variant="text" width={140} sx={{ fontSize: '1.3rem' }} />
      </Stack>
      <Box sx={{ textAlign: 'right' }}>
        <Skeleton
          variant="text"
          width={120}
          sx={{ fontSize: '1.6rem', ml: 'auto' }}
        />
        <Skeleton variant="text" width={180} sx={{ ml: 'auto' }} />
      </Box>
    </Stack>
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {[0, 1, 2].map((i) => (
        <Grid item xs={12} sm={4} key={i}>
          <Skeleton variant="text" width={80} sx={{ fontSize: '0.75rem' }} />
          <LinesSkeleton lines={3} last="60%" />
        </Grid>
      ))}
    </Grid>
    <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
    {[0, 1, 2].map((i) => (
      <Stack key={i} direction="row" spacing={2} sx={{ py: 1.25 }}>
        <Skeleton variant="text" sx={{ flex: 1 }} width={widthAt(i)} />
        <Skeleton variant="text" width={40} />
        <Skeleton variant="text" width={80} />
        <Skeleton variant="text" width={80} />
      </Stack>
    ))}
    <Box sx={{ ml: 'auto', width: { xs: '100%', sm: 280 }, mt: 2 }}>
      <FieldRowsSkeleton rows={4} />
    </Box>
  </Box>
);
InvoiceSkeleton.propTypes = { testId: PropTypes.string };
