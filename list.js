// Barcode List Management
let barcodeList = [];
let currentGroup = null;
let refreshInterval = null;

// Load saved barcodes from Netlify Blobs on page load
window.addEventListener('DOMContentLoaded', () => {
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
        if (!document.getElementById('search-input').value.trim()) {
            loadBarcodes();
        }
    }, 3000);
});

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


// Event Listeners
document.getElementById('clear-list').addEventListener('click', clearAllBarcodes);
document.getElementById('delete-selected').addEventListener('click', deleteSelectedBarcodes);
document.getElementById('search-input').addEventListener('input', searchBarcode);

// Back to groups button - reload the page
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'back-to-groups') {
        e.preventDefault();
        e.stopPropagation();
        console.log('Back button clicked - reloading page');
        localStorage.removeItem('currentGroup');
        localStorage.removeItem('searchTerm');
        window.location.reload();
    }
});
