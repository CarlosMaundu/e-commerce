// src/api/index.js
//
// The only module screens, slices and contexts import data functions from.
// Which implementation answers depends on REACT_APP_DATA_SOURCE (config.js):
//   demo → public demo API, except features it lacks (newsletter)
//   mock → in-browser fake backend implementing our contract
//   api  → our backend, same contract
import { DATA_SOURCE } from './config';
import * as demo from './demo';
import * as remote from './remote';

const source = DATA_SOURCE === 'demo' ? demo : remote;

export const catalog = source.catalog;
export const adminCatalog = source.adminCatalog;
export const account = source.account;
export const adminUsers = source.adminUsers;
export const newsletter = source.newsletter;

export { DATA_SOURCE } from './config';

export const USER_ROLES = ['customer', 'admin'];
export const DEFAULT_AVATAR_URL = demo.DEFAULT_AVATAR_URL;
