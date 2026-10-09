// src/pages/SupportPage.js — "How can we help?": quick links (tracking,
// returns, FAQs, account), the shop's contact details, popular questions,
// and a request form. Anyone can send a request; signed-in customers can link
// it to an order and follow the replies in their account.
import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  FiCheckCircle,
  FiHelpCircle,
  FiMail,
  FiMapPin,
  FiPhone,
  FiRotateCcw,
  FiTruck,
  FiUser,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { canShop } from '../auth/permissions';
import { faq as faqApi, orders as ordersApi, support } from '../api';
import { useStore } from '../context/StoreContext';
import { useNotify } from '../notification/NotificationProvider';
import { SectionCard } from '../components/ui';

const QUICK = [
  [
    <FiTruck key="t" />,
    'Track an order',
    'See where your order is',
    '/account/track',
  ],
  [
    <FiRotateCcw key="r" />,
    'Returns & refunds',
    'Send something back',
    '/account/returns',
  ],
  [<FiHelpCircle key="f" />, 'FAQs', 'Answers to common questions', '/faq'],
  [
    <FiUser key="a" />,
    'Your account',
    'Orders, details and requests',
    '/account',
  ],
];

const SupportPage = () => {
  const { user } = useContext(AuthContext);
  const shop = useStore();
  const notify = useNotify();
  const [params] = useSearchParams();
  const shopper = user && canShop(user);
  const [categories, setCategories] = useState({});
  const [popular, setPopular] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    category: params.get('category') || '',
    order_id: params.get('order') || '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    support
      .categories()
      .then(setCategories)
      .catch(() => {});
    faqApi
      .list()
      .then((list) => setPopular(list.slice(0, 5)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!shopper) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.name || '',
      email: f.email || user.email || '',
    }));
    ordersApi
      .list({ limit: 20 })
      .then((r) => setMyOrders(r.orders))
      .catch(() => {});
  }, [shopper, user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const err = (key) =>
    errors[key] ? { error: true, helperText: errors[key] } : {};

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setErrors({});
    try {
      const res = await support.create({
        ...form,
        order_id: form.order_id || undefined,
      });
      setSent({ ...res, email: form.email });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setErrors(error?.fieldErrors || {});
      notify.error(error, 'We couldn’t send your request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      <Box
        sx={{
          textAlign: 'center',
          maxWidth: 640,
          mx: 'auto',
          mb: { xs: 3, md: 5 },
        }}
      >
        <Typography variant="h3" component="h1">
          How can we help?
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Find a quick answer below, or send us a request and the {shop.name}{' '}
          team will reply by email, usually within one business day.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          mb: { xs: 3, md: 5 },
        }}
      >
        {QUICK.map(([icon, title, text, to]) => (
          <Box
            key={title}
            component={RouterLink}
            to={to}
            sx={{
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              textDecoration: 'none',
              color: 'text.primary',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                mb: 1,
              }}
            >
              {icon}
            </Box>
            <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {text}
            </Typography>
          </Box>
        ))}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7.5}>
          {sent ? (
            <Box data-testid="support-sent">
              <SectionCard>
                <Stack spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      color: 'success.main',
                      fontSize: 40,
                      display: 'flex',
                    }}
                  >
                    <FiCheckCircle />
                  </Box>
                  <Typography variant="h5" component="h2">
                    Thanks, we’ve got your request
                  </Typography>
                  <Typography color="text.secondary">
                    Your reference is <strong>{sent.number}</strong>. We’ve
                    emailed a confirmation to {sent.email} and will reply there.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {sent.signed_in && (
                      <Button
                        variant="contained"
                        component={RouterLink}
                        to={`/account/support/${sent.number}`}
                      >
                        View your request
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setSent(null);
                        setForm((f) => ({ ...f, subject: '', message: '' }));
                      }}
                    >
                      Send another request
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>
            </Box>
          ) : (
            <SectionCard
              title="Send us a request"
              subtitle="Tell us what you need and we’ll get back to you."
            >
              <Box component="form" onSubmit={submit} noValidate>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Your name"
                      value={form.name}
                      onChange={set('name')}
                      {...err('name')}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Email address"
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      {...err('email')}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      label="What is it about?"
                      value={form.category}
                      onChange={set('category')}
                      {...err('category')}
                      fullWidth
                      required
                    >
                      {Object.entries(categories).map(([v, l]) => (
                        <MenuItem key={v} value={v}>
                          {l}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    {shopper && myOrders.length > 0 ? (
                      <TextField
                        select
                        label="Order (optional)"
                        value={form.order_id}
                        onChange={set('order_id')}
                        {...err('order_id')}
                        fullWidth
                      >
                        <MenuItem value="">Not about an order</MenuItem>
                        {myOrders.map((o) => (
                          <MenuItem key={o.id} value={String(o.id)}>
                            {o.number}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        label="Phone (optional)"
                        value={form.phone}
                        onChange={set('phone')}
                        {...err('phone')}
                        fullWidth
                      />
                    )}
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Subject"
                      value={form.subject}
                      onChange={set('subject')}
                      {...err('subject')}
                      inputProps={{ maxLength: 160 }}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="How can we help?"
                      value={form.message}
                      onChange={set('message')}
                      {...err('message')}
                      multiline
                      minRows={5}
                      inputProps={{ maxLength: 5000 }}
                      fullWidth
                      required
                    />
                  </Grid>
                </Grid>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                  spacing={1.5}
                  sx={{ mt: 2.5 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    We use your details only to answer you. See our{' '}
                    <Link component={RouterLink} to="/policies/privacy">
                      Privacy Policy
                    </Link>
                    .
                  </Typography>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={sending}
                  >
                    {sending ? 'Sending…' : 'Send request'}
                  </Button>
                </Stack>
              </Box>
            </SectionCard>
          )}
        </Grid>

        <Grid item xs={12} md={4.5}>
          <Stack spacing={3}>
            <SectionCard title="Contact us">
              <Stack spacing={1.5}>
                {[
                  [
                    <FiMail key="e" />,
                    shop.email,
                    shop.email && `mailto:${shop.email}`,
                  ],
                  [
                    <FiPhone key="p" />,
                    shop.phone,
                    shop.phone && `tel:${shop.phone.replace(/\s+/g, '')}`,
                  ],
                  [<FiMapPin key="a" />, shop.address, null],
                ]
                  .filter(([, v]) => v)
                  .map(([icon, value, href]) => (
                    <Stack
                      key={value}
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                    >
                      <Box sx={{ color: 'primary.main', mt: '3px' }}>
                        {icon}
                      </Box>
                      {href ? (
                        <Link
                          href={href}
                          underline="hover"
                          color="text.primary"
                        >
                          {value}
                        </Link>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: 'pre-line' }}
                        >
                          {value}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                {!shop.email && !shop.phone && !shop.address && (
                  <Typography variant="body2" color="text.secondary">
                    Use the form and we’ll reply by email.
                  </Typography>
                )}
              </Stack>
            </SectionCard>
            {popular.length > 0 && (
              <SectionCard
                title="Popular questions"
                action={
                  <Button size="small" component={RouterLink} to="/faq">
                    All FAQs
                  </Button>
                }
              >
                <Stack spacing={1}>
                  {popular.map((q) => (
                    <Link
                      key={q.faq_id}
                      component={RouterLink}
                      to={`/faq#faq-${q.faq_id}`}
                      underline="hover"
                      variant="body2"
                    >
                      {q.question}
                    </Link>
                  ))}
                </Stack>
              </SectionCard>
            )}
            {shopper && (
              <Alert severity="info" icon={false}>
                Your requests and our replies are under{' '}
                <Link component={RouterLink} to="/account/support">
                  Support
                </Link>{' '}
                in your account.
              </Alert>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SupportPage;
