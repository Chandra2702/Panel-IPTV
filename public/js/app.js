// Common JavaScript helpers for IPTV Panel frontend

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/login.html';
            return null;
        }
        const user = await response.json();

        // Update admin name if exists
        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) adminNameEl.textContent = user.username;

        // Show admin menu for admin role
        if (user.role === 'admin') {
            const adminMenu = document.getElementById('adminMenu');
            if (adminMenu) {
                adminMenu.innerHTML = `
                    <a href="resellers.html"><i class="fa fa-user-tie"></i> Resellers</a>
                    <a href="bouquets.html"><i class="fa fa-layer-group"></i> Bouquets</a>
                    <a href="categories.html"><i class="fa fa-tags"></i> Categories</a>
                    <a href="monitor.html"><i class="fa fa-heartbeat"></i> Monitor</a>
                    <a href="shortlinks.html"><i class="fa fa-link"></i> Shortlinks</a>
                    <a href="settings.html"><i class="fa fa-cog"></i> Settings</a>
                `;
            }
        }

        // Show credits for reseller
        if (user.role === 'reseller') {
            const creditsDisplay = document.getElementById('creditsDisplay');
            const creditsEl = document.getElementById('credits');
            if (creditsDisplay) creditsDisplay.classList.remove('d-none');
            if (creditsEl) creditsEl.textContent = user.credits;
        }

        return user;
    } catch (err) {
        window.location.href = '/login.html';
        return null;
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) { }
    window.location.href = '/login.html';
}

// Toggle sidebar for mobile
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.overlay').classList.toggle('active');
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '∞';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// API helper
async function apiCall(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Show success toast
function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'Success',
        text: message,
        timer: 2000,
        showConfirmButton: false
    });
}

// Show error toast
function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message
    });
}

// Confirm dialog
async function confirmAction(title, text) {
    const result = await Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes'
    });
    return result.isConfirmed;
}
