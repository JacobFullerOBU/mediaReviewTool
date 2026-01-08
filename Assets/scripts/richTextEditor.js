/**
 * Rich Text Editor Module for Media Reviews
 * Provides consistent rich text editing capabilities across all media types
 */

let quillEditor = null;
let editorContainer = null;

/**
 * Load Quill.js library
 * @returns {Promise} Promise that resolves when Quill is loaded
 */
export function loadQuillJS() {
    return new Promise((resolve, reject) => {
        if (window.Quill) {
            resolve();
            return;
        }
        
        // Load Quill CSS
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
        document.head.appendChild(css);
        
        // Load Quill JS
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Initialize rich text editor
 * @param {string} containerId - ID of the container element for the editor
 * @param {Object} options - Configuration options for the editor
 * @returns {Promise<Object>} Promise that resolves to the Quill editor instance
 */
export async function initializeRichTextEditor(containerId, options = {}) {
    try {
        await loadQuillJS();
        
        const defaultOptions = {
            height: '150px',
            placeholder: 'Write your review here... You can use formatting like bold, italics, lists, and links.',
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link'],
                ['clean'] // remove formatting button
            ]
        };
        
        const config = { ...defaultOptions, ...options };
        
        // Create editor container if it doesn't exist
        editorContainer = document.getElementById(containerId);
        if (!editorContainer) {
            throw new Error(`Container with ID '${containerId}' not found`);
        }
        
        // Set the height
        editorContainer.style.height = config.height;
        editorContainer.style.background = 'white';
        editorContainer.style.border = '1px solid #ccc';
        editorContainer.style.borderRadius = '4px';
        
        quillEditor = new Quill(`#${containerId}`, {
            theme: 'snow',
            placeholder: config.placeholder,
            modules: {
                toolbar: config.toolbar
            }
        });
        
        // Style the editor to match the theme
        const qlContainer = document.querySelector(`#${containerId} .ql-container`);
        const qlToolbar = document.querySelector(`#${containerId} .ql-toolbar`);
        
        if (qlContainer) {
            qlContainer.style.borderColor = '#ccc';
            qlContainer.style.fontSize = '14px';
        }
        
        if (qlToolbar) {
            qlToolbar.style.borderColor = '#ccc';
            qlToolbar.style.borderTopLeftRadius = '4px';
            qlToolbar.style.borderTopRightRadius = '4px';
        }
        
        return quillEditor;
        
    } catch (error) {
        console.warn('Failed to load rich text editor, falling back to textarea');
        // Fallback to textarea if Quill fails to load
        editorContainer.outerHTML = `
            <textarea id="${containerId}Fallback" rows="4" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;" placeholder="${options.placeholder || 'Write your review...'}"></textarea>
        `;
        return null;
    }
}

/**
 * Get HTML content from the editor
 * @returns {string} HTML content
 */
export function getEditorHTMLContent() {
    if (quillEditor) {
        return quillEditor.root.innerHTML;
    }
    // Fallback for textarea
    const fallbackElement = document.querySelector('[id$="Fallback"]');
    if (fallbackElement) {
        return fallbackElement.value.replace(/\n/g, '<br>');
    }
    return '';
}

/**
 * Get plain text content from the editor
 * @returns {string} Plain text content
 */
export function getEditorTextContent() {
    if (quillEditor) {
        return quillEditor.getText().trim();
    }
    // Fallback for textarea
    const fallbackElement = document.querySelector('[id$="Fallback"]');
    if (fallbackElement) {
        return fallbackElement.value.trim();
    }
    return '';
}

/**
 * Clear the editor content
 */
export function clearEditor() {
    if (quillEditor) {
        quillEditor.setText('');
    } else {
        // Fallback for textarea
        const fallbackElement = document.querySelector('[id$="Fallback"]');
        if (fallbackElement) {
            fallbackElement.value = '';
        }
    }
}

/**
 * Destroy the editor instance
 */
export function destroyEditor() {
    if (quillEditor) {
        quillEditor = null;
    }
    editorContainer = null;
}

/**
 * Create review form HTML with rich text editor
 * @param {Object} options - Configuration options
 * @returns {string} HTML string for the review form
 */
export function createReviewFormHTML(options = {}) {
    const {
        editorId = 'reviewEditor',
        ratingSelectId = 'reviewRating',
        formId = 'reviewForm',
        showRating = true,
        minRating = 1,
        maxRating = 5,
        defaultRating = 5
    } = options;
    
    const ratingOptions = [];
    for (let i = minRating; i <= maxRating; i++) {
        const stars = '⭐'.repeat(i);
        const selected = i === defaultRating ? ' selected' : '';
        ratingOptions.push(`<option value="${i}"${selected}>${i} ${stars}</option>`);
    }
    
    const ratingSection = showRating ? `
        <div style="display:flex; align-items:center; gap:10px; margin-top:12px;">
            <label style="font-weight:bold;">Rating:</label>
            <select id="${ratingSelectId}" style="padding:5px; border:1px solid #ccc; border-radius:4px;">
                ${ratingOptions.join('')}
            </select>
        </div>
    ` : '';
    
    return `
        <form id="${formId}" style="margin-top:12px;">
            <label style="display:block; margin-bottom:8px; font-weight:bold;">Write your review:</label>
            <div id="${editorId}" style="height:150px; background:white; border:1px solid #ccc; border-radius:4px;"></div>
            ${ratingSection}
            <button type="submit" class="btn btn-primary" style="margin-top:8px;">Submit Review</button>
        </form>
    `;
}

/**
 * Simple HTML sanitizer to allow basic formatting while preventing XSS
 * @param {string} html - HTML content to sanitize
 * @returns {string} Sanitized HTML content
 */
export function sanitizeHTML(html) {
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'a'];
    const allowedAttributes = {
        'a': ['href', 'target']
    };
    
    if (typeof html !== 'string') {
        return String(html);
    }
    
    // If it looks like plain text (no HTML tags), return as is but escape any HTML
    if (!html.includes('<')) {
        return html.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#x27;')
                  .replace(/\n/g, '<br>');
    }
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    function sanitizeNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            if (allowedTags.includes(tagName)) {
                let result = `<${tagName}`;
                
                // Add allowed attributes
                if (allowedAttributes[tagName]) {
                    for (const attr of allowedAttributes[tagName]) {
                        const value = node.getAttribute(attr);
                        if (value) {
                            // Sanitize URLs for links
                            if (attr === 'href' && !value.match(/^https?:\/\/|^mailto:|^\//)) {
                                continue; // Skip unsafe links
                            }
                            result += ` ${attr}="${value.replace(/"/g, '&quot;')}"`;
                        }
                    }
                }
                
                result += '>';
                
                // Process child nodes
                for (const child of node.childNodes) {
                    result += sanitizeNode(child);
                }
                
                result += `</${tagName}>`;
                return result;
            } else {
                // For disallowed tags, just return the text content
                let result = '';
                for (const child of node.childNodes) {
                    result += sanitizeNode(child);
                }
                return result;
            }
        }
        
        return '';
    }
    
    let result = '';
    for (const child of tempDiv.childNodes) {
        result += sanitizeNode(child);
    }
    
    return result || html.replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#x27;');
}

/**
 * Format review data for display
 * @param {Object} review - Review object
 * @returns {string} HTML string for the formatted review
 */
export function formatReviewForDisplay(review) {
    let content = '';
    let rating = null;
    let user = 'Anonymous';
    let timestamp = '';
    
    if (typeof review === 'string') {
        content = review;
    } else if (review && (review.text || review.review)) {
        content = review.text || review.review;
        rating = review.rating || null;
        user = review.user || 'Anonymous';
        if (review.timestamp) {
            try {
                timestamp = new Date(review.timestamp).toLocaleDateString();
            } catch (e) {
                timestamp = '';
            }
        }
    }
    
    // Sanitize HTML content to prevent XSS while allowing basic formatting
    const sanitizedContent = sanitizeHTML(content);
    
    // Create rating display
    let ratingDisplay = '';
    if (rating && rating >= 1 && rating <= 5) {
        const stars = '⭐'.repeat(rating);
        ratingDisplay = `<div style="margin-bottom:4px; font-size:14px;">${stars} (${rating}/5)</div>`;
    }
    
    // Create timestamp display
    const timeDisplay = timestamp ? `<span style="color:#999; font-size:12px;"> • ${timestamp}</span>` : '';
    
    return `
        <div class="review" style="background:#f7f7f7; color:#222; border-radius:8px; padding:12px; margin-bottom:12px; border-left:3px solid #007bff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="color:#333;">${user}</strong>
                ${timeDisplay}
            </div>
            ${ratingDisplay}
            <div style="line-height:1.5;">${sanitizedContent}</div>
        </div>
    `;
}