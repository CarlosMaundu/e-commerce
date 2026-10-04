// src/pages/admin/StoreSettingsPage.js — the shop's identity: name, logo,
// favicon, tagline, contact details, footer note and social links. Every page
// reads these from /rest/store, so nothing here is hardcoded.
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  FiFacebook,
  FiInstagram,
  FiMusic,
  FiSave,
  FiTwitter,
} from 'react-icons/fi';
import { store as storeApi } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { useStore } from '../../context/StoreContext';
import { SectionCard } from '../../components/ui';
import { PageHeader } from '../../components/admin/DataTable';
import ImageField from '../../components/admin/ImageField';
import { formatDateTime } from '../../utils/format';

const SOCIALS = [
  { key: 'facebook', label: 'Facebook', icon: <FiFacebook /> },
  { key: 'instagram', label: 'Instagram', icon: <FiInstagram /> },
  { key: 'x', label: 'X (Twitter)', icon: <FiTwitter /> },
  { key: 'tiktok', label: 'TikTok', icon: <FiMusic /> },
];

const fieldErrors = (error) => error?.fieldErrors || {};

const SettingsSkeleton = () => (
  <Grid
    container
    spacing={3}
    sx={{ mt: 0 }}
    data-testid="store-settings-loading"
  >
    {[0, 1].map((i) => (
      <Grid item xs={12} md={6} key={i}>
        <Skeleton variant="rounded" height={320} />
      </Grid>
    ))}
    <Grid item xs={12}>
      <Skeleton variant="rounded" height={200} />
    </Grid>
  </Grid>
);

const StoreSettingsPage = () => {
  const notify = useNotify();
  const shop = useStore();
  const [form, setForm] = useState(null);
  const [meta, setMeta] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    storeApi
      .adminGet()
      .then(({ settings, updatedAt, updatedBy }) => {
        setForm(settings);
        setMeta({ updatedAt, updatedBy });
      })
      .catch((error) =>
        notify.error(error, 'We couldn’t load the store settings.')
      );
  }, [notify]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const setSocial = (key) => (e) =>
    setForm((f) => ({ ...f, social: { ...f.social, [key]: e.target.value } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const saved = await storeApi.save(form);
      setForm(saved);
      setMeta({ updatedAt: new Date().toISOString(), updatedBy: 'you' });
      await shop.reload();
      notify.success('Store settings saved.');
    } catch (error) {
      setErrors(fieldErrors(error));
      notify.error(error, 'We couldn’t save the store settings.');
    } finally {
      setSaving(false);
    }
  };

  const err = (key) => ({
    error: Boolean(errors[key]),
    helperText: errors[key],
  });

  return (
    <Box component="form" onSubmit={save} noValidate>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: 'Store settings' }]}
        title="Store settings"
        subtitle={
          meta.updatedAt
            ? `Last changed ${formatDateTime(meta.updatedAt)}${
                meta.updatedBy ? ` by ${meta.updatedBy}` : ''
              }`
            : 'Your shop’s name, logo and contact details, shown across every page.'
        }
        actions={
          <Button
            type="submit"
            variant="contained"
            startIcon={<FiSave />}
            disabled={!form || saving || uploading}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />
      {!form ? (
        <SettingsSkeleton />
      ) : (
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={12} md={6}>
            <SectionCard
              title="Brand"
              subtitle="How your shop introduces itself."
            >
              <Stack spacing={2.5}>
                <TextField
                  label="Shop name"
                  required
                  value={form.name}
                  onChange={set('name')}
                  inputProps={{ maxLength: 80 }}
                  {...err('name')}
                />
                <TextField
                  label="Tagline"
                  value={form.tagline}
                  onChange={set('tagline')}
                  inputProps={{ maxLength: 160 }}
                  {...err('tagline')}
                  helperText={
                    errors.tagline || 'Shown in the footer and browser tab.'
                  }
                />
                <ImageField
                  label="Logo"
                  value={form.logo}
                  onChange={set('logo')}
                  onUploading={setUploading}
                  contain
                  hint="PNG or SVG with a transparent background, about 240 × 80 px. Leave empty to use the default logo."
                />
                {errors.logo && (
                  <Typography variant="caption" color="error">
                    {errors.logo}
                  </Typography>
                )}
                <ImageField
                  label="Favicon"
                  value={form.favicon}
                  onChange={set('favicon')}
                  onUploading={setUploading}
                  contain
                  hint="Square image, at least 64 × 64 px. Shown in the browser tab."
                />
                {errors.favicon && (
                  <Typography variant="caption" color="error">
                    {errors.favicon}
                  </Typography>
                )}
              </Stack>
            </SectionCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <SectionCard
              title="Contact"
              subtitle="Where customers can reach you."
            >
              <Stack spacing={2.5}>
                <TextField
                  label="Support email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  {...err('email')}
                />
                <TextField
                  label="Phone"
                  value={form.phone}
                  onChange={set('phone')}
                  inputProps={{ maxLength: 40 }}
                  {...err('phone')}
                />
                <TextField
                  label="Address"
                  value={form.address}
                  onChange={set('address')}
                  multiline
                  minRows={2}
                  inputProps={{ maxLength: 300 }}
                  {...err('address')}
                />
                <TextField
                  label="Announcement bar"
                  value={form.announcement}
                  onChange={set('announcement')}
                  inputProps={{ maxLength: 160 }}
                  {...err('announcement')}
                  helperText={
                    errors.announcement ||
                    'A short message at the top of every shop page. Leave empty to hide it.'
                  }
                />
                <TextField
                  label="Footer note"
                  value={form.footerText}
                  onChange={set('footerText')}
                  inputProps={{ maxLength: 200 }}
                  {...err('footer_text')}
                  helperText={
                    errors.footer_text || 'Shown after the copyright line.'
                  }
                />
              </Stack>
            </SectionCard>
          </Grid>
          <Grid item xs={12}>
            <SectionCard
              title="Social links"
              subtitle="Only links you fill in appear in the footer."
            >
              <Grid container spacing={2.5}>
                {SOCIALS.map((s) => (
                  <Grid item xs={12} sm={6} key={s.key}>
                    <TextField
                      label={s.label}
                      fullWidth
                      placeholder="https://"
                      value={form.social?.[s.key] || ''}
                      onChange={setSocial(s.key)}
                      {...err(`social.${s.key}`)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {s.icon}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </SectionCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default StoreSettingsPage;
