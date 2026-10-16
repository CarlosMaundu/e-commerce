// src/components/layout/CustomerBell.js — the shopper's notifications: order
// updates, returns, refunds sent and support replies. A dot shows how many are
// new; opening the bell marks them read. Desktop opens a dropdown, phones a
// bottom sheet. Checks for news every minute and when the tab comes back.
import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiBell,
  FiCornerUpLeft,
  FiLifeBuoy,
  FiPackage,
  FiRotateCcw,
  FiX,
} from 'react-icons/fi';
import { account } from '../../api';
import { timeAgo } from '../security/SecurityWidgets';
import ResponsiveSheet from '../common/ResponsiveSheet';

const KINDS = {
  order: { icon: <FiPackage />, color: 'primary' },
  return: { icon: <FiRotateCcw />, color: 'warning' },
  refund: { icon: <FiCornerUpLeft />, color: 'success' },
  support: { icon: <FiLifeBuoy />, color: 'info' },
};

const EMPTY = { items: [], total: 0, unread: 0 };

const CustomerBell = ({ sx }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [data, setData] = useState(EMPTY);
  const [anchor, setAnchor] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const open = phone ? sheetOpen : Boolean(anchor);

  const load = useCallback(
    () =>
      account
        .notifications()
        .then((d) => setData(d || EMPTY))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const show = (e) => {
    if (phone) setSheetOpen(true);
    else setAnchor(e.currentTarget);
    if (data.unread) {
      account.notificationsRead().catch(() => {});
    }
  };
  const close = () => {
    setSheetOpen(false);
    setAnchor(null);
    // Opening marked them read: the dot goes once the list is closed.
    setData((d) => ({
      ...d,
      unread: 0,
      items: d.items.map((i) => ({ ...i, unread: false })),
    }));
  };
  const openItem = (item) => {
    close();
    navigate(item.link);
  };
  const dismiss = (key) => {
    setData((d) => ({
      ...d,
      total: d.total - 1,
      items: d.items.filter((i) => i.key !== key),
    }));
    account.dismissNotification(key).catch(() => {});
  };
  const clearAll = () => {
    setData(EMPTY);
    account.notificationsClear().catch(() => {});
  };

  const list = (
    <>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.5, pt: phone ? 0.5 : 2, pb: 1 }}
      >
        <DialogTitle
          id="customer-notifications-title"
          component="h2"
          sx={{ p: 0, fontSize: '1.05rem', fontWeight: 700 }}
        >
          Notifications
        </DialogTitle>
        {data.items.length > 0 && (
          <Button size="small" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </Stack>
      {data.items.length ? (
        <List
          aria-label="Notifications"
          sx={{ pt: 0, maxHeight: phone ? 'none' : 420, overflowY: 'auto' }}
        >
          {data.items.map((item) => {
            const kind = KINDS[item.kind] || KINDS.order;
            const tone = theme.palette[kind.color].main;
            return (
              <ListItemButton
                key={item.key}
                onClick={() => openItem(item)}
                sx={{
                  alignItems: 'flex-start',
                  gap: 0.5,
                  pr: 6,
                  position: 'relative',
                  bgcolor: item.unread ? alpha(tone, 0.06) : 'transparent',
                }}
              >
                <ListItemIcon sx={{ minWidth: 48, mt: 0.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: tone,
                      bgcolor: alpha(tone, 0.12),
                    }}
                  >
                    {kind.icon}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{
                    fontWeight: item.unread ? 700 : 600,
                    fontSize: '0.9rem',
                  }}
                  secondary={
                    <>
                      {item.body}
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ display: 'block', mt: 0.25 }}
                      >
                        {timeAgo(item.at)}
                      </Typography>
                    </>
                  }
                />
                <IconButton
                  size="small"
                  aria-label={`Dismiss: ${item.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(item.key);
                  }}
                  sx={{ position: 'absolute', right: 8, top: 10 }}
                >
                  <FiX />
                </IconButton>
              </ListItemButton>
            );
          })}
        </List>
      ) : (
        <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
          <Box
            component={FiBell}
            sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }}
          />
          <Typography sx={{ fontWeight: 600 }}>You’re all caught up</Typography>
          <Typography variant="body2" color="text.secondary">
            Order updates, returns and replies show here.
          </Typography>
        </Box>
      )}
    </>
  );

  return (
    <>
      <IconButton
        aria-label={
          data.unread ? `Notifications, ${data.unread} new` : 'Notifications'
        }
        aria-haspopup="dialog"
        onClick={show}
        sx={sx}
      >
        <Badge
          color="error"
          variant={data.unread ? 'standard' : 'dot'}
          badgeContent={data.unread}
          max={9}
          invisible={!data.unread}
        >
          <FiBell />
        </Badge>
      </IconButton>
      {phone ? (
        <ResponsiveSheet
          open={open}
          onClose={close}
          aria-labelledby="customer-notifications-title"
        >
          {list}
        </ResponsiveSheet>
      ) : (
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              role: 'dialog',
              'aria-labelledby': 'customer-notifications-title',
              sx: {
                mt: 1.5,
                width: 380,
                maxWidth: 'calc(100vw - 32px)',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: '0 24px 48px rgba(27,33,36,0.12)',
              },
            },
          }}
        >
          {list}
        </Popover>
      )}
    </>
  );
};

CustomerBell.propTypes = {
  sx: PropTypes.object,
};

export default CustomerBell;
