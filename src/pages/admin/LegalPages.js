// src/pages/admin/LegalPages.js — Back office → Site pages: About us, Terms and
// Conditions, Privacy Policy and the Refund & Return Policy. The list shows
// who changed each page and when; a page opens read-only, then Edit gives the
// formatted-text editor (headings, paragraphs, bold, italics, lists, links,
// quotes, dividers) with settings placeholders, a live preview, and Save /
// Cancel at the bottom. Reset brings back the built-in wording.
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Skeleton,
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
import {
  FiEdit2,
  FiExternalLink,
  FiEye,
  FiRotateCcw,
  FiSave,
} from 'react-icons/fi';
import { legal } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import {
  EmptyRow,
  LoadingRows,
  PageHeader,
  PanelTabs,
  Pill,
  RowActions,
  TablePanel,
} from '../../components/admin/DataTable';
import RichTextEditor from '../../components/admin/RichTextEditor';
import LegalContent from '../../components/common/LegalContent';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { useHideHelpWhile } from '../../layouts/AdminLayout';
import { policyPath } from '../../content/policies';
import { formatDateTime } from '../../utils/format';

/** Where each page lives on the shop. */
const shopPath = (slug) => (slug === 'about' ? '/about' : policyPath(slug));

const fill = (html, tokens) =>
  (html || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key) => {
    const t = tokens.find((x) => x.token === key);
    if (!t) return m;
    return String(t.value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  });

// ---------- list ----------

export const LegalPagesPage = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const [pages, setPages] = useState(null);

  useEffect(() => {
    legal
      .list()
      .then(setPages)
      .catch((e) => {
        notify.error(e, 'We couldn’t load the legal pages.');
        setPages([]);
      });
  }, [notify]);

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Site pages', to: '/admin/legal' },
        ]}
        title="Site pages"
        subtitle="About us, terms and conditions, privacy policy and refund policy, as shown on the shop. Have legal changes reviewed by an advocate."
      />
      <TablePanel>
        <TableContainer>
          <Table aria-label="Site pages">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Page</TableCell>
                <TableCell>Wording</TableCell>
                <TableCell>Last changed</TableCell>
                <TableCell>By</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!pages ? (
                <LoadingRows cols={5} rows={3} />
              ) : pages.length ? (
                pages.map((p) => (
                  <TableRow
                    key={p.slug}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      if (!e.target.closest('a, button, [role="menu"]'))
                        navigate(`/admin/legal/${p.slug}`);
                    }}
                    data-testid={`legal-row-${p.slug}`}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>{p.title}</TableCell>
                    <TableCell>
                      <Pill
                        label={p.customised ? 'Edited' : 'Built-in'}
                        tone={p.customised ? 'info' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(p.updated_at)}
                    </TableCell>
                    <TableCell>{p.updated_by || '—'}</TableCell>
                    <TableCell align="right">
                      <RowActions
                        label={`Actions for ${p.title}`}
                        items={[
                          {
                            label: 'Edit',
                            icon: <FiEdit2 />,
                            onClick: () =>
                              navigate(`/admin/legal/${p.slug}?edit=1`),
                          },
                          {
                            label: 'View on shop',
                            icon: <FiEye />,
                            onClick: () =>
                              window.open(shopPath(p.slug), '_blank'),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow cols={5}>No pages.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TablePanel>
    </Stack>
  );
};

// ---------- one page ----------

export const LegalPageEditor = () => {
  const { slug } = useParams();
  const notify = useNotify();
  const [page, setPage] = useState(null);
  const [form, setForm] = useState({ title: '', body: '' });
  const [editing, setEditing] = useState(
    () => new URLSearchParams(window.location.search).get('edit') === '1'
  );
  const [view, setView] = useState('write');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmReset, setConfirmReset] = useState(false);
  useHideHelpWhile(editing);

  const load = () =>
    legal
      .adminGet(slug)
      .then((p) => {
        setPage(p);
        setForm({ title: p.title, body: p.body });
      })
      .catch((e) => notify.error(e, 'We couldn’t load this page.'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const preview = useMemo(
    () => (page ? fill(form.body, page.tokens || []) : ''),
    [form.body, page]
  );

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const next = await legal.save(slug, form);
      setPage((p) => ({ ...p, ...next }));
      setForm({ title: next.title, body: next.body });
      setEditing(false);
      setView('write');
      notify.success(
        `${next.title} saved. The shop shows the new wording now.`
      );
    } catch (e) {
      setErrors(e?.fieldErrors || {});
      notify.error(e, 'We couldn’t save this page.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await legal.reset(slug);
      await load();
      setConfirmReset(false);
      setEditing(false);
      notify.success('The built-in wording is back.');
    } catch (e) {
      notify.error(e, 'We couldn’t reset this page.');
    } finally {
      setSaving(false);
    }
  };

  if (!page) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width={300} height={56} />
        <Skeleton variant="rounded" height={480} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'Site pages', to: '/admin/legal' },
          { label: page.title, to: `/admin/legal/${slug}` },
        ]}
        title={page.title}
        subtitle={`${page.customised ? 'Edited' : 'Built-in wording'} · last changed ${formatDateTime(page.updated_at)}${
          page.updated_by ? ` by ${page.updated_by}` : ''
        }`}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FiExternalLink />}
              component={RouterLink}
              to={shopPath(slug)}
              target="_blank"
              sx={{ bgcolor: 'background.paper' }}
            >
              View on shop
            </Button>
            {!editing && (
              <Button
                variant="contained"
                startIcon={<FiEdit2 />}
                onClick={() => setEditing(true)}
              >
                Edit page
              </Button>
            )}
          </Stack>
        }
      />

      {!editing ? (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: { xs: 2.5, md: 5 },
          }}
        >
          <LegalContent html={page.preview} />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Alert severity="info" icon={false}>
            Use the text style menu for headings, and{' '}
            <strong>Insert setting</strong> for details that come from your
            settings (shop name, contact details, return window…). They update
            on the shop automatically when the settings change.
          </Alert>
          <TextField
            label="Page title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            error={!!errors.title}
            helperText={errors.title}
            inputProps={{ maxLength: 120 }}
            sx={{ maxWidth: 560, bgcolor: 'background.paper' }}
          />
          <Box>
            <PanelTabs
              value={view}
              onChange={setView}
              tabs={[
                { value: 'write', label: 'Write' },
                { value: 'preview', label: 'Preview' },
              ]}
            />
          </Box>
          {errors.body && <Alert severity="error">{errors.body}</Alert>}
          <Box sx={{ display: view === 'write' ? 'block' : 'none' }}>
            <RichTextEditor
              document
              value={form.body}
              onChange={(body) => setForm((f) => ({ ...f, body }))}
              tokens={page.tokens || []}
              label={`${page.title} content`}
              placeholder="Write the page…"
            />
          </Box>
          {view === 'preview' && (
            <Box
              data-testid="legal-preview"
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: { xs: 2.5, md: 5 },
              }}
            >
              <Typography variant="h3" component="p" sx={{ mb: 3 }}>
                {form.title}
              </Typography>
              <LegalContent html={preview} />
            </Box>
          )}
          <Stack
            direction="row"
            justifyContent="space-between"
            spacing={1.5}
            sx={{
              position: 'sticky',
              bottom: 0,
              py: 2,
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
              zIndex: 2,
            }}
          >
            <Button
              color="error"
              startIcon={<FiRotateCcw />}
              onClick={() => setConfirmReset(true)}
              disabled={saving || !page.customised}
            >
              Reset to built-in wording
            </Button>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                size="large"
                disabled={saving}
                onClick={() => {
                  setForm({ title: page.title, body: page.body });
                  setErrors({});
                  setEditing(false);
                  setView('write');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<FiSave />}
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save page'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      )}

      <ConfirmationDialog
        open={confirmReset}
        title="Reset to the built-in wording?"
        content="Your edits to this page will be replaced by the built-in wording. This can’t be undone."
        confirmText="Reset page"
        loading={saving}
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </Stack>
  );
};
