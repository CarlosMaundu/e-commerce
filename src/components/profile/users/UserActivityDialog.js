// src/components/profile/users/UserActivityDialog.js — a user's recent
// activity and active sessions (the portal's UserActivityDialog, simplified).
import { PagedList } from '../../admin/DataTable';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { adminSecurity } from '../../../api';
import { roleLabel } from '../../../auth/permissions';
import {
  ActivityList,
  SessionsTable,
  timeAgo,
} from '../../security/SecurityWidgets';

const UserActivityDialog = ({ user, onClose }) => {
  const [tab, setTab] = useState('activity');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    setData(null);
    setTab('activity');
    adminSecurity
      .userActivity(user.id)
      .then((d) => active && setData(d))
      .catch(() => active && setData({ activity: [], sessions: [] }));
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <Dialog open={Boolean(user)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar src={user?.avatar || undefined} alt="">
            {user?.name?.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="h6">{user?.name}</Typography>
            <Typography variant="caption">
              {user?.email} · {roleLabel(user?.role)} · last sign-in{' '}
              {timeAgo(user?.lastLogin)}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="activity" label="Activity" />
          <Tab
            value="sessions"
            label={`Signed in${data ? ` (${data.sessions.length})` : ''}`}
          />
        </Tabs>
        {tab === 'activity' ? (
          <PagedList rows={data?.activity} label="events" padded>
            {(rows) => <ActivityList activity={rows} />}
          </PagedList>
        ) : (
          <PagedList rows={data?.sessions} label="sessions">
            {(rows) => (
              <SessionsTable
                sessions={rows}
                emptyText="Not signed in anywhere."
              />
            )}
          </PagedList>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

UserActivityDialog.propTypes = {
  user: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

export default UserActivityDialog;
