// State Management
let releaseNotes = [];
let filteredNotes = [];
let selectedNote = null;
let currentFilterType = 'all';
let searchQuery = '';

// Tweet Composer Preferences
let includeLink = true;
let includeHashtags = true;

// DOM Elements
const notesTimeline = document.getElementById('notes-timeline');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const syncStatus = document.getElementById('sync-status');
const pulseDot = document.querySelector('.pulse-dot');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const typeFiltersList = document.getElementById('type-filters-list');

// Composer DOM Elements
const composerSidebar = document.getElementById('composer-sidebar');
const composerIdleView = document.getElementById('composer-idle-view');
const composerActiveView = document.getElementById('composer-active-view');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCount = document.getElementById('char-count');
const charProgressCircle = document.getElementById('char-progress-circle');
const toggleUrlBtn = document.getElementById('toggle-url-btn');
const toggleHashtagsBtn = document.getElementById('toggle-hashtags-btn');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
const copyTextBtn = document.getElementById('copy-text-btn');
const closeComposerBtn = document.getElementById('close-composer-btn');
const contextNoteTitle = document.getElementById('context-note-title');
const contextNoteSnippet = document.getElementById('context-note-snippet');
const toastContainer = document.getElementById('toast-container');

// Progress Ring Configuration
const CIRCUMFERENCE = 2 * Math.PI * 12; // Radius is 12
charProgressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
charProgressCircle.style.strokeDashoffset = CIRCUMFERENCE;

/* ==========================================================================
   Initialization & API Integrations
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch of release notes
    fetchNotes(false);
    
    // Register Event Listeners
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Type filters event delegation
    typeFiltersList.addEventListener('click', handleFilterClick);
    
    // Composer settings toggles
    toggleUrlBtn.addEventListener('click', toggleUrlOption);
    toggleHashtagsBtn.addEventListener('click', toggleHashtagsOption);
    
    // Composer actions
    tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    tweetSubmitBtn.addEventListener('click', shareOnTwitter);
    copyTextBtn.addEventListener('click', copyTweetToClipboard);
    closeComposerBtn.addEventListener('click', closeComposer);
    
    // Keyboard listener (Escape closes composer)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeComposer();
        }
    });
});

/**
 * Fetches release notes from our Flask server.
 * @param {boolean} forceRefresh - If true, bypasses the server's cache.
 */
async function fetchNotes(forceRefresh = false) {
    setLoadingState(true);
    
    try {
        const url = `/api/notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success' || result.status === 'partial_success') {
            releaseNotes = result.data || [];
            
            // Set update timestamp
            const updateDate = new Date(result.last_updated * 1000);
            const timeString = updateDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            syncStatus.textContent = `Last synced: ${timeString}`;
            pulseDot.className = 'pulse-dot'; // Reset to standard success pulse
            
            if (result.status === 'partial_success') {
                showToast('Loaded offline notes (feed fetch failed)', 'error');
                syncStatus.textContent = 'Sync offline';
                pulseDot.className = 'pulse-dot error';
            }
            
            // Recalculate type counts
            updateTypeCounts();
            
            // Filter and render
            applyFiltersAndSearch();
            
            // If we have a selected note, make sure we update it or clear it if it doesn't exist anymore
            if (selectedNote) {
                const updatedSelectedNote = releaseNotes.find(n => n.id === selectedNote.id);
                if (updatedSelectedNote) {
                    selectedNote = updatedSelectedNote;
                    updateComposerDraft();
                } else {
                    deselectNote();
                }
            }
            
            if (forceRefresh) {
                showToast('Release notes successfully updated!', 'success');
            }
        } else {
            throw new Error(result.message || 'Unknown server error');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        syncStatus.textContent = 'Sync Failed';
        pulseDot.className = 'pulse-dot error';
        showToast('Failed to connect to notes server.', 'error');
        
        // Show empty timeline with error text if we have no existing notes loaded
        if (releaseNotes.length === 0) {
            renderEmptyState('Connection Error', 'Could not retrieve release notes. Please check if the Flask server is running.');
        }
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    if (isLoading) {
        refreshBtn.disabled = true;
        refreshBtn.querySelector('.icon-refresh').classList.add('spinning');
        
        // Show skeletons if no notes exist yet
        if (releaseNotes.length === 0) {
            notesTimeline.innerHTML = `
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
            `;
            notesTimeline.style.display = 'flex';
            emptyState.style.display = 'none';
        }
    } else {
        refreshBtn.disabled = false;
        refreshBtn.querySelector('.icon-refresh').classList.remove('spinning');
    }
}

/* ==========================================================================
   Data Processing & Filtering
   ========================================================================== */
function normalizeType(type) {
    const t = type.toLowerCase().trim();
    if (t.includes('feature')) return 'feature';
    if (t.includes('change')) return 'changed';
    if (t.includes('deprecat')) return 'deprecated';
    if (t.includes('fix') || t.includes('security')) return 'fixed';
    return 'general';
}

function updateTypeCounts() {
    const counts = { all: 0, feature: 0, changed: 0, deprecated: 0, fixed: 0, general: 0 };
    
    releaseNotes.forEach(note => {
        counts.all++;
        const norm = normalizeType(note.type);
        if (counts[norm] !== undefined) {
            counts[norm]++;
        } else {
            counts.general++;
        }
    });
    
    // Update badge numbers in filters UI
    Object.keys(counts).forEach(type => {
        const el = document.getElementById(`count-${type}`);
        if (el) el.textContent = counts[type];
    });
}

function handleFilterClick(e) {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    
    // Update active tab styling
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    currentFilterType = tab.dataset.type;
    applyFiltersAndSearch();
}

function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase().trim();
    
    if (searchQuery.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
    
    applyFiltersAndSearch();
}

function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    applyFiltersAndSearch();
}

function applyFiltersAndSearch() {
    filteredNotes = releaseNotes.filter(note => {
        // 1. Type Filter
        if (currentFilterType !== 'all') {
            const normType = normalizeType(note.type);
            if (normType !== currentFilterType) return false;
        }
        
        // 2. Search Query Filter
        if (searchQuery) {
            const matchesText = note.content_text.toLowerCase().includes(searchQuery);
            const matchesDate = note.date.toLowerCase().includes(searchQuery);
            const matchesType = note.type.toLowerCase().includes(searchQuery);
            return matchesText || matchesDate || matchesType;
        }
        
        return true;
    });
    
    renderNotesTimeline();
}

/* ==========================================================================
   UI Renderers
   ========================================================================== */
function renderNotesTimeline() {
    if (filteredNotes.length === 0) {
        notesTimeline.innerHTML = '';
        notesTimeline.style.display = 'none';
        
        if (searchQuery) {
            renderEmptyState('No search matches', `We couldn't find anything matching "${searchQuery}".`);
        } else {
            renderEmptyState('No updates in this category', `There are no release notes categorized under "${currentFilterType}".`);
        }
        return;
    }
    
    emptyState.style.display = 'none';
    notesTimeline.style.display = 'flex';
    
    // Construct HTML content
    notesTimeline.innerHTML = filteredNotes.map((note, index) => {
        const normType = normalizeType(note.type);
        const isSelected = selectedNote && selectedNote.id === note.id;
        
        // Stagger list animations in styling
        const animationDelay = Math.min(index * 0.05, 0.5);
        
        return `
            <article class="note-card type-${normType} ${isSelected ? 'selected' : ''}" 
                     data-id="${note.id}"
                     style="animation-delay: ${animationDelay}s"
                     onclick="handleCardClick('${note.id}', event)">
                
                <div class="card-selector">
                    <div class="checkbox-custom">
                        <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>

                <div class="card-header">
                    <span class="card-date">${note.date}</span>
                    <span class="type-tag">${note.type}</span>
                </div>

                <div class="card-body">
                    ${note.content_html}
                </div>

                <div class="card-footer">
                    <button class="card-action-btn btn-tweet-now" onclick="handleQuickTweet('${note.id}', event)">
                        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Select to Compose</span>
                    </button>
                    
                    <a class="card-action-btn" href="${note.link}" target="_blank" onclick="event.stopPropagation()">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        <span>Official Source</span>
                    </a>
                </div>
            </article>
        `;
    }).join('');
}

function renderEmptyState(title, text) {
    emptyState.querySelector('h3').textContent = title;
    emptyState.querySelector('p').textContent = text;
    emptyState.style.display = 'flex';
}

/* ==========================================================================
   Interaction & Card Actions
   ========================================================================== */
function handleCardClick(id, event) {
    // Avoid double triggering if child buttons are clicked
    if (event.target.closest('a') || event.target.closest('.btn-tweet-now')) {
        return;
    }
    
    toggleNoteSelection(id);
}

function handleQuickTweet(id, event) {
    event.stopPropagation();
    toggleNoteSelection(id, true);
}

function toggleNoteSelection(id, forceSelect = false) {
    const note = releaseNotes.find(n => n.id === id);
    if (!note) return;

    if (selectedNote && selectedNote.id === id && !forceSelect) {
        // Deselect
        deselectNote();
    } else {
        // Select
        selectedNote = note;
        
        // Update styling instantly in DOM
        document.querySelectorAll('.note-card').forEach(card => {
            if (card.dataset.id === id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        // Open Composer UI
        composerIdleView.style.display = 'none';
        composerActiveView.style.display = 'flex';
        composerSidebar.classList.add('open');
        
        updateComposerDraft();
    }
}

function deselectNote() {
    selectedNote = null;
    document.querySelectorAll('.note-card').forEach(card => card.classList.remove('selected'));
    
    // Reset Composer UI
    composerActiveView.style.display = 'none';
    composerIdleView.style.display = 'flex';
    
    // Close sidebar on mobile
    composerSidebar.classList.remove('open');
}

function closeComposer() {
    deselectNote();
}

/* ==========================================================================
   Tweet Composition & Formatting
   ========================================================================== */
function updateComposerDraft() {
    if (!selectedNote) return;
    
    // Pre-populate context snippet info
    contextNoteTitle.textContent = `${selectedNote.date} - ${selectedNote.type}`;
    
    let rawText = selectedNote.content_text.replace(/\s+/g, ' ').trim();
    
    // Cut off list items nicely if they have dashes/bullets
    rawText = rawText.replace(/\s*[•*]\s*/g, '; ').replace(/;\s*$/, '');
    
    // Build draft text
    // Max length is 280, leave space for hashtags and links
    let snippetLimit = 140; 
    let snippet = rawText;
    if (snippet.length > snippetLimit) {
        snippet = snippet.substring(0, snippetLimit - 3).trim() + '...';
    }
    
    let defaultText = `BigQuery ${selectedNote.type} (${selectedNote.date}): ${snippet}`;
    
    if (includeLink) {
        defaultText += `\n\n🔗 ${selectedNote.link}`;
    }
    
    if (includeHashtags) {
        defaultText += `\n\n#BigQuery #GCP #Cloud`;
    }
    
    tweetTextarea.value = defaultText;
    contextNoteSnippet.textContent = rawText;
    
    updateCharacterCount();
}

function handleTweetTextareaInput() {
    updateCharacterCount();
}

function updateCharacterCount() {
    const text = tweetTextarea.value;
    const limit = 280;
    const currentLength = text.length;
    const remaining = limit - currentLength;
    
    charCount.textContent = remaining;
    
    // Update active color class
    if (remaining < 0) {
        charCount.className = 'char-count danger';
        tweetSubmitBtn.disabled = true;
    } else if (remaining <= 20) {
        charCount.className = 'char-count warning';
        tweetSubmitBtn.disabled = false;
    } else {
        charCount.className = 'char-count';
        tweetSubmitBtn.disabled = false;
    }
    
    // Animate character ring
    const percent = Math.min((currentLength / limit) * 100, 100);
    const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
    charProgressCircle.style.strokeDashoffset = offset;
    
    if (remaining < 0) {
        charProgressCircle.style.stroke = 'var(--color-deprecated)';
    } else if (remaining <= 20) {
        charProgressCircle.style.stroke = 'var(--color-changed)';
    } else {
        charProgressCircle.style.stroke = 'var(--color-fixed)';
    }
}

function toggleUrlOption() {
    includeLink = !includeLink;
    toggleUrlBtn.classList.toggle('active', includeLink);
    updateComposerDraft();
}

function toggleHashtagsOption() {
    includeHashtags = !includeHashtags;
    toggleHashtagsBtn.classList.toggle('active', includeHashtags);
    updateComposerDraft();
}

/* ==========================================================================
   Composer Actions
   ========================================================================== */
function shareOnTwitter() {
    const text = tweetTextarea.value;
    if (text.length > 280) {
        showToast('Draft exceeds X character limits (280 characters)', 'error');
        return;
    }
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank', 'width=550,height=420');
    showToast('Redirected to X Tweet Intent', 'success');
}

async function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    
    try {
        await navigator.clipboard.writeText(text);
        showToast('Tweet draft copied to clipboard!', 'success');
    } catch (err) {
        console.error('Copy failed:', err);
        // Fallback for older browsers or permission block
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; // Avoid scrolling to bottom
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('Tweet draft copied to clipboard!', 'success');
        } catch (copyErr) {
            showToast('Clipboard copy failed. Please select and copy manually.', 'error');
        }
        document.body.removeChild(textarea);
    }
}

/* ==========================================================================
   Utility Helpers
   ========================================================================== */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        `;
    } else {
        iconSvg = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        `;
    }
    
    toast.innerHTML = `
        ${iconSvg}
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Automatically remove after animation finishes (3 seconds)
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
