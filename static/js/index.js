/* ==========================================================================
   Template utilities kept for the SoGuDiff page.

   Trimmed from the upstream Academic Project Page Template:
     - the "More Works" lab dropdown was removed (it would break double-blind
       review), so its handlers are gone
     - jQuery, bulma-carousel and bulma-slider are no longer loaded, so their
       initialization is gone; the page uses CSS grid and sogudiff.js instead

   What remains is dependency-free.
   ========================================================================== */

// Copy BibTeX to clipboard
function copyBibTeX() {
    const bibtexElement = document.getElementById('bibtex-code');
    const button = document.querySelector('.copy-bibtex-btn');
    if (!bibtexElement || !button) return;

    const copyText = button.querySelector('.copy-text');

    function flash(label) {
        button.classList.add('copied');
        if (copyText) copyText.textContent = label;
        setTimeout(function () {
            button.classList.remove('copied');
            if (copyText) copyText.textContent = 'Copy';
        }, 2000);
    }

    function fallbackCopy() {
        const textArea = document.createElement('textarea');
        textArea.value = bibtexElement.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            flash('Copied');
        } catch (e) {
            flash('Press Ctrl+C');
        }
        document.body.removeChild(textArea);
    }

    // navigator.clipboard is undefined on pages served over plain http from a
    // non-localhost origin, so guard rather than assume it exists.
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(bibtexElement.textContent)
            .then(function () { flash('Copied'); })
            .catch(fallbackCopy);
    } else {
        fallbackCopy();
    }
}

// Scroll to top
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show/hide the scroll-to-top button
window.addEventListener('scroll', function () {
    const scrollButton = document.querySelector('.scroll-to-top');
    if (!scrollButton) return;
    scrollButton.classList.toggle('visible', window.pageYOffset > 300);
});
