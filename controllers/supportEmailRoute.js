exports.getSupportEmail = (req, res) => {
    res.status(200).json({ supportEmail: process.env.SUPPORT_EMAIL || 'default@example.com' });
};