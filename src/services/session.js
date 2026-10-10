const CURRENT_USER_KEY = 'inel_rm_current_user';
const USERS_KEY = 'inel_rm_users';

export const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Admin' },
  { username: 'planner', password: 'plan123', role: 'planner', name: 'Planner' },
  { username: 'analyst', password: 'view123', role: 'analyst', name: 'Analyst' },
];

let currentUser = readCurrentUser();

function readCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)) || null;
  } catch {
    return null;
  }
}

function persistUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getUsers() {
  try {
    const stored = JSON.parse(localStorage.getItem(USERS_KEY));
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {
    // Fall through to defaults.
  }
  persistUsers(DEFAULT_USERS);
  return DEFAULT_USERS;
}

export function saveUser(user) {
  const clean = {
    username: String(user.username || '').trim().toLowerCase(),
    password: String(user.password || '').trim(),
    role: user.role || 'analyst',
    name: String(user.name || user.username || '').trim(),
  };
  if (!clean.username || !clean.password) throw new Error('Username and password are required');
  const users = getUsers();
  const next = users.some((u) => u.username === clean.username)
    ? users.map((u) => (u.username === clean.username ? clean : u))
    : [...users, clean];
  persistUsers(next);
  return clean;
}

export function deleteUser(username) {
  const users = getUsers().filter((u) => u.username !== username);
  persistUsers(users.length ? users : DEFAULT_USERS);
}

export function setCurrentUser(user) {
  currentUser = user
    ? { username: user.username, role: user.role, name: user.name || user.username }
    : null;
  if (currentUser) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
  else localStorage.removeItem(CURRENT_USER_KEY);
}

export function getCurrentUser() {
  return currentUser;
}

export function clearCurrentUser() {
  currentUser = null;
  localStorage.removeItem(CURRENT_USER_KEY);
}
