// src/pages/admin/SlaSettingsTab.js — Store settings → Fulfilment SLA: the
// stages an order moves through, how long each may take, the overall target
// per delivery option, and when an order counts as "at risk". Opens
// read-only; Edit, then Cancel or Save at the bottom.
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  FormControlLabel,
  Grid,
  InputAdornment,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { FiArrowRight, FiEdit2, FiSave } from 'react-icons/fi';
import { adminReports } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { SectionCard } from '../../components/ui';
import { useHideHelpWhile } from '../../layouts/AdminLayout';
import { formatDateTime } from '../../utils/format';

const STATUS_NAMES = {
  placed: 'Order placed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
};
const DELIVERY = [
  ['standard', 'Standard delivery'],
  ['express', 'Express delivery'],
  ['pickup', 'Pick up'],
];

const Unit = ({ children }) => (
  <InputAdornment position="end">{children}</InputAdornment>
);
Unit.propTypes = { children: PropTypes.node };

const SlaSettingsTab = () => {
  const notify = useNotify();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [meta, setMeta] = useState({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  useHideHelpWhile(editing);

  useEffect(() => {
    adminReports
      .slaSettings()
      .then((d) => {
        setForm(d.settings);
        setSaved(d.settings);
        setMeta({ at: d.updated_at, by: d.updated_by });
      })
      .catch((e) => notify.error(e, 'We couldn’t load the SLA settings.'));
  }, [notify]);

  const setStage = (i, patch) =>
    setForm((f) => ({
      ...f,
      stages: f.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }));
  const err = (key) =>
    errors[key] ? { error: true, helperText: errors[key] } : {};

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const next = await adminReports.saveSlaSettings(form);
      setForm(next);
      setSaved(next);
      setEditing(false);
      setMeta({ at: new Date().toISOString(), by: 'you' });
      notify.success('SLA settings saved.');
    } catch (e) {
      setErrors(e?.fieldErrors || {});
      notify.error(e, 'We couldn’t save the SLA settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Skeleton variant="rounded" height={360} sx={{ mt: 3 }} />;

  return (
    <Box sx={{ mt: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          How long orders may spend in each stage. The Orders list and the SLA
          report measure every order against these.
          {meta.at &&
            ` Last changed ${formatDateTime(meta.at)}${meta.by ? ` by ${meta.by}` : ''}.`}
        </Typography>
        {!editing && (
          <Button
            variant="contained"
            startIcon={<FiEdit2 />}
            onClick={() => setEditing(true)}
            sx={{ flexShrink: 0 }}
          >
            Edit SLA
          </Button>
        )}
      </Stack>

      <Box
        component="fieldset"
        disabled={!editing}
        sx={{
          border: 0,
          m: 0,
          p: 0,
          minWidth: 0,
          ...(!editing && {
            '& .MuiOutlinedInput-root': { bgcolor: 'background.neutral' },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'transparent',
            },
            '& .MuiInputBase-input:disabled': {
              color: 'text.primary',
              WebkitTextFillColor: 'currentColor',
            },
          }),
        }}
      >
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <SectionCard
              title="Stages"
              subtitle="Each stage runs from reaching one status until the next. Untracked stages are shown but never count as breached."
            >
              <Stack spacing={2}>
                {form.stages.map((st, i) => (
                  <Box
                    key={st.key}
                    data-testid={`sla-stage-${st.key}`}
                    sx={{
                      display: 'grid',
                      gap: 2,
                      alignItems: 'center',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'minmax(0, 1.2fr) minmax(0, 1.3fr) 180px auto',
                      },
                      p: 2,
                      borderRadius: '8px',
                      bgcolor: 'background.neutral',
                    }}
                  >
                    <TextField
                      label="Stage name"
                      value={st.name}
                      onChange={(e) => setStage(i, { name: e.target.value })}
                      {...err(`stages.${i}.name`)}
                      fullWidth
                      sx={{ bgcolor: 'background.paper', borderRadius: '8px' }}
                    />
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ color: 'text.secondary' }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {STATUS_NAMES[st.from]}
                      </Typography>
                      <FiArrowRight />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {STATUS_NAMES[st.to]}
                      </Typography>
                    </Stack>
                    <TextField
                      label="Target"
                      type="number"
                      value={st.target_hours}
                      onChange={(e) =>
                        setStage(i, { target_hours: e.target.value })
                      }
                      {...err(`stages.${i}.target_hours`)}
                      InputProps={{ endAdornment: <Unit>hours</Unit> }}
                      inputProps={{ min: 1, step: 1 }}
                      sx={{ bgcolor: 'background.paper', borderRadius: '8px' }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={st.tracked}
                          onChange={(e) =>
                            setStage(i, { tracked: e.target.checked })
                          }
                          disabled={!editing}
                        />
                      }
                      label={st.tracked ? 'Tracked' : 'Not tracked'}
                    />
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Grid>
          <Grid item xs={12} md={7}>
            <SectionCard
              title="Placement to delivery"
              subtitle="The overall target for each delivery option."
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {DELIVERY.map(([code, label]) => (
                  <TextField
                    key={code}
                    label={label}
                    type="number"
                    value={form.total_days[code]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        total_days: { ...f.total_days, [code]: e.target.value },
                      }))
                    }
                    {...err(`total_days.${code}`)}
                    InputProps={{ endAdornment: <Unit>days</Unit> }}
                    inputProps={{ min: 1, step: 0.5 }}
                    fullWidth
                  />
                ))}
              </Stack>
            </SectionCard>
          </Grid>
          <Grid item xs={12} md={5}>
            <SectionCard title="Tracking">
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.enabled}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, enabled: e.target.checked }))
                      }
                      disabled={!editing}
                    />
                  }
                  label={
                    form.enabled ? 'SLA tracking is on' : 'SLA tracking is off'
                  }
                />
                <TextField
                  label="Flag as at risk after"
                  type="number"
                  value={form.at_risk_percent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, at_risk_percent: e.target.value }))
                  }
                  {...err('at_risk_percent')}
                  helperText={
                    errors.at_risk_percent ||
                    'Share of the target used up before an open order or stage is flagged.'
                  }
                  InputProps={{ endAdornment: <Unit>% of target</Unit> }}
                  inputProps={{ min: 50, max: 95 }}
                  sx={{ maxWidth: 280 }}
                />
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      </Box>

      {editing && (
        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1.5}
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: 3,
            py: 2,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: 2,
          }}
        >
          <Button
            variant="outlined"
            size="large"
            disabled={saving}
            onClick={() => {
              setForm(saved);
              setErrors({});
              setEditing(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="contained"
            size="large"
            startIcon={<FiSave />}
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save SLA'}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default SlaSettingsTab;
