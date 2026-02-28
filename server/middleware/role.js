const getUserRole = (user) => {
  return (
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    'client'
  );
};

const requireRole = (allowedRoles) => {
  const normalized = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    const role = getUserRole(req.user);
    if (!normalized.includes(role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    req.userRole = role;
    return next();
  };
};

module.exports = {
  getUserRole,
  requireRole,
};
