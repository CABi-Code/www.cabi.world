// Универсальные UI функции

// Закрытие модалок по клику на overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });
});