// Модуль согласия на обработку данных

console.log('Consent module loading...');

// Находим элементы
const consentModal = document.getElementById('consentModal');
const consentCheckbox = document.getElementById('consentCheckbox');
const consentConfirm = document.getElementById('consentConfirm');
const consentCancel = document.getElementById('consentCancel');
const initProfileBtn = document.getElementById('initProfileBtn');

// Проверяем что все элементы найдены
if (!consentModal) console.error('consentModal not found');
if (!consentCheckbox) console.error('consentCheckbox not found');
if (!consentConfirm) console.error('consentConfirm not found');
if (!consentCancel) console.error('consentCancel not found');
if (!initProfileBtn) console.error('initProfileBtn not found');

// Включение/отключение кнопки подтверждения при изменении чекбокса
if (consentCheckbox && consentConfirm) {
    consentCheckbox.addEventListener('change', () => {
        consentConfirm.disabled = !consentCheckbox.checked;
        console.log('Checkbox changed:', consentCheckbox.checked);
    });
}

// Открытие модалки при клике на кнопку "Создать профиль"
if (initProfileBtn && consentModal) {
    initProfileBtn.addEventListener('click', () => {
        console.log('Init profile button clicked');
        consentModal.style.display = 'flex';
        if (consentCheckbox) consentCheckbox.checked = false;
        if (consentConfirm) consentConfirm.disabled = true;
    });
}

// Кнопка "Отмена" - закрываем модалку
if (consentCancel && consentModal) {
    consentCancel.addEventListener('click', () => {
        console.log('Consent cancelled');
        consentModal.style.display = 'none';
    });
}

// Кнопка "Продолжить" - отправляем событие для profile.js
if (consentConfirm && consentModal) {
    consentConfirm.addEventListener('click', () => {
        console.log('Consent confirmed, dispatching event');
        consentModal.style.display = 'none';
        // Создаём кастомное событие
        document.dispatchEvent(new CustomEvent('consentGiven'));
    });
}

console.log('Consent module loaded');

// Экспортируем функцию для других модулей (если нужно)
export function showConsentModal() {
    if (consentModal) {
        consentModal.style.display = 'flex';
        if (consentCheckbox) consentCheckbox.checked = false;
        if (consentConfirm) consentConfirm.disabled = true;
    }
}