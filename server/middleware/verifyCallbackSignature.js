const crypto = require('crypto');

function sortObjectDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectDeep);
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    const sorted = {};
    Object.keys(value).sort().forEach((key) => {
      sorted[key] = sortObjectDeep(value[key]);
    });
    return sorted;
  }

  return value;
}

function verifyCallbackSignature(req, res, next) {
  const callbackSecret = process.env.CALLBACK_SECRET;
  if (!callbackSecret) {
    return res.status(503).json({ message: 'Callback signature verification is not configured.' });
  }

  const signatureHeader = req.header('x-signature');
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return res.status(401).json({ message: 'Missing callback signature.' });
  }

  const normalizedSignature = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  if (!/^[a-f0-9]{64}$/i.test(normalizedSignature)) {
    return res.status(401).json({ message: 'Invalid callback signature format.' });
  }

  const canonicalBody = JSON.stringify(sortObjectDeep(req.body || {}));
  const expectedSignature = crypto
    .createHmac('sha256', callbackSecret)
    .update(canonicalBody, 'utf8')
    .digest('hex');

  const receivedBuffer = Buffer.from(normalizedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return res.status(401).json({ message: 'Invalid callback signature.' });
  }

  return next();
}

module.exports = { verifyCallbackSignature };
