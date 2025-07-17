// In your Contest Service -> middleware/internalAuth.js

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN; ; // Get key from environment variables

const internalAuth = (req, res, next) => {
    const providedKey = req.headers['x-internal-api-key'];
    if (providedKey && providedKey === INTERNAL_API_TOKEN) {
        return next();
    }
    res.status(403).json({ message: 'Forbidden: Invalid internal API key.' });
};

module.exports = internalAuth;