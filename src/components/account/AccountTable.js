// src/components/account/AccountTable.js — the table used across the
// customer's account (invoices, refunds, support, addresses): a bordered
// panel, small uppercase headings, loading rows, an empty state and paging.
import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { EmptyState } from '../ui';
import { LoadingRows, StandardPagination } from '../admin/DataTable';

const AccountTable = ({
  label,
  columns,
  loading,
  empty,
  children,
  count,
  page,
  rowsPerPage,
  onPageChange,
  itemsLabel,
}) => {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <TableContainer>
        <Table aria-label={label}>
          <TableHead
            sx={{
              bgcolor: 'background.neutral',
              '& th': {
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              },
            }}
          >
            <TableRow>
              {columns.map((c, i) => (
                <TableCell key={c.label || i} align={c.align}>
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <LoadingRows cols={columns.length} rows={5} />
            ) : rows.length ? (
              rows
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState
                    icon={empty.icon}
                    title={empty.title}
                    action={empty.action}
                  >
                    {empty.text}
                  </EmptyState>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {!loading && count > 0 && (
        <StandardPagination
          count={count}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => onPageChange(p)}
          onRowsPerPageChange={() => {}}
          maxShowAll={0}
          label={itemsLabel}
        />
      )}
    </Box>
  );
};

AccountTable.propTypes = {
  label: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({ label: PropTypes.string, align: PropTypes.string })
  ).isRequired,
  loading: PropTypes.bool,
  empty: PropTypes.shape({
    icon: PropTypes.node,
    title: PropTypes.string.isRequired,
    text: PropTypes.node,
    action: PropTypes.node,
  }).isRequired,
  children: PropTypes.node,
  count: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  onPageChange: PropTypes.func,
  itemsLabel: PropTypes.string,
};

AccountTable.defaultProps = {
  loading: false,
  children: null,
  count: 0,
  page: 0,
  rowsPerPage: 10,
  onPageChange: () => {},
  itemsLabel: 'items',
};

export default AccountTable;
