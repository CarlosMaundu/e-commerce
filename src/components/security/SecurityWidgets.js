// src/components/security/SecurityWidgets.js — sign-in sessions and activity,
// shared by the staff profile, security settings, user activity and the
// customer's own security page (adapted from the portal's SessionsTable and
// UserActivityDialog).
import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { FiMonitor, FiSmartphone, FiTablet } from 'react-icons/fi';
import { formatDateTime } from '../../utils/format';
import { EmptyState } from '../ui';
import { PAGE_SIZE, StandardPagination, usePaging } from '../admin/DataTable';

const DEVICE_ICONS = {
  mobile: FiSmartphone,
  tablet: FiTablet,
  desktop: FiMonitor,
};

/** "5 minutes ago" style text. */
export const timeAgo = (date) => {
  if (!date) return '—';
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} day${d === 1 ? '' : 's'} ago` : formatDateTime(date);
};

export const SessionsTable = ({
  sessions,
  onEnd,
  busyId,
  showUser = false,
  emptyText = 'No active sessions.',
}) => {
  const paging = usePaging();
  if (!sessions) return <Skeleton height={120} />;
  if (!sessions.length) return <EmptyState title={emptyText} />;
  return (
    <TableContainer>
      <Table size="small" aria-label="Sign-in sessions">
        <TableHead>
          <TableRow>
            {showUser && <TableCell>User</TableCell>}
            <TableCell>Device</TableCell>
            <TableCell>IP address</TableCell>
            <TableCell>Signed in</TableCell>
            <TableCell>Last active</TableCell>
            {onEnd && <TableCell align="right" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {paging.slice(sessions).map((s) => {
            const Icon = DEVICE_ICONS[s.device] || FiMonitor;
            return (
              <TableRow key={s.id} data-testid={`session-${s.id}`}>
                {showUser && (
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {s.user?.name}
                    </Typography>
                    <Typography variant="caption">{s.user?.email}</Typography>
                  </TableCell>
                )}
                <TableCell>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        bgcolor: 'background.neutral',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon />
                    </Box>
                    <Box>
                      <Typography variant="body2">
                        {s.browser}
                        {s.os ? ` on ${s.os}` : ''}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {s.current && (
                          <Chip
                            size="small"
                            color="success"
                            label="This device"
                          />
                        )}
                        {s.impersonatedBy && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label={`Acting: ${s.impersonatedBy}`}
                          />
                        )}
                        {s.staff && (
                          <Chip size="small" variant="outlined" label="Staff" />
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {s.ip || '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDateTime(s.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {timeAgo(s.lastActive)}
                  </Typography>
                </TableCell>
                {onEnd && (
                  <TableCell align="right">
                    {!s.current && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => onEnd(s)}
                        disabled={busyId === s.id}
                      >
                        {busyId === s.id ? 'Ending…' : 'Sign out'}
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {sessions.length > PAGE_SIZE && (
        <StandardPagination count={sessions.length} {...paging.props} />
      )}
    </TableContainer>
  );
};

SessionsTable.propTypes = {
  sessions: PropTypes.array,
  onEnd: PropTypes.func,
  busyId: PropTypes.string,
  showUser: PropTypes.bool,
  emptyText: PropTypes.string,
};

const ACTION_TONES = {
  'auth.login_failed': 'warning',
  'auth.locked': 'error',
  'admin.impersonation_started': 'warning',
};

export const ActivityList = ({ activity, showUser = false }) => {
  if (!activity) return <Skeleton height={160} />;
  if (!activity.length) return <EmptyState title="No activity yet." />;
  return (
    <Stack spacing={0} data-testid="activity">
      {activity.map((a) => (
        <Stack
          key={a.id}
          direction="row"
          spacing={1.5}
          sx={{
            py: 1.25,
            borderBottom: 1,
            borderColor: 'divider',
            '&:last-child': { borderBottom: 0 },
          }}
        >
          <Box
            sx={{
              mt: 0.75,
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: `${ACTION_TONES[a.action] || 'primary'}.main`,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {a.description}
              {showUser && a.user && (
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                >
                  {' '}
                  · {a.user.name} ({a.user.email})
                </Typography>
              )}
            </Typography>
            <Typography variant="caption">
              {formatDateTime(a.createdAt)}
              {a.ip ? ` · ${a.ip}` : ''}
              {a.target && !a.target.startsWith('user:')
                ? ` · ${a.target}`
                : ''}
            </Typography>
            {a.impersonatedBy && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={`Done by ${a.impersonatedBy} as this customer`}
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

ActivityList.propTypes = {
  activity: PropTypes.array,
  showUser: PropTypes.bool,
};
