// src/lib/users.ts — loading users with their role and permissions.
import { query } from '../db';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string | null;
  google_sub: string | null;
  firstname: string;
  lastname: string;
  avatar: string;
  phone: string;
  role_id: number;
  role: string;
  status: 'active' | 'suspended';
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  created_at: Date;
}

const USER_SELECT = `
  SELECT u.*, r.code AS role
  FROM users u JOIN roles r ON r.id = u.role_id`;

export const findUserById = async (id: number | string) =>
  (await query<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [id])).rows[0];

export const findUserByEmail = async (email: string) =>
  (await query<UserRow>(`${USER_SELECT} WHERE lower(u.email) = lower($1)`, [email.trim()])).rows[0];

export const permissionsForRole = async (roleId: number): Promise<string[]> =>
  (
    await query<{ code: string }>(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1 ORDER BY p.code`,
      [roleId]
    )
  ).rows.map((r) => r.code);

export const roleIdFor = async (code: string) => {
  const row = (await query<{ id: number }>('SELECT id FROM roles WHERE code = $1', [code])).rows[0];
  return row?.id;
};

/** Contract shape (see src/api/contract.md in the frontend). */
export const toContractUser = (u: UserRow, permissions?: string[]) => ({
  customer_id: u.id,
  firstname: u.firstname,
  lastname: u.lastname,
  email: u.email,
  role: u.role,
  ...(permissions ? { permissions } : {}),
  avatar: u.avatar,
  telephone: u.phone || '',
  status: u.status,
  has_password: Boolean(u.password_hash),
  locked_until: u.locked_until && u.locked_until > new Date() ? u.locked_until : null,
  last_login: u.last_login_at,
  date_added: u.created_at,
});

/** "*" grants everything (super admin). */
export const hasPermission = (permissions: string[], required: string) =>
  permissions.includes('*') || permissions.includes(required);
