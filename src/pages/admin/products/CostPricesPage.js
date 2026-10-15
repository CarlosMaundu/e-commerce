// src/pages/admin/products/CostPricesPage.js — Back office → Products → Cost
// prices: every product (or variant) with its selling price, what it costs
// and the margin. Type costs straight into the table and save, or fill the
// missing ones from a target margin. Costs can also be used for past orders
// that have none, so the reports show profit for them too.
import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { FiPercent, FiSave } from 'react-icons/fi';
import { adminCosts } from '../../../api';
import { useNotify } from '../../../notification/NotificationProvider';
import {
  EmptyRow,
  LoadingRows,
  PAGE_SIZE,
  PageHeader,
  PanelTabs,
  PanelToolbar,
  Pill,
  SearchField,
  StandardPagination,
  TablePanel,
} from '../../../components/admin/DataTable';
import { formatMoney, getCurrency } from '../../../utils/format';

const keyOf = (r) => `${r.product_id}:${r.variant_id ?? ''}`;
const marginOf = (price, cost) =>
  cost === '' || cost === null || cost === undefined || !price
    ? null
    : Math.round(((price - Number(cost)) / price) * 1000) / 10;

const CostPricesPage = () => {
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const tab = get('tab') || 'all';
  const page = Number(get('page') || 1) - 1;
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({}); // key → cost text
  const [past, setPast] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [margin, setMargin] = useState('40');
  const [filling, setFilling] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setData(null);
    adminCosts
      .list({
        search: get('search') || undefined,
        missing: tab === 'missing' || undefined,
        page: page + 1,
        limit: PAGE_SIZE,
      })
      .then((d) => active && setData(d))
      .catch((error) => {
        notify.error(error, 'We couldn’t load cost prices.');
        if (active) setData({ items: [], total: 0, counts: {} });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notify]);
  useEffect(load, [load]);

  const changed = Object.keys(edits).length;
  const save = async () => {
    setSaving(true);
    try {
      const items = Object.entries(edits).map(([key, cost]) => {
        const [productId, variantId] = key.split(':');
        return {
          product_id: Number(productId),
          variant_id: variantId ? Number(variantId) : null,
          cost_price: cost === '' ? null : cost,
        };
      });
      await adminCosts.save(items, past);
      notify.success(
        `${items.length} cost price${items.length === 1 ? '' : 's'} saved.`
      );
      setEdits({});
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t save the cost prices.');
    } finally {
      setSaving(false);
    }
  };
  const fill = async () => {
    setFilling(true);
    try {
      const { filled } = await adminCosts.fill(Number(margin), {
        applyToPastOrders: past,
      });
      notify.success(
        filled
          ? `Filled ${filled} missing cost price${filled === 1 ? '' : 's'}.`
          : 'Nothing was missing a cost price.'
      );
      setFillOpen(false);
      setEdits({});
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t fill the cost prices.');
    } finally {
      setFilling(false);
    }
  };

  const counts = data?.counts || {};
  const cols = 6;

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Products', to: '/admin/products' },
          { label: 'Cost prices', to: '/admin/products/costs' },
        ]}
        title="Cost prices"
        subtitle="What each item costs you, so reports can show profit and margins. Staff only; never shown in the shop."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FiPercent />}
              onClick={() => setFillOpen(true)}
              sx={{ bgcolor: 'background.paper' }}
            >
              Fill missing from a margin
            </Button>
            <Button
              variant="contained"
              startIcon={<FiSave />}
              onClick={save}
              disabled={!changed || saving}
            >
              {saving
                ? 'Saving…'
                : changed
                  ? `Save ${changed} change${changed === 1 ? '' : 's'}`
                  : 'Save changes'}
            </Button>
          </Stack>
        }
      />
      {counts.missing > 0 && (
        <Alert severity="warning" icon={false}>
          {counts.missing} of {counts.all} items have no cost price, so their
          sales don’t count towards profit in the reports.
        </Alert>
      )}
      <TablePanel>
        <PanelTabs
          value={tab}
          onChange={(v) => set('tab', v === 'all' ? '' : v)}
          tabs={[
            {
              value: 'all',
              label: 'All',
              count: data ? counts.all : undefined,
            },
            {
              value: 'missing',
              label: 'No cost yet',
              count: data ? counts.missing : undefined,
            },
          ]}
        />
        <PanelToolbar>
          <SearchField
            value={get('search')}
            onChange={(v) => set('search', v)}
            placeholder="Search product or SKU"
          />
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Checkbox
                checked={past}
                onChange={(e) => setPast(e.target.checked)}
              />
            }
            label="Also use for past orders with no cost"
          />
        </PanelToolbar>
        <TableContainer>
          <Table aria-label="Cost prices">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Selling price</TableCell>
                <TableCell>Cost price</TableCell>
                <TableCell align="right">Margin</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!data && <LoadingRows cols={cols} rows={PAGE_SIZE} />}
              {data?.items.map((r) => {
                const key = keyOf(r);
                const value =
                  edits[key] !== undefined ? edits[key] : (r.cost_price ?? '');
                const m = marginOf(r.price, value);
                const options = Object.values(r.options || {}).join(' / ');
                return (
                  <TableRow key={key} hover data-testid={`cost-row-${key}`}>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/admin/products/${r.product_id}`}
                        underline="hover"
                        sx={{ fontWeight: 600 }}
                      >
                        {r.name}
                      </Link>
                      {options && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="div"
                        >
                          {options}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {r.sku || '—'}
                    </TableCell>
                    <TableCell>{r.category || '—'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatMoney(r.price)}
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={value}
                        placeholder={
                          r.inherited ? 'Same as product' : 'Not set'
                        }
                        onChange={(e) =>
                          setEdits((x) => ({ ...x, [key]: e.target.value }))
                        }
                        inputProps={{
                          'aria-label': `Cost price for ${r.name}${options ? ` ${options}` : ''}`,
                          min: 0,
                          step: '0.01',
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {getCurrency()}
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          width: 160,
                          ...(edits[key] !== undefined && {
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                            },
                          }),
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {m === null ? (
                        '—'
                      ) : (
                        <Pill
                          label={`${m}%`}
                          tone={
                            m < 0 ? 'error' : m < 15 ? 'warning' : 'success'
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {data && !data.items.length && (
                <EmptyRow cols={cols}>
                  {tab === 'missing'
                    ? 'Every item has a cost price.'
                    : 'No items match.'}
                </EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data && data.total > 0 && (
          <StandardPagination
            count={data.total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            onPageChange={(_, p) => set('page', String(p + 1))}
            onRowsPerPageChange={() => {}}
            maxShowAll={0}
            label="items"
          />
        )}
      </TablePanel>

      <Dialog
        open={fillOpen}
        onClose={() => setFillOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Fill missing cost prices</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Items without a cost get one that leaves this margin on their
              selling price. Costs you’ve already entered don’t change.
            </Typography>
            <TextField
              label="Margin"
              type="number"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              helperText={
                Number(margin) >= 0 && Number(margin) <= 95
                  ? `e.g. ${formatMoney(100)} selling price → ${formatMoney(100 - Number(margin))} cost`
                  : 'Use 0 to 95.'
              }
              error={!(Number(margin) >= 0 && Number(margin) <= 95)}
              fullWidth
              autoFocus
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={past}
                  onChange={(e) => setPast(e.target.checked)}
                />
              }
              label="Also use for past orders with no cost"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFillOpen(false)} disabled={filling}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={fill}
            disabled={filling || !(Number(margin) >= 0 && Number(margin) <= 95)}
          >
            {filling ? 'Filling…' : 'Fill missing costs'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default CostPricesPage;
