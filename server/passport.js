const passport = require('passport');
const { supabase } = require('./supabaseClient');

class SupabaseBearerStrategy extends passport.Strategy {
  constructor() {
    super();
    this.name = 'supabase-bearer';
  }

  async authenticate(req) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        return this.fail({ message: 'Missing bearer token' }, 401);
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return this.fail({ message: 'Invalid token' }, 401);
      }

      return this.success(data.user);
    } catch (error) {
      return this.error(error);
    }
  }
}

passport.use(
  'supabase-bearer',
  new SupabaseBearerStrategy()
);

module.exports = passport;
