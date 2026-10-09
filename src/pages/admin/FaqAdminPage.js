// src/pages/admin/FaqAdminPage.js — Back office → FAQ: the questions shown on
// the shop's FAQ page, by topic and in order. Add or edit a question with a
// formatted answer (bold, italics, lists, links, settings placeholders), hide
// it without deleting, move it up or down within its topic, or delete it.
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
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
  FiEye,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { faq as faqApi, legal } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import {
  EmptyRow,
  LoadingRows,
  PageHeader,
  Pill,
  RowActions,
  TablePanel,
} from '../../components/admin/DataTable';
import RichTextEditor from '../../components/admin/RichTextEditor';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

const QuestionDialog = ({ item, topics, tokens, onClose, onSaved }) => {
  const notify = useNotify();
  const [form, setForm] = useState({
    category: '',
    question: '',
    answer: '',
    published: true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        category: item.category || '',
        question: item.question || '',
        answer: item.answer || '',
        published: item.published ?? true,
      });
      setErrors({});
    }
  }, [item]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const saved = item.faq_id
        ? await faqApi.update(item.faq_id, form)
        : await faqApi.create(form);
      notify.success(item.faq_id ? 'Question saved.' : 'Question added.');
      onSaved(saved);
    } catch (e) {
      setErrors(e?.fieldErrors || {});
      notify.error(e, 'We couldn’t save the question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(item)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {item?.faq_id ? 'Edit question' : 'Add a question'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Autocomplete
            freeSolo
            options={topics}
            value={form.category}
            onInputChange={(_, v) => setForm((f) => ({ ...f, category: v }))}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Topic"
                helperText={
                  errors.category || 'Choose a topic or type a new one.'
                }
                error={!!errors.category}
              />
            )}
          />
          <TextField
            label="Question"
            value={form.question}
            onChange={(e) =>
              setForm((f) => ({ ...f, question: e.target.value }))
            }
            error={!!errors.question}
            helperText={errors.question}
            inputProps={{ maxLength: 300 }}
            fullWidth
          />
          <div>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Answer
            </Typography>
            <RichTextEditor
              value={form.answer}
              onChange={(answer) => setForm((f) => ({ ...f, answer }))}
              tokens={tokens}
              label="Answer"
              placeholder="Write the answer…"
            />
            {errors.answer && (
              <Typography variant="caption" color="error">
                {errors.answer}
              </Typography>
            )}
          </div>
          <FormControlLabel
            control={
              <Switch
                checked={form.published}
                onChange={(e) =>
                  setForm((f) => ({ ...f, published: e.target.checked }))
                }
              />
            }
            label={form.published ? 'Shown on the FAQ page' : 'Hidden'}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save question'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
QuestionDialog.propTypes = {
  item: PropTypes.object,
  topics: PropTypes.array.isRequired,
  tokens: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

const FaqAdminPage = () => {
  const notify = useNotify();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [tokens, setTokens] = useState([]);

  const load = () =>
    faqApi
      .adminList()
      .then(setItems)
      .catch((e) => {
        notify.error(e, 'We couldn’t load the FAQ.');
        setItems([]);
      });
  useEffect(() => {
    load();
    // Settings placeholders, with their current values, for answers.
    legal
      .adminGet('terms')
      .then((p) => setTokens(p.tokens || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topics = useMemo(
    () => [...new Set((items || []).map((i) => i.category))],
    [items]
  );

  const move = async (item, dir) => {
    const same = items.filter((i) => i.category === item.category);
    const at = same.findIndex((i) => i.faq_id === item.faq_id);
    const other = same[at + dir];
    if (!other) return;
    try {
      await faqApi.update(item.faq_id, { position: other.position });
      await faqApi.update(other.faq_id, { position: item.position });
      load();
    } catch (e) {
      notify.error(e, 'We couldn’t move the question.');
    }
  };
  const togglePublished = async (item) => {
    try {
      await faqApi.update(item.faq_id, { published: !item.published });
      load();
    } catch (e) {
      notify.error(e, 'We couldn’t update the question.');
    }
  };
  const remove = async () => {
    try {
      await faqApi.remove(deleting.faq_id);
      notify.success('Question deleted.');
      setDeleting(null);
      load();
    } catch (e) {
      notify.error(e, 'We couldn’t delete the question.');
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        crumbs={[
          { label: 'Home', to: '/admin' },
          { label: 'FAQ', to: '/admin/faq' },
        ]}
        title="FAQ"
        subtitle="Questions and answers shown on the shop’s FAQ page, by topic."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FiEye />}
              href="/faq"
              target="_blank"
              sx={{ bgcolor: 'background.paper' }}
            >
              View on shop
            </Button>
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={() =>
                setEditing({
                  category: topics[0] || '',
                  question: '',
                  answer: '',
                  published: true,
                })
              }
            >
              Add question
            </Button>
          </Stack>
        }
      />
      <TablePanel>
        <TableContainer>
          <Table aria-label="FAQ">
            <TableHead sx={{ bgcolor: 'background.neutral' }}>
              <TableRow>
                <TableCell>Question</TableCell>
                <TableCell>Topic</TableCell>
                <TableCell>Shown</TableCell>
                <TableCell>Order</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {!items ? (
                <LoadingRows cols={5} rows={8} />
              ) : items.length ? (
                items.map((i) => {
                  const same = items.filter((x) => x.category === i.category);
                  const at = same.findIndex((x) => x.faq_id === i.faq_id);
                  return (
                    <TableRow
                      key={i.faq_id}
                      hover
                      data-testid={`faq-row-${i.faq_id}`}
                    >
                      <TableCell sx={{ fontWeight: 600, maxWidth: 420 }}>
                        {i.question}
                      </TableCell>
                      <TableCell>
                        <Pill label={i.category} tone="default" />
                      </TableCell>
                      <TableCell>
                        <Switch
                          size="small"
                          checked={i.published}
                          onChange={() => togglePublished(i)}
                          inputProps={{ 'aria-label': `Show “${i.question}”` }}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Move up">
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Move “${i.question}” up`}
                              disabled={at === 0}
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
                              aria-label={`Move “${i.question}” down`}
                              disabled={at === same.length - 1}
                              onClick={() => move(i, 1)}
                            >
                              <FiArrowDown />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <RowActions
                          label={`Actions for ${i.question}`}
                          items={[
                            {
                              label: 'Edit',
                              icon: <FiEdit2 />,
                              onClick: () => setEditing(i),
                            },
                            {
                              label: 'Delete',
                              icon: <FiTrash2 />,
                              color: 'error',
                              onClick: () => setDeleting(i),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <EmptyRow cols={5}>No questions yet.</EmptyRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TablePanel>

      <QuestionDialog
        item={editing}
        topics={topics}
        tokens={tokens}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
      <ConfirmationDialog
        open={Boolean(deleting)}
        title="Delete this question?"
        content={
          deleting
            ? `“${deleting.question}” will be removed from the FAQ page.`
            : ''
        }
        confirmText="Delete question"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Stack>
  );
};

export default FaqAdminPage;
