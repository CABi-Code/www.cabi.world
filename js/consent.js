// consent.js — логика согласия

const consentCheckbox = document.getElementById('consentCheckbox');
const consentBlock = document.getElementById('consentBlock');
const identifyButton = document.getElementById('identifyButton'); // кнопка идентификации

function updateIdentifyButton() {
    if (identifyButton) {
        identifyButton.disabled = !consentCheckbox.checked;
        // Делаем кнопку визуально активной/неактивной
        if (consentCheckbox.checked) {
            identifyButton.style.opacity = '1';
            identifyButton.style.pointerEvents = 'auto';
            identifyButton.style.cursor = 'pointer';
        } else {
            identifyButton.style.opacity = '0.5';
            identifyButton.style.pointerEvents = 'none';
            identifyButton.style.cursor = 'default';
        }
    }
}

consentCheckbox.addEventListener('change', () => {
    const consented = consentCheckbox.checked;
    localStorage.setItem('dataConsent', consented ? 'true' : 'false');
    updateIdentifyButton();
});

// При загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('dataConsent') === 'true') {
        consentCheckbox.checked = true;
    }
    updateIdentifyButton();
});

identifyButton.disabled = !consentCheckbox.checked;