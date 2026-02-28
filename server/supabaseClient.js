const { createClient } = require('@supabase/supabase-js');
const { Agent, setGlobalDispatcher } = require('undici');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isProduction = process.env.NODE_ENV === 'production';
const allowSelfSignedTls =
  !isProduction && process.env.ALLOW_SELF_SIGNED_TLS !== 'false';

const insecureAgent = allowSelfSignedTls
  ? new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    })
  : null;

const customFetch = (url, options = {}) => {
  if (!insecureAgent) {
    return fetch(url, options);
  }

  return fetch(url, {
    ...options,
    dispatcher: insecureAgent,
  });
};

if (allowSelfSignedTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  setGlobalDispatcher(insecureAgent);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: {
    fetch: customFetch,
  },
});

module.exports = {
  supabase,
};
