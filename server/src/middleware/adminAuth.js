function adminAuth(req, res, next) {
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'changeme';

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  let name, pass;
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    name = decoded.slice(0, idx);
    pass = decoded.slice(idx + 1);
  }

  if (name !== expectedUser || pass !== expectedPass) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Zugriff verweigert');
  }
  next();
}

module.exports = adminAuth;
