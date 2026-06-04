export function requireSecret(req, res) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== process.env.BACKLOG_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    throw new Error('Unauthorized');
  }
}
