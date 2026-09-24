import { supabaseAdmin } from '../supabaseClient.mjs';

/**
 * Middleware: verify Supabase JWT from Authorization: Bearer <token>
 * Attaches req.user = { id, email, role }
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', user.id)
    .single();

  req.user = { id: user.id, email: user.email, role: profile?.role || 'client', ...profile };
  next();
}

/**
 * Middleware: require one of the given roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Role '${req.user.role}' is not authorized` });
    }
    next();
  };
}

export const requireAdmin    = requireRole('admin');
export const requireProvider = requireRole('admin', 'provider');
