const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';
const REQUEST_ENCRYPTION_KEY =
  process.env.REQUEST_ENCRYPTION_KEY ||
  process.env.NEXT_PUBLIC_REQUEST_ENCRYPTION_KEY ||
  (isProduction ? '' : 'dev-encryption-key');

function decryptPayload(encryptedPayload) {
  const [ivHex, encryptedHex] = String(encryptedPayload || '').split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.createHash('sha256').update(REQUEST_ENCRYPTION_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

function requestEncryptionMiddleware(req, res, next) {
  // Decrypt payload only when client explicitly marks request as encrypted.
  if (req.headers['x-payload-encrypted'] !== 'true') {
    return next();
  }

  try {
    if (!REQUEST_ENCRYPTION_KEY) {
      return res.status(500).json({ error: 'Server encryption key is missing' });
    }

    if (!req.body || !req.body.encryptedPayload) {
      return res.status(400).json({ error: 'Encrypted payload not provided' });
    }

    req.body = decryptPayload(req.body.encryptedPayload);
    return next();
  } catch (error) {
    return res.status(400).json({ error: 'Failed to decrypt payload' });
  }
}

function signToken(token) {
  const secret = process.env.CSRF_SECRET || 'csrf-secret';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function issueCSRFToken(req, res) {
  const token = crypto.randomBytes(24).toString('hex');
  const signature = signToken(token);
  const cookieValue = `${token}.${signature}`;

  // Cookie is same-site strict to reduce CSRF attack surface.
  res.cookie('csrfToken', cookieValue, {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  });

  return res.status(200).json({ csrfToken: token });
}

function validateCSRFToken(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const csrfHeader = req.headers['x-csrf-token'];
  const csrfCookie = req.cookies?.csrfToken;

  if (!csrfHeader || !csrfCookie) {
    return res.status(403).json({ error: 'Missing CSRF token' });
  }

  const [cookieToken, cookieSignature] = String(csrfCookie).split('.');
  if (!cookieToken || !cookieSignature) {
    return res.status(403).json({ error: 'Invalid CSRF cookie' });
  }

  const expectedSignature = signToken(cookieToken);
  if (cookieSignature !== expectedSignature || csrfHeader !== cookieToken) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  return next();
}

module.exports = {
  requestEncryptionMiddleware,
  validateCSRFToken,
  issueCSRFToken,
};
