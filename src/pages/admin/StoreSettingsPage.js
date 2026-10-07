// src/pages/admin/StoreSettingsPage.js — the shop's identity: name, logo,
// favicon, tagline, contact details, footer note and social links. Every page
// reads these from /rest/store, so nothing here is hardcoded.
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  FiEdit2,
  FiInstagram,
  FiMusic,
  FiSave,
  FiTwitter,
} from 'react-icons/fi';
import { store as storeApi } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { useStore } from '../../context/StoreContext';
import { SectionCard } from '../../components/ui';
import { PageHeader, PanelTabs } from '../../components/admin/DataTable';
import SlaSettingsTab from './SlaSettingsTab';
import { useHideHelpWhile } from '../../layouts/AdminLayout';
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
  const [editing, setEditing] = useState(false);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(
    ['general', 'home', 'sla'].includes(params.get('tab'))
      ? params.get('tab')
      : 'general'
  );
  useHideHelpWhile(editing);
  const [saved, setSaved] = useState(null); // last saved copy, for Cancel

  useEffect(() => {
    storeApi
      .adminGet()
      .then(({ settings, updatedAt, updatedBy }) => {
        setForm(settings);
        setSaved(settings);
        setMeta({ updatedAt, updatedBy });
      })
      .catch((error) =>
        notify.error(error, 'We couldn’t load the store settings.')
      );
  }, [notify]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const setHero = (section, key) => (e) =>
    setForm((f) => ({
      ...f,
      hero: {
        ...f.hero,
        [section]: {
          ...f.hero?.[section],
          [key]: e?.target ? e.target.value : e,
        },
      },
    }));
  const heroField = (section, key, label, props = {}) => (
    <TextField
      label={label}
      fullWidth
      value={form.hero?.[section]?.[key] || ''}
      onChange={setHero(section, key)}
      {...err(`hero.${section}.${key === 'ctaLabel' ? 'cta_label' : key}`)}
      {...props}
    />
  );

  const setSocial = (key) => (e) =>
    setForm((f) => ({ ...f, social: { ...f.social, [key]: e.target.value } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const next = await storeApi.save(form);
      setForm(next);
      setSaved(next);
      setEditing(false);
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
          !editing &&
          tab !== 'sla' && (
            <Button
              variant="contained"
              startIcon={<FiEdit2 />}
              onClick={() => setEditing(true)}
              disabled={!form}
            >
              Edit settings
            </Button>
          )
        }
      />
      {!form ? (
        <SettingsSkeleton />
      ) : (
        <>
          <Box sx={{ mt: 3 }}>
            <PanelTabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'general', label: 'General' },
                { value: 'home', label: 'Home page' },
                { value: 'sla', label: 'Fulfilment SLA' },
              ]}
            />
          </Box>
          {tab === 'sla' && <SlaSettingsTab />}
          <Box
            component="fieldset"
            hidden={tab === 'sla'}
            disabled={!editing}
            sx={{
              border: 0,
              m: 0,
              p: 0,
              minWidth: 0,
              // Read-only until Edit: tinted, borderless fields, no image buttons.
              ...(!editing && {
                '& .MuiOutlinedInput-root': { bgcolor: 'background.neutral' },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'transparent',
                },
                '& .MuiInputBase-input.Mui-disabled, & .MuiInputBase-input:disabled':
                  {
                    color: 'text.primary',
                    WebkitTextFillColor: 'currentColor',
                  },
                '& .image-field-actions': { display: 'none' },
              }),
            }}
          >
            <Grid container spacing={3} sx={{ mt: 0 }}>
              {tab === 'general' ? (
                <>
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
                            errors.tagline ||
                            'Shown in the footer and browser tab.'
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
                            errors.footer_text ||
                            'Shown after the copyright line.'
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
                </>
              ) : (
                <Grid item xs={12}>
                  <SectionCard
                    title="Home page hero"
                    subtitle="The three cards at the top of the home page. Links can be shop paths (/products?on_sale=1) or full https:// links."
                  >
                    <Grid container spacing={3}>
                      <Grid item xs={12} lg={4}>
                        <Stack spacing={2}>
                          <Typography variant="subtitle1">
                            Offer card
                          </Typography>
                          {heroField('main', 'eyebrow', 'Label', {
                            helperText: 'e.g. Weekend drop · 20% off',
                          })}
                          {heroField('main', 'title', 'Headline')}
                          {heroField('main', 'text', 'Text', {
                            multiline: true,
                            minRows: 2,
                          })}
                          {heroField('main', 'ctaLabel', 'Button label')}
                          {heroField('main', 'link', 'Button link')}
                          <ImageField
                            label="Offer photo"
                            value={form.hero?.main?.image || ''}
                            onChange={setHero('main', 'image')}
                            onUploading={setUploading}
                            hint="Landscape, at least 1200 px wide. Leave empty for the default photo."
                          />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Stack spacing={2}>
                          <Typography variant="subtitle1">
                            Highlight card
                          </Typography>
                          {heroField('side', 'eyebrow', 'Label')}
                          {heroField('side', 'title', 'Headline')}
                          {heroField('side', 'link', 'Arrow link')}
                          <ImageField
                            label="Highlight photo"
                            value={form.hero?.side?.image || ''}
                            onChange={setHero('side', 'image')}
                            onUploading={setUploading}
                            hint="Square, at least 600 px. Leave empty for the default photo."
                          />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <Stack spacing={2}>
                          <Typography variant="subtitle1">
                            Member card
                          </Typography>
                          {heroField('member', 'eyebrow', 'Label')}
                          {heroField('member', 'title', 'Headline')}
                          {heroField('member', 'text', 'Text', {
                            multiline: true,
                            minRows: 2,
                          })}
                          {heroField('member', 'link', 'Arrow link')}
                        </Stack>
                      </Grid>
                    </Grid>
                  </SectionCard>
                </Grid>
              )}
            </Grid>
          </Box>
        </>
      )}
      {form && editing && tab !== 'sla' && (
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
            type="submit"
            variant="contained"
            size="large"
            startIcon={<FiSave />}
            disabled={saving || uploading}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default StoreSettingsPage;
