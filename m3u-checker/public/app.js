document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const startBtn = document.getElementById('start-btn');
    const fileInput = document.getElementById('m3u-file');
    const urlInput = document.getElementById('m3u-url');
    const fileNameDisplay = document.getElementById('file-name-display');
    const dropArea = document.getElementById('drop-area');
    const errorMsg = document.getElementById('error-message');

    // Status Elements
    const progressSection = document.getElementById('progress-section');
    const resultsSection = document.getElementById('results-section');
    const actionBar = document.getElementById('action-bar');
    const statTotal = document.getElementById('stat-total');
    const statOnline = document.getElementById('stat-online');
    const statOffline = document.getElementById('stat-offline');
    const statPercent = document.getElementById('stat-percent');
    const progressBar = document.getElementById('progress-bar');
    const channelsBody = document.getElementById('channels-body');
    const exportOnlineBtn = document.getElementById('export-online-btn');
    const exportOfflineBtn = document.getElementById('export-offline-btn');
    const resetBtn = document.getElementById('reset-btn');
    const stopBtn = document.getElementById('stop-btn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');

    // Pagination Elements
    const paginationContainer = document.getElementById('pagination-container');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    const pageStartInfo = document.getElementById('page-start-info');
    const pageEndInfo = document.getElementById('page-end-info');
    const pageTotalInfo = document.getElementById('page-total-info');

    // Settings Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    const settingConcurrency = document.getElementById('setting-concurrency');
    const settingTimeout = document.getElementById('setting-timeout');

    // State
    let channels = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let isScanning = false;
    let eventSource = null;

    // Config State
    let config = {
        concurrency: 30,
        timeout: 5000
    };

    // Pagination State
    let currentPage = 1;
    const itemsPerPage = 100;

    // Settings Logic
    settingsBtn.addEventListener('click', () => {
        settingConcurrency.value = config.concurrency;
        settingTimeout.value = config.timeout;
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

    saveSettingsBtn.addEventListener('click', () => {
        config.concurrency = parseInt(settingConcurrency.value) || 30;
        config.timeout = parseInt(settingTimeout.value) || 5000;
        settingsModal.classList.add('hidden');
    });

    // Tabs logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (isScanning) return;

            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });

    // File Drop & Select Logic
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('dragover');
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });

    fileInput.addEventListener('change', handleFileSelect);

    function handleFileSelect() {
        if (fileInput.files.length > 0) {
            const names = Array.from(fileInput.files).map(f => f.name).join(', ');
            fileNameDisplay.textContent = names.length > 50 ? `${fileInput.files.length} file terpilih` : names;
            errorMsg.textContent = '';
        } else {
            fileNameDisplay.textContent = '';
        }
    }

    urlInput.addEventListener('input', () => {
        errorMsg.textContent = '';
    });

    // Main Scan Action
    startBtn.addEventListener('click', async () => {
        errorMsg.textContent = '';
        const activeTab = document.querySelector('.tab.active').dataset.target;

        const formData = new FormData();

        if (activeTab === 'upload-form') {
            if (!fileInput.files.length) {
                errorMsg.textContent = 'Silakan pilih setidaknya satu file M3U.';
                return;
            }
            Array.from(fileInput.files).forEach(file => {
                formData.append('m3u', file); // Append each file with the same key
            });
        } else {
            const urls = urlInput.value.split('\n').map(u => u.trim()).filter(u => u && u.startsWith('http'));
            if (urls.length === 0) {
                errorMsg.textContent = 'Silakan masukkan minimal satu URL HTTP M3U yang valid.';
                return;
            }
            // Add as JSON string since we use JSON for urls
            urls.forEach(u => formData.append('urls[]', u)); // Not using this for URL actually, see below
        }

        try {
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> MEMPROSES...';

            // Upload / Parse Request
            let fetchOptions;

            if (activeTab === 'upload-form') {
                fetchOptions = {
                    method: 'POST',
                    body: formData // contains multiple 'm3u' files
                };
            } else {
                const urls = urlInput.value.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
                fetchOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls })
                };
            }

            const response = await fetch('/api/upload', fetchOptions);

            const data = await response.json();

            if (!response.ok) {
                errorMsg.textContent = data.error || 'Terjadi kesalahan tidak diketahui.';
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i> MULAI SCAN';
                return;
            }

            // Successfully parsed, layout will change
            startScanning(data.jobId, data.total);

        } catch (error) {
            errorMsg.textContent = 'Koneksi ke server gagal. Harap coba lagi.';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> MULAI SCAN';
        }
    });

    function startScanning(jobId, total) {
        isScanning = true;
        channels = [];

        // Reset UI Context
        statTotal.textContent = total;
        statOnline.textContent = '0';
        statOffline.textContent = '0';
        statPercent.textContent = '0%';
        progressBar.style.width = '0%';
        channelsBody.innerHTML = '';
        currentFilter = 'all';
        filterBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.filter === 'all');
        });

        // Hide input, show progress
        document.getElementById('input-section').classList.add('hidden');
        progressSection.classList.remove('hidden');
        resultsSection.classList.remove('hidden');
        actionBar.classList.remove('hidden');
        stopBtn.classList.remove('hidden');
        exportOnlineBtn.classList.add('hidden');
        exportOfflineBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');

        // Start SSE
        eventSource = new EventSource(`/api/check?jobId=${jobId}&concurrency=${config.concurrency}&timeout=${config.timeout}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (event.type === 'message') {
                channels.push(data);

                // Jika sedang di halaman 1, tambahkan langsung ke DOM (sangat cepat dibanding me-render ulang seluruh tabel)
                // dan hapus elemen paling bawah jika sudah lebih dari batas per halaman
                if (currentPage === 1 && !searchQuery) { // Jangan live update jika sedang melakukan pencarian
                    appendChannel(data);
                    if (channelsBody.children.length > itemsPerPage) {
                        channelsBody.removeChild(channelsBody.lastChild);
                    }

                    // Sesuaikan juga info pagination
                    const filtered = currentFilter === 'all' ? channels : channels.filter(c => c.status === currentFilter);
                    const totalItems = filtered.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

                    pageStartInfo.textContent = 1;
                    pageEndInfo.textContent = channelsBody.children.length;
                    pageTotalInfo.textContent = totalItems;
                    pageIndicator.textContent = `Hal 1 dari ${totalPages}`;

                    nextPageBtn.disabled = totalPages <= 1;
                }

                updateStats(channels.length, total);
            }
        };

        eventSource.addEventListener('done', () => {
            eventSource.close();
            isScanning = false;

            stopBtn.classList.add('hidden');
            exportOnlineBtn.classList.remove('hidden');
            exportOfflineBtn.classList.remove('hidden');
            resetBtn.classList.remove('hidden');

            // Remove progress animation
            document.querySelector('.stat-card i.fa-spinner').classList.remove('fa-spin');
            document.querySelector('.stat-card i.fa-spinner').style.color = 'var(--accent)';
        });

        eventSource.onerror = (error) => {
            console.error('SSE Error', error);
            // Ignore minor reconnects, but if it completely fails we could show an error
        };
    }

    // Stop Scan Logic
    stopBtn.addEventListener('click', () => {
        if (eventSource) {
            eventSource.close();
            isScanning = false;

            // UI updates
            document.querySelector('.stat-card i.fa-spinner').classList.remove('fa-spin');
            document.querySelector('.stat-card i.fa-spinner').style.color = 'var(--text-muted)';
            stopBtn.classList.add('hidden');
            exportOnlineBtn.classList.remove('hidden');
            exportOfflineBtn.classList.remove('hidden');
            resetBtn.classList.remove('hidden');
        }
    });

    // Search Logic
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1; // Reset to page 1 on search
        renderChannels();
    });

    // Pagination controls
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderChannels();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalItems = getFilteredChannels().length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (currentPage < totalPages) {
            currentPage++;
            renderChannels();
        }
    });

    function getFilteredChannels() {
        let filtered = channels;

        // Apply status filter
        if (currentFilter !== 'all') {
            filtered = filtered.filter(c => c.status === currentFilter);
        }

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(searchQuery) ||
                (c.group && c.group.toLowerCase().includes(searchQuery))
            );
        }

        return filtered;
    }

    function appendChannel(channel) {
        // filter logic on the fly
        if (currentFilter !== 'all' && channel.status !== currentFilter) {
            return; // Don't append if it doesn't match active filter
        }

        const tr = document.createElement('tr');
        tr.className = `channel-row fade-in stat-${channel.status}`;

        const statusHtml = channel.status === 'online'
            ? '<span class="status-badge status-online"><i class="fa-solid fa-check"></i> ONLINE</span>'
            : '<span class="status-badge status-offline"><i class="fa-solid fa-xmark"></i> OFFLINE</span>';

        // Format text untuk ditampilkan
        const statusText = channel.status === 'online' ? 'Aktif' : 'Mati';

        tr.innerHTML = `
            <td>
                ${channel.logo ? `<img src="${channel.logo}" class="channel-logo" alt="${channel.name}" onerror="this.outerHTML='<div class=\\'logo-placeholder\\'><i class=\\'fa-solid fa-tv\\'></i></div>'">`
                : `<div class="logo-placeholder"><i class="fa-solid fa-tv"></i></div>`}
            </td>
            <td><span class="group-badge">${channel.group || 'Tanpa Kategori'}</span></td>
            <td class="channel-name" title="${channel.name}">${channel.name}</td>
            <td class="channel-url"><a href="${channel.url}" target="_blank" title="${channel.url}">${channel.url}</a></td>
            <td>
                <span class="status-badge status-${channel.status}">
                    ${statusText}
                </span>
            </td>
        `;
        // Insert at top to see latest
        channelsBody.insertBefore(tr, channelsBody.firstChild);
    }

    function updateStats(current, total) {
        const onlineCount = channels.filter(c => c.status === 'online').length;
        const offlineCount = channels.filter(c => c.status === 'offline').length;
        const percentage = Math.round((current / total) * 100);

        statOnline.textContent = onlineCount;
        statOffline.textContent = offlineCount;
        statPercent.textContent = `${percentage}%`;
        progressBar.style.width = `${percentage}%`;
    }

    // Filtering
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilter = btn.dataset.filter;
            renderChannels();
        });
    });

    function renderChannels() {
        channelsBody.innerHTML = '';
        const filtered = getFilteredChannels();

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

        const pageItems = filtered.slice(startIndex, endIndex);
        pageItems.forEach(appendChannel);

        // Update pagination UI
        if (totalItems > itemsPerPage || searchQuery) {
            paginationContainer.classList.remove('hidden');
        } else if (totalItems <= itemsPerPage && !searchQuery && currentFilter === 'all') {
            paginationContainer.classList.add('hidden');
        }

        pageStartInfo.textContent = totalItems === 0 ? 0 : startIndex + 1;
        pageEndInfo.textContent = endIndex;
        pageTotalInfo.textContent = totalItems;
        pageIndicator.textContent = `Hal ${currentPage} dari ${totalPages}`;

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    // Helper to generate the M3U content and download
    function downloadM3u(channelsList, type) {
        if (channelsList.length === 0) {
            alert(`Tidak ada channel ${type} untuk disimpan!`);
            return;
        }

        // Group channels by category
        const groupedChannels = {};
        channelsList.forEach(c => {
            const group = c.group || 'Tanpa Kategori';
            if (!groupedChannels[group]) {
                groupedChannels[group] = [];
            }
            groupedChannels[group].push(c);
        });

        let m3uContent = '#EXTM3U\n';

        // Loop through categories and add a separator for each
        Object.keys(groupedChannels).sort().forEach(groupName => {
            // Add a visual separator as a non-playable channel in the M3U
            m3uContent += `#EXTINF:-1 tvg-id="" tvg-name="========== ${groupName.toUpperCase()} ==========" tvg-logo="" group-title="${groupName}",========== ${groupName.toUpperCase()} ==========\nhttp://localhost/separator\n`;

            // Add all channels in this category
            groupedChannels[groupName].forEach(c => {
                // Use raw EXTINF if available to preserve EPG IDs, fallback to constructed one
                if (c.raw) {
                    m3uContent += `${c.raw}\n${c.url}\n`;
                } else {
                    const groupAttr = c.group && c.group !== 'Tanpa Kategori' ? ` group-title="${c.group}"` : '';
                    m3uContent += `#EXTINF:-1 tvg-logo="${c.logo || ''}"${groupAttr},${c.name}\n${c.url}\n`;
                }
            });
            m3uContent += '\n'; // Extra newline for readability
        });

        const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_channels_${new Date().getTime()}.m3u`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Export Online M3U
    exportOnlineBtn.addEventListener('click', () => {
        const onlineChannels = channels.filter(c => c.status === 'online');
        downloadM3u(onlineChannels, 'online');
    });

    // Export Offline M3U
    exportOfflineBtn.addEventListener('click', () => {
        const offlineChannels = channels.filter(c => c.status === 'offline');
        downloadM3u(offlineChannels, 'offline');
    });

    // Reset UI to start a new scan
    resetBtn.addEventListener('click', () => {
        // Reset state
        channels = [];
        isScanning = false;

        // Reset UI Context
        statTotal.textContent = '0';
        statOnline.textContent = '0';
        statOffline.textContent = '0';
        statPercent.textContent = '0%';
        progressBar.style.width = '0%';
        channelsBody.innerHTML = '';
        fileInput.value = '';
        fileNameDisplay.textContent = '';
        urlInput.value = '';
        searchInput.value = '';
        searchQuery = '';
        errorMsg.textContent = '';
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> MULAI SCAN';

        // Ensure progress icon is restored
        const progressIcon = document.querySelector('.stat-card i.fa-spinner');
        progressIcon.classList.add('fa-spin');
        progressIcon.style.color = 'var(--text-muted)';

        // Hide progress, show input
        progressSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        actionBar.classList.add('hidden');
        document.getElementById('input-section').classList.remove('hidden');
    });
});
