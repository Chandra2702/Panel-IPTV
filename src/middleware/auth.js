// Authentication middleware for admin routes

function requireAuth(req, res, next) {
    if (req.session && req.session.adminLoggedIn) {
        return next();
    }

    // Check if API request or page request
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    // Redirect to login for page requests
    return res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.adminLoggedIn && req.session.adminRole === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Access denied. Admin only.' });
}

module.exports = {
    requireAuth,
    requireAdmin
};
