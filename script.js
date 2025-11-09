// Barcode Scanner Application with html5-qrcode
let barcodeList = [];
let isScanning = false;
let isCameraOpen = false;
let isFlashOn = false;
let currentStream = null;
let html5QrCode = null;
let selectedCameraId = null;

// Load saved barcodes from localStorage on page load
window.addEventListener('DOMContentLoaded', () => {
    loadBarcodes();
    updateDisplay();
});

// Initialize html5-qrcode barcode scanner
async function initScanner() {
    // Show scanner container immediately for better UX
    document.getElementById('scanner-container').style.display = 'block';
    
    // If camera is already open, just resume scanning
    if (isCameraOpen) {
        isScanning = true;
        return;
    }
    
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
        } catch (err) {
            console.log('Stop error:', err);
        }
    }
    
    // Initialize Html5Qrcode instance
    html5QrCode = new Html5Qrcode("scanner-container");
    
    try {
        // Configuration for scanning
        const config = {
            fps: 30,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                return {
                    width: Math.floor(viewfinderWidth * 0.95),
                    height: Math.floor(viewfinderHeight * 0.85)
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
            ],
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        };
        
        // Start scanning with back camera using facingMode
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        );
        
        isScanning = true;
        isCameraOpen = true;
        
        // Show flash button, scan tip, and get video stream for flash control
        setTimeout(() => {
            document.getElementById('toggle-flash').style.display = 'inline-block';
            document.getElementById('scan-tip').style.display = 'block';
            getVideoStream();
        }, 1000);
        
    } catch (err) {
        console.error('Error starting scanner:', err);
        alert('Error starting camera: ' + err.message);
        stopScanner();
    }
}

// Success callback for barcode scan
function onScanSuccess(decodedText, decodedResult) {
    if (!isScanning) return;
    
    console.log(`Barcode detected: ${decodedText}`);
    
    // Validate barcode - reject if it contains periods (likely misread)
    if (decodedText.includes('.')) {
        console.log('Rejected barcode with period:', decodedText);
        return; // Skip this scan
    }
    
    // Validate barcode - reject if too short (likely partial read)
    if (decodedText.length < 3) {
        console.log('Rejected too short barcode:', decodedText);
        return; // Skip this scan
    }
    
    // Pause scanning (keep camera open)
    pauseScanning();
    
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
    if (!isScanning || !code) return;
    
    console.log('Barcode detected:', code);
    
    // PAUSE scanning (but keep camera open)
    pauseScanning();
    
    // Display last scanned result
    document.getElementById('last-result').textContent = code;
    document.getElementById('result-section').style.display = 'block';

    // Check if barcode already exists BEFORE adding
    const exists = barcodeList.some(item => item.code === code);
    
    if (!exists) {
        // New barcode - add it
        addBarcode(code);
        
        // Play success beep sound
        playBeep();
        
        // Show success notification
        showNotification('✅ Barcode Saved! Click "Scan Next" to continue.', false);
    } else {
        // Duplicate barcode
        playDenialSound();
        showNotification('❌ ALREADY SCANNED! This barcode is already in your list.', true);
    }
    
    // Update UI buttons
    document.getElementById('start-scan').textContent = 'Scan Next';
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
}

// Pause scanning (keep camera open)
function pauseScanning() {
    isScanning = false;
}

// Stop the scanner (close camera completely)
async function stopScanner() {
    if (html5QrCode && isCameraOpen) {
        try {
            await html5QrCode.stop();
            isScanning = false;
            isCameraOpen = false;
            isFlashOn = false;
            currentStream = null;
            document.getElementById('scanner-container').style.display = 'none';
            document.getElementById('toggle-flash').style.display = 'none';
            document.getElementById('scan-tip').style.display = 'none';
        } catch (err) {
            console.error('Error stopping scanner:', err);
            isScanning = false;
            isCameraOpen = false;
            isFlashOn = false;
            currentStream = null;
        }
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
function searchBarcode() {
    const searchTerm = document.getElementById('search-input').value.trim();
    
    if (!searchTerm) {
        updateDisplay(); // Show all if search is empty
        return;
    }
    
    const listElement = document.getElementById('barcode-list');
    const emptyMessage = document.getElementById('empty-message');
    
    // Filter barcodes that match search term
    const filteredBarcodes = barcodeList.filter(item => 
        item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filteredBarcodes.length === 0) {
        listElement.innerHTML = '';
        emptyMessage.textContent = 'No barcodes found matching your search.';
        emptyMessage.style.display = 'block';
    } else {
        emptyMessage.style.display = 'none';
        listElement.innerHTML = '';
        
        filteredBarcodes.forEach((item, index) => {
            const li = createBarcodeListItem(item, barcodeList.indexOf(item));
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
function updateDisplay() {
    const listElement = document.getElementById('barcode-list');
    const emptyMessage = document.getElementById('empty-message');
    const countElement = document.getElementById('count');
    
    // Update count
    countElement.textContent = barcodeList.length;
    
    // Clear search input
    document.getElementById('search-input').value = '';
    
    if (barcodeList.length === 0) {
        listElement.innerHTML = '';
        emptyMessage.style.display = 'block';
        emptyMessage.textContent = 'No barcodes scanned yet. Start scanning to add items!';
    } else {
        emptyMessage.style.display = 'none';
        listElement.innerHTML = '';
        
        barcodeList.forEach((item, index) => {
            const li = createBarcodeListItem(item, index);
            listElement.appendChild(li);
        });
    }
}

// Save to localStorage
function saveBarcodes() {
    localStorage.setItem('barcodeList', JSON.stringify(barcodeList));
}

// Load from localStorage
function loadBarcodes() {
    const saved = localStorage.getItem('barcodeList');
    if (saved) {
        barcodeList = JSON.parse(saved);
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
    // Disable button and show loading state immediately
    const startBtn = document.getElementById('start-scan');
    const stopBtn = document.getElementById('stop-scan');
    
    if (!isCameraOpen) {
        startBtn.disabled = true;
        startBtn.textContent = 'Starting...';
        
        // Small delay to allow UI update
        setTimeout(() => {
            initScanner();
            startBtn.disabled = false;
            startBtn.textContent = 'Scan Next';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
        }, 100);
    } else {
        // Camera already open, just resume scanning
        initScanner();
        startBtn.textContent = 'Scan Next';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
    }
});

document.getElementById('stop-scan').addEventListener('click', () => {
    stopScanner();
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
});

document.getElementById('toggle-flash').addEventListener('click', toggleFlash);

document.getElementById('clear-list').addEventListener('click', clearAllBarcodes);

document.getElementById('delete-selected').addEventListener('click', deleteSelectedBarcodes);

document.getElementById('search-btn').addEventListener('click', searchBarcode);

document.getElementById('search-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        searchBarcode();
    }
});

// Clear search and show all when search input is cleared
document.getElementById('search-input').addEventListener('input', (e) => {
    if (e.target.value === '') {
        updateDisplay();
    }
});
