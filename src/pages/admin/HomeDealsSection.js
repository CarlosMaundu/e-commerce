// src/pages/admin/HomeDealsSection.js — Store settings → Home page → Deals:
// the offers in the animated strip under the header and the photo banner on
// the home page. Add, edit, reorder, switch off or delete; changes save at
// once (no Edit mode needed).
import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
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
  FiArrowDown,
  FiArrowUp,
  FiEdit2,
  FiImage,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { adminDeals, adminPromos } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard } from '../../components/ui';
import {
  EmptyRow,
  LoadingRows,
  Pill,
  RowActions,
} from '../../components/admin/DataTable';
import ImageField from '../../components/admin/ImageField';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { formatDateTime } from '../../utils/format';

const PLACEMENTS = {
  strip: 'Top strip',
  banner: 'Home banner',
  both: 'Strip and banner',
};

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const stateOf = (d) => {
  if (!d.active) return ['Off', 'default'];
  if (d.live) return ['Live', 'success'];
  if (d.ends_at && new Date(d.ends_at) < new Date())
    return ['Ended', 'default'];
  return ['Scheduled', 'info'];
};

const runsText = (d) => {
  const from = d.starts_at ? `From ${formatDateTime(d.starts_at)}` : '';
  if (d.daily)
    return [from, 'Daily, resets at midnight'].filter(Boolean).join(' · ');
  return [from, `Until ${formatDateTime(d.ends_at)}`]
    .filter(Boolean)
    .join(' · ');
};

const EMPTY = {
  title: '',
  subtitle: '',
  link: '/products?on_sale=1',
  code: '',
  image: '',
  placement: 'both',
  starts_at: '',
  ends_at: '',
  daily: true,
  active: true,
};

const DealDialog = ({ deal, codes, onClose, onSaved }) => {
  const notify = useNotify();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editing = Boolean(deal?.promotion_id);
  useEffect(() => {
    if (!deal) return;
    setErrors({});
    setForm({
      ...EMPTY,
      ...deal,
      code: deal.code || '',
      daily: editing ? !deal.ends_at : true,
      starts_at: toLocalInput(deal.starts_at),
      ends_at: toLocalInput(deal.ends_at),
    });
  }, [deal, editing]);
  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e?.target
        ? e.target.type === 'checkbox'
          ? e.target.checked
          : e.target.value
        : e,
    }));
  const err = (key) =>
    errors[key] ? { error: true, helperText: errors[key] } : {};

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : '',
      ends_at:
        !form.daily && form.ends_at ? new Date(form.ends_at).toISOString() : '',
    };
    if (!form.daily && !form.ends_at) {
      setErrors({ ends_at: 'Choose when the deal ends, or make it daily.' });
      setSaving(false);
      return;
    }
    try {
      const saved = editing
        ? await adminDeals.update(deal.promotion_id, body)
        : await adminDeals.create(body);
      notify.success(editing ? 'Deal saved.' : 'Deal added.');
      onSaved(saved);
    } catch (error) {
      setErrors(error?.fieldErrors || {});
      notify.error(error, 'We couldn’t save the deal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(deal)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? 'Edit deal' : 'Add a deal'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ pt: 1 }}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2}>
              <TextField
                label="Title"
                value={form.title}
                onChange={set('title')}
                {...err('title')}
                helperText={errors.title || 'e.g. Weekend sale: 20% off knits'}
                inputProps={{ maxLength: 120 }}
                required
                fullWidth
              />
              <TextField
                label="Text"
                value={form.subtitle}
                onChange={set('subtitle')}
                {...err('subtitle')}
                inputProps={{ maxLength: 200 }}
                fullWidth
              />
              <TextField
                label="“View deal” link"
                value={form.link}
                onChange={set('link')}
                {...err('link')}
                helperText={
                  errors.link ||
                  'A shop path like /products?on_sale=1, or https://…'
                }
                required
                fullWidth
              />
              <TextField
                select
                label="Promo code (optional)"
                value={form.code}
                onChange={set('code')}
                {...err('code')}
                helperText={
                  errors.code || 'Shown on the deal for customers to copy.'
                }
                fullWidth
              >
                <MenuItem value="">No code</MenuItem>
                {codes.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code}
                    {c.description ? ` · ${c.description}` : ''}
                  </MenuItem>
                ))}
              </TextField>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Where it shows
                </Typography>
                <RadioGroup
                  row
                  value={form.placement}
                  onChange={set('placement')}
                  aria-label="Where it shows"
                >
                  {Object.entries(PLACEMENTS).map(([v, l]) => (
                    <FormControlLabel
                      key={v}
                      value={v}
                      control={<Radio />}
                      label={l}
                    />
                  ))}
                </RadioGroup>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <ImageField
                label="Banner photo"
                value={form.image}
                onChange={set('image')}
                onUploading={setUploading}
                hint="Landscape, at least 1600 px wide. Used as the home banner’s background."
                stacked
              />
              <TextField
                label="Starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={set('starts_at')}
                {...err('starts_at')}
                helperText={errors.starts_at || 'Leave empty to start now.'}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch checked={form.daily} onChange={set('daily')} />
                }
                label="Daily deal: the countdown resets at midnight"
              />
              {!form.daily && (
                <TextField
                  label="Ends"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={set('ends_at')}
                  {...err('ends_at')}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              )}
              <FormControlLabel
                control={
                  <Switch checked={form.active} onChange={set('active')} />
                }
                label={form.active ? 'On' : 'Off: hidden from the shop'}
              />
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || uploading}
        >
          {saving ? 'Saving…' : editing ? 'Save deal' : 'Add deal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
DealDialog.propTypes = {
  deal: PropTypes.object,
  codes: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

const HomeDealsSection = () => {
  const notify = useNotify();
  const [deals, setDeals] = useState(null);
  const [codes, setCodes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(
    () =>
      adminDeals
        .list()
        .then(setDeals)
        .catch((error) => {
          notify.error(error, 'We couldn’t load the deals.');
          setDeals([]);
        }),
    [notify]
  );
  useEffect(() => {
    load();
    adminPromos
      .list({ status: 'all', limit: 100 })
      .then((d) => setCodes(d.promos))
      .catch(() => {});
  }, [load]);

  const move = async (index, dir) => {
    const ids = deals.map((d) => d.promotion_id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    try {
      setDeals(await adminDeals.reorder(ids));
    } catch (error) {
      notify.error(error, 'We couldn’t move the deal.');
    }
  };
  const toggle = async (d) => {
    try {
      await adminDeals.update(d.promotion_id, {
        ...d,
        code: d.code || '',
        active: !d.active,
      });
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t update the deal.');
    }
  };
  const remove = async () => {
    try {
      await adminDeals.remove(deleting.promotion_id);
      notify.success('Deal deleted.');
      setDeleting(null);
      load();
    } catch (error) {
      notify.error(error, 'We couldn’t delete the deal.');
    }
  };

  return (
    <SectionCard
      title="Deals"
      subtitle="Offers in the animated strip under the header and the photo banner on the home page. Changes are saved straight away."
      action={
        <Button
          variant="contained"
          size="small"
          startIcon={<FiPlus />}
          onClick={() => setEditing({ ...EMPTY })}
        >
          Add deal
        </Button>
      }
    >
      <TableContainer
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <Table aria-label="Deals" size="small">
          <TableHead sx={{ bgcolor: 'background.neutral' }}>
            <TableRow>
              <TableCell>Deal</TableCell>
              <TableCell>Shows in</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Runs</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Order</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {!deals && <LoadingRows cols={7} rows={3} />}
            {deals?.map((d, i) => {
              const [label, tone] = stateOf(d);
              return (
                <TableRow
                  key={d.promotion_id}
                  hover
                  data-testid={`deal-row-${d.promotion_id}`}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 56,
                          height: 36,
                          borderRadius: '6px',
                          flexShrink: 0,
                          bgcolor: 'background.neutral',
                          backgroundImage: d.image ? `url(${d.image})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'text.disabled',
                        }}
                      >
                        {!d.image && <FiImage aria-hidden />}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {d.title}
                        </Typography>
                        {d.subtitle && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            component="div"
                            sx={{ maxWidth: 280 }}
                          >
                            {d.subtitle}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Pill label={PLACEMENTS[d.placement]} tone="primary" />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>
                    {d.code || '—'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{runsText(d)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Pill label={label} tone={tone} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Move “${d.title}” up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <FiArrowUp />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Move “${d.title}” down`}
                          disabled={i === deals.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <FiArrowDown />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <RowActions
                      label={`Actions for ${d.title}`}
                      items={[
                        {
                          label: 'Edit',
                          icon: <FiEdit2 />,
                          onClick: () => setEditing(d),
                        },
                        {
                          label: d.active ? 'Switch off' : 'Switch on',
                          onClick: () => toggle(d),
                        },
                        {
                          label: 'Delete',
                          icon: <FiTrash2 />,
                          color: 'error',
                          onClick: () => setDeleting(d),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {deals && !deals.length && (
              <EmptyRow cols={7}>
                No deals yet. Add one to fill the strip and the home banner.
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <DealDialog
        deal={editing}
        codes={codes}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
      <ConfirmationDialog
        open={Boolean(deleting)}
        title="Delete this deal?"
        content={
          deleting ? `“${deleting.title}” will be removed from the shop.` : ''
        }
        confirmText="Delete deal"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </SectionCard>
  );
};

export default HomeDealsSection;
