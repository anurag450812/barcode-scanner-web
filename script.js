// Barcode Scanner Application with Google Barcode Detection API
let barcodeList = [];
let isScanning = false;
let isFlashOn = false;
let currentStream = null;
let html5QrCode = null;
let barcodeDetector = null;
let useNativeDetector = false;
let videoElement = null;
let animationId = null;
let currentGroup = null; // Track which group is currently being viewed
let refreshInterval = null;

// Load saved barcodes from Netlify Blobs on page load
window.addEventListener('DOMContentLoaded', () => {
    // Restore active tab from localStorage
    const savedTab = localStorage.getItem('activeTab') || 'scan';
    switchTab(savedTab);
    
    // Restore search term and current group
    const savedSearch = localStorage.getItem('searchTerm') || '';
    const savedGroup = localStorage.getItem('currentGroup') || '';
    
    if (savedSearch) {
        document.getElementById('search-input').value = savedSearch;
    }
    if (savedGroup) {
        currentGroup = savedGroup;
    }
    
    loadBarcodes();
    
    // Auto-refresh every 3 seconds to sync with cloud (but don't reload during search)
    refreshInterval = setInterval(() => {
        if (!isScanning && !document.getElementById('search-input').value.trim()) {
            loadBarcodes();
        }
    }, 3000);
    
    // Check if native Barcode Detection API is available
    if ('BarcodeDetector' in window) {
        useNativeDetector = true;
        console.log('Using native Barcode Detection API');
    } else {
        console.log('Using html5-qrcode library');
    }
});

// Initialize barcode scanner
async function initScanner() {
    document.getElementById('scanner-container').style.display = 'block';
    document.getElementById('loading-message').style.display = 'block';
    document.getElementById('scan-tip').style.display = 'none';
    document.getElementById('toggle-flash').style.display = 'none';
    
    // If already scanning, resume
    if (isScanning) {
        document.getElementById('loading-message').style.display = 'none';
        return;
    }
    
    if (useNativeDetector) {
        await initNativeScanner();
    } else {
        await initHtml5Scanner();
    }
}

// Initialize native Barcode Detection API
async function initNativeScanner() {
    try {
        // Create barcode detector with all 1D formats
        barcodeDetector = new BarcodeDetector({
            formats: ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e']
        });
        
        // Get back camera
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available cameras:', videoDevices);
        
        let backCamera = null;
        for (const device of videoDevices) {
            const label = device.label.toLowerCase();
            if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
                backCamera = device;
                break;
            }
        }
        
        if (!backCamera && videoDevices.length > 1) {
            backCamera = videoDevices[videoDevices.length - 1];
        } else if (!backCamera) {
            backCamera = videoDevices[0];
        }
        
        console.log('Selected camera:', backCamera.label);
        
        // Start video stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: backCamera.deviceId,
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'environment'
            }
        });
        
        currentStream = stream;
        
        // Create video element
        const container = document.getElementById('scanner-container');
        container.innerHTML = '<video id="scanner-video" playsinline autoplay></video>';
        videoElement = document.getElementById('scanner-video');
        videoElement.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });
        
        // Hide loading after video is ready
        setTimeout(() => {
            document.getElementById('loading-message').style.display = 'none';
            document.getElementById('scan-tip').style.display = 'block';
            document.getElementById('toggle-flash').style.display = 'inline-block';
        }, 500);
        
        isScanning = true;
        
        // Start scanning loop
        scanBarcode();
        
    } catch (err) {
        console.error('Error starting native scanner:', err);
        document.getElementById('loading-message').style.display = 'none';
        alert('Error starting camera: ' + err.message);
    }
}

// Continuous barcode scanning loop
async function scanBarcode() {
    if (!isScanning || !videoElement) return;
    
    try {
        const barcodes = await barcodeDetector.detect(videoElement);
        
        if (barcodes.length > 0) {
            const barcode = barcodes[0];
            const code = barcode.rawValue;
            
            // Validate barcode
            if (!code.includes('.') && code.length >= 3) {
                isScanning = false;
                handleBarcodeScan(code);
                return; // Stop scanning after detection
            }
        }
    } catch (err) {
        console.error('Detection error:', err);
    }
    
    // Continue scanning
    animationId = requestAnimationFrame(scanBarcode);
}

// Initialize html5-qrcode scanner (fallback)
async function initHtml5Scanner() {
    document.getElementById('scanner-container').style.display = 'block';
    document.getElementById('loading-message').style.display = 'block';
    document.getElementById('scan-tip').style.display = 'none';
    document.getElementById('toggle-flash').style.display = 'none';
    
    // If already scanning, resume
    if (html5QrCode && isScanning) {
        document.getElementById('loading-message').style.display = 'none';
        return;
    }
    
    // Stop existing instance if any
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.log('Stop error:', err);
        }
    }
    
    // Create new instance
    html5QrCode = new Html5Qrcode("scanner-container");
    
    try {
        // Get all available cameras
        const devices = await Html5Qrcode.getCameras();
        
        if (!devices || devices.length === 0) {
            alert('No camera found on this device');
            return;
        }
        
        console.log('Available cameras:', devices);
        
        // Show available cameras on screen
        let cameraInfo = 'Available cameras:\n';
        devices.forEach((d, i) => {
            cameraInfo += `${i + 1}. ${d.label}\n`;
        });
        
        // Find back camera by looking for the LAST camera (typically back camera on mobile)
        // or by checking labels
        let backCamera = null;
        
        // First try to find by label
        for (const device of devices) {
            const label = device.label.toLowerCase();
            console.log('Checking camera:', label);
            if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('facing back')) {
                backCamera = device;
                console.log('Found back camera by label:', device.label);
                break;
            }
        }
        
        // If not found by label, use the last camera (typically the back camera)
        if (!backCamera && devices.length > 1) {
            backCamera = devices[devices.length - 1];
            console.log('Using last camera as back camera:', backCamera.label);
        } else if (!backCamera) {
            backCamera = devices[0];
            console.log('Using first camera:', backCamera.label);
        }
        
        // Log selected camera (removed alert for faster startup)
        console.log('Selected camera:', backCamera.label);
        
        // Config optimized for fast scanning
        const config = {
            fps: 30,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                // Use 90% of available space for scanning
                return {
                    width: Math.floor(viewfinderWidth * 0.9),
                    height: Math.floor(viewfinderHeight * 0.9)
                };
            },
            aspectRatio: 1.777778,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.CODABAR,
                Html5QrcodeSupportedFormats.ITF
            ]
        };
        
        // Start with back camera ID
        console.log('Starting camera:', backCamera.id, backCamera.label);
        await html5QrCode.start(
            backCamera.id,
            config,
            onScanSuccess,
            onScanError
        );
        
        isScanning = true;
        
        // Wait for video stream to be fully ready before hiding loading
        setTimeout(() => {
            // Ensure video element is ready
            const video = document.querySelector('#scanner-container video');
            if (video && video.readyState >= 2) {
                // Video is ready
                document.getElementById('loading-message').style.display = 'none';
                document.getElementById('scan-tip').style.display = 'block';
                document.getElementById('toggle-flash').style.display = 'inline-block';
                getVideoStream();
            } else {
                // Wait a bit more and check again
                setTimeout(() => {
                    document.getElementById('loading-message').style.display = 'none';
                    document.getElementById('scan-tip').style.display = 'block';
                    document.getElementById('toggle-flash').style.display = 'inline-block';
                    getVideoStream();
                }, 1000);
            }
        }, 1500);
        
    } catch (err) {
        console.error('Error starting scanner:', err);
        document.getElementById('loading-message').style.display = 'none';
        alert('Error starting camera: ' + err.message);
    }
}

// Success callback for barcode scan
function onScanSuccess(decodedText, decodedResult) {
    if (!isScanning) return;
    
    // Validate barcode
    if (decodedText.includes('.') || decodedText.length < 3) {
        return;
    }
    
    // Stop scanning temporarily
    isScanning = false;
    
    // Handle the scanned barcode
    handleBarcodeScan(decodedText);
}

// Error callback (mostly just "not found" errors, which is normal)
function onScanError(errorMessage) {
    // Ignore "not found" errors as they're normal when no barcode is in view
    // Only log actual errors
    if (!errorMessage.includes('NotFoundException') && !errorMessage.includes('No MultiFormat Readers')) {
        console.log(`Scan error: ${errorMessage}`);
    }
}

// Handle detected barcode
function handleBarcodeScan(code) {
    if (!code) return;
    
    // Check if barcode already exists
    const exists = barcodeList.some(item => item.code === code);
    
    if (!exists) {
        // Play sound immediately for instant feedback
        playBeep();
        addBarcode(code);
        showNotification('✅ Barcode Saved! Click "Scan Next" to continue.', false);
    } else {
        // Play denial sound immediately
        playDenialSound();
        showNotification('❌ ALREADY SCANNED! This barcode is already in your list.', true);
    }
    
    // Update UI
    document.getElementById('start-scan').textContent = 'Scan Next';
}

// Resume scanning
function resumeScanning() {
    isScanning = true;
    document.getElementById('start-scan').textContent = 'Pause';
    
    if (useNativeDetector && videoElement) {
        scanBarcode(); // Restart scanning loop
    }
}

// Stop the scanner
async function stopScanner() {
    isScanning = false;
    
    // Stop native scanner
    if (useNativeDetector) {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        if (videoElement) {
            videoElement.srcObject = null;
            videoElement = null;
        }
        document.getElementById('scanner-container').innerHTML = '';
    }
    
    // Stop html5-qrcode scanner
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.error('Error stopping scanner:', err);
        }
        html5QrCode = null;
        isScanning = false;
        isFlashOn = false;
        currentStream = null;
        document.getElementById('scanner-container').style.display = 'none';
        document.getElementById('toggle-flash').style.display = 'none';
        document.getElementById('scan-tip').style.display = 'none';
    }
}

// Get video stream for flash control
function getVideoStream() {
    try {
        const video = document.querySelector('#scanner-container video');
        if (video && video.srcObject) {
            currentStream = video.srcObject;
        }
    } catch (err) {
        console.log('Could not get video stream:', err);
    }
}

// Toggle flashlight/torch
async function toggleFlash() {
    if (!currentStream) {
        getVideoStream();
        if (!currentStream) {
            showNotification('Flash not available on this device', true);
            return;
        }
    }
    
    try {
        const track = currentStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        
        if (!capabilities.torch) {
            showNotification('Flash not supported on this device', true);
            return;
        }
        
        isFlashOn = !isFlashOn;
        
        await track.applyConstraints({
            advanced: [{ torch: isFlashOn }]
        });
        
        const flashBtn = document.getElementById('toggle-flash');
        if (isFlashOn) {
            flashBtn.textContent = '🔦 Flash ON';
            flashBtn.classList.add('active');
        } else {
            flashBtn.textContent = '🔦 Flash OFF';
            flashBtn.classList.remove('active');
        }
    } catch (err) {
        console.error('Error toggling flash:', err);
        showNotification('Could not toggle flash', true);
    }
}

// Add barcode to list
function addBarcode(code) {
    const barcodeItem = {
        code: code,
        timestamp: new Date().toLocaleString()
    };
    
    barcodeList.unshift(barcodeItem); // Add to beginning of list
    saveBarcodes();
    updateDisplay();
}

// Delete individual barcode
function deleteBarcode(index) {
    const barcodeToDelete = barcodeList[index].code;
    
    if (confirm(`Are you sure you want to delete this barcode?\n\n${barcodeToDelete}`)) {
        barcodeList.splice(index, 1);
        saveBarcodes();
        updateDisplay();
    }
}

// Clear all barcodes
function clearAllBarcodes() {
    if (barcodeList.length === 0) {
        alert('List is already empty!');
        return;
    }
    
    if (confirm('Are you sure you want to clear all barcodes?')) {
        barcodeList = [];
        saveBarcodes();
        updateDisplay();
        document.getElementById('result-section').style.display = 'none';
    }
}

// Search for barcode
// Categorize barcode by prefix
function categorizeBarcode(code) {
    if (code.startsWith('FM')) return { name: 'Flipkart', order: 1 };
    if (code.startsWith('VL')) return { name: 'Valmo', order: 2 };
    if (code.startsWith('SF')) return { name: 'Shadowfax', order: 3 };
    if (code.startsWith('13')) return { name: 'XpressBees', order: 4 };
    if (code.startsWith('14')) return { name: 'Delhivery', order: 5 };
    if (code.startsWith('36')) return { name: 'Amazon', order: 6 };
    return { name: 'Others', order: 7 };
}

// Group barcodes by category
function groupBarcodes(barcodes) {
    const groups = {};
    
    barcodes.forEach((item, index) => {
        const category = categorizeBarcode(item.code);
        if (!groups[category.name]) {
            groups[category.name] = {
                items: [],
                order: category.order
            };
        }
        groups[category.name].items.push({ ...item, originalIndex: index });
    });
    
    // Sort groups by order
    return Object.entries(groups).sort((a, b) => a[1].order - b[1].order);
}

function searchBarcode() {
    const searchTerm = document.getElementById('search-input').value.trim();
    const listElement = document.getElementById('barcode-list');
    const emptyMessage = document.getElementById('empty-message');
    
    // Save search term to localStorage
    localStorage.setItem('searchTerm', searchTerm);
    
    if (!searchTerm) {
        // If no search term, show appropriate view (groups or group items)
        localStorage.removeItem('searchTerm');
        if (currentGroup) {
            showGroupItems(currentGroup, false);
        } else {
            updateDisplay(false);
        }
        return;
    }
    
    // Determine which barcodes to search in
    let barcodesToSearch = barcodeList;
    if (currentGroup) {
        // If inside a group, only search within that group
        barcodesToSearch = barcodeList.filter(item => {
            const category = categorizeBarcode(item.code);
            return category.name === currentGroup;
        });
    }
    
    // Filter barcodes that match search term
    const filteredBarcodes = barcodesToSearch.filter(item => 
        item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filteredBarcodes.length === 0) {
        listElement.innerHTML = '';
        emptyMessage.textContent = 'No barcodes found matching your search.';
        emptyMessage.style.display = 'block';
    } else {
        emptyMessage.style.display = 'none';
        listElement.innerHTML = '';
        
        // Show search results WITHOUT groups
        filteredBarcodes.forEach((item) => {
            const originalIndex = barcodeList.indexOf(item);
            const li = createBarcodeListItem(item, originalIndex);
            li.classList.add('highlight');
            listElement.appendChild(li);
        });
    }
}

// Create list item element
function createBarcodeListItem(item, index) {
    const li = document.createElement('li');
    
    // Checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'barcode-checkbox';
    checkbox.dataset.index = index;
    checkbox.onchange = () => handleCheckboxChange();
    
    // Barcode content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'barcode-content';
    contentDiv.innerHTML = `
        <span class="barcode-text">${item.code}</span>
        <span class="barcode-time">${item.timestamp}</span>
    `;
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = () => deleteBarcode(index);
    
    li.appendChild(checkbox);
    li.appendChild(contentDiv);
    li.appendChild(deleteBtn);
    
    return li;
}

// Handle checkbox changes
function handleCheckboxChange() {
    const checkboxes = document.querySelectorAll('.barcode-checkbox');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const deleteSelectedBtn = document.getElementById('delete-selected');
    
    // Show/hide delete selected button based on selection
    if (selectedCount > 0) {
        deleteSelectedBtn.style.display = 'inline-block';
        deleteSelectedBtn.textContent = `Delete Selected (${selectedCount})`;
    } else {
        deleteSelectedBtn.style.display = 'none';
    }
    
    // Update list item styling for selected items
    checkboxes.forEach(cb => {
        const li = cb.closest('li');
        if (cb.checked) {
            li.classList.add('selected');
        } else {
            li.classList.remove('selected');
        }
    });
}

// Delete selected barcodes
function deleteSelectedBarcodes() {
    const checkboxes = document.querySelectorAll('.barcode-checkbox:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    
    if (selectedIndices.length === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedIndices.length} selected barcode(s)?`)) {
        // Sort indices in descending order to avoid index shifting issues
        selectedIndices.sort((a, b) => b - a);
        
        selectedIndices.forEach(index => {
            barcodeList.splice(index, 1);
        });
        
        saveBarcodes();
        updateDisplay();
        document.getElementById('delete-selected').style.display = 'none';
    }
}

// Update display
function updateDisplay(clearSearch = true) {
    const listElement = document.getElementById('barcode-list');
    const emptyMessage = document.getElementById('empty-message');
    const countElement = document.getElementById('count');
    const listTitle = document.getElementById('list-title');
    const backButton = document.getElementById('back-to-groups');
    
    // Update count
    countElement.textContent = barcodeList.length;
    
    // Clear search input only if requested
    if (clearSearch) {
        document.getElementById('search-input').value = '';
        localStorage.removeItem('searchTerm');
    }
    
    // Reset to groups view
    currentGroup = null;
    localStorage.removeItem('currentGroup');
    backButton.style.display = 'none';
    listTitle.innerHTML = 'Scanned Barcodes (<span id="count">' + barcodeList.length + '</span>)';
    
    if (barcodeList.length === 0) {
        listElement.innerHTML = '';
        emptyMessage.style.display = 'block';
        emptyMessage.textContent = 'No barcodes scanned yet. Start scanning to add items!';
    } else {
        emptyMessage.style.display = 'none';
        listElement.innerHTML = '';
        
        // Group barcodes by category
        const groupedBarcodes = groupBarcodes(barcodeList);
        
        groupedBarcodes.forEach(([groupName, groupData]) => {
            // Create clickable group card
            const groupCard = document.createElement('li');
            groupCard.className = 'group-card';
            groupCard.innerHTML = `
                <div class="group-card-content">
                    <strong>${groupName} Group</strong>
                    <span class="group-count">${groupData.items.length} items</span>
                </div>
                <span class="group-arrow">→</span>
            `;
            groupCard.onclick = () => showGroupItems(groupName);
            listElement.appendChild(groupCard);
        });
    }
}

// Show items within a specific group
function showGroupItems(groupName, clearSearch = true) {
    const listElement = document.getElementById('barcode-list');
    const emptyMessage = document.getElementById('empty-message');
    const listTitle = document.getElementById('list-title');
    const backButton = document.getElementById('back-to-groups');
    
    currentGroup = groupName;
    localStorage.setItem('currentGroup', groupName);
    backButton.style.display = 'block';
    listTitle.textContent = `${groupName} Group`;
    
    // Clear search input only if requested
    if (clearSearch) {
        document.getElementById('search-input').value = '';
        localStorage.removeItem('searchTerm');
    }
    
    // Filter barcodes for this group
    const groupBarcodes = barcodeList.filter(item => {
        const category = categorizeBarcode(item.code);
        return category.name === groupName;
    });
    
    if (groupBarcodes.length === 0) {
        listElement.innerHTML = '';
        emptyMessage.style.display = 'block';
        emptyMessage.textContent = 'No barcodes in this group.';
    } else {
        emptyMessage.style.display = 'none';
        listElement.innerHTML = '';
        
        groupBarcodes.forEach((item) => {
            const originalIndex = barcodeList.indexOf(item);
            const li = createBarcodeListItem(item, originalIndex);
            listElement.appendChild(li);
        });
    }
}

// Save to Netlify Blobs
async function saveBarcodes() {
    try {
        await fetch('/api/barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(barcodeList)
        });
    } catch (err) {
        console.error('Error saving barcodes:', err);
    }
}

// Load from Netlify Blobs
async function loadBarcodes() {
    try {
        const response = await fetch('/api/barcodes');
        if (response.ok) {
            const data = await response.json();
            barcodeList = data || [];
            
            // Preserve current view when reloading
            const searchTerm = document.getElementById('search-input').value.trim();
            console.log('loadBarcodes - currentGroup:', currentGroup, 'searchTerm:', searchTerm);
            
            if (currentGroup) {
                showGroupItems(currentGroup, false);
            } else if (searchTerm) {
                searchBarcode();
            } else {
                updateDisplay(false);
            }
        }
    } catch (err) {
        console.error('Error loading barcodes:', err);
        barcodeList = [];
    }
}

// Play beep sound
function playBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        console.log('Audio not supported');
    }
}

// Play denial/error sound for duplicates
function playDenialSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Lower frequency for error sound
        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Audio not supported');
    }
}

// Show notification message
function showNotification(message, isError = false) {
    // Check if notification element exists, if not create it
    let notification = document.getElementById('scan-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'scan-notification';
        document.body.appendChild(notification);
    }
    
    // Set styling based on whether it's an error or success
    const backgroundColor = isError ? '#dc3545' : '#48bb78';
    const fontSize = isError ? '18px' : '16px';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${backgroundColor};
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: bold;
        display: block;
        max-width: 90%;
        text-align: center;
        font-size: ${fontSize};
        animation: slideDown 0.3s ease-out;
    `;
    
    notification.textContent = message;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Event Listeners
document.getElementById('start-scan').addEventListener('click', () => {
    const startBtn = document.getElementById('start-scan');
    
    if (startBtn.textContent === 'Scan Next') {
        // Resume scanning
        resumeScanning();
    } else {
        // Start new scan
        initScanner();
    }
});

document.getElementById('stop-scan').addEventListener('click', () => {
    stopScanner();
    document.getElementById('start-scan').textContent = 'Start Scan';
});

document.getElementById('toggle-flash').addEventListener('click', toggleFlash);

document.getElementById('clear-list').addEventListener('click', clearAllBarcodes);

document.getElementById('delete-selected').addEventListener('click', deleteSelectedBarcodes);

// Real-time search as user types
document.getElementById('search-input').addEventListener('input', searchBarcode);

// Refresh button to manually sync
document.getElementById('refresh-list').addEventListener('click', async () => {
    const refreshBtn = document.getElementById('refresh-list');
    refreshBtn.disabled = true;
    refreshBtn.textContent = '⏳';
    
    await loadBarcodes();
    
    setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄';
    }, 500);
});

// Back to groups button - reload the page
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'back-to-groups') {
        e.preventDefault();
        e.stopPropagation();
        console.log('Back button clicked - reloading page');
        localStorage.removeItem('currentGroup');
        localStorage.removeItem('searchTerm');
        localStorage.setItem('activeTab', 'list');
        window.location.reload();
    }
});

// Tab switching functionality
function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Save active tab to localStorage
    localStorage.setItem('activeTab', tabName);
    
    // Add active class to selected tab and content
    if (tabName === 'scan') {
        document.getElementById('tab-scan').classList.add('active');
        document.getElementById('scan-tab-content').classList.add('active');
    } else if (tabName === 'list') {
        document.getElementById('tab-list').classList.add('active');
        document.getElementById('list-tab-content').classList.add('active');
    }
}

// Add event listeners to tab buttons
document.getElementById('tab-scan').addEventListener('click', () => switchTab('scan'));
document.getElementById('tab-list').addEventListener('click', () => switchTab('list'));

// Initialize with scan tab active
switchTab('scan');

