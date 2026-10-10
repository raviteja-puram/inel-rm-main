export const ROLE_LABELS = {
  admin: 'Admin',
  planner: 'Planner',
  analyst: 'Analyst',
};

const ROLE_PERMISSIONS = {
  admin: {
    routes: ['dashboard', 'components', 'products', 'bom', 'stock', 'reports', 'users' , 'email'],
    canManageUsers: true,
    canResetData: true,
    canManageMasters: true,
    canManageProduction: true,
    canManageStock: true,
    canViewHistory: true,
  },
  planner: {
    routes: ['dashboard', 'bom', 'stock'],
    canManageUsers: false,
    canResetData: false,
    canManageMasters: false,
    canManageProduction: true,
    canManageStock: true,
    canViewHistory: false,
  },
  analyst: {
    routes: ['dashboard', 'reports'],
    canManageUsers: false,
    canResetData: false,
    canManageMasters: false,
    canManageProduction: false,
    canManageStock: false,
    canViewHistory: true,
  },
};

export function getPermissions(user) {
  return ROLE_PERMISSIONS[user?.role] || ROLE_PERMISSIONS.analyst;
}

export function canOpenRoute(user, routeKey) {
  return getPermissions(user).routes.includes(routeKey);
}
