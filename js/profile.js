// Модуль профиля пользователя

import { getFingerprint } from './fingerprint.js';
import { activateChat } from './chat.js';

let userProfile = null;
let userHash = null;

const chatHeader = document.getElementById('chatHeader');
const guestMode = document.getElementById('guestMode');
const userMode = document.getElementById('userMode');
const profileAvatar = document.getElementById('profileAvatar');
const profileNameEl = document.getElementById('profileName');
const fingerprintTooltip = document.getElementById('fingerprintTooltip');

const initModal = document.getElementById('initModal');
const initStatus = document.getElementById('initStatus');
const nameModal = document.getElementById('nameModal');
const nameInput = document.getElementById('nameInput');
const nameSaveBtn = document.getElementById('nameSaveBtn');

const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Начало процесса инициализации (вызывается после согласия)
async function startIdentification() {
    initModal.style.display = 'flex';
    initStatus.textContent = 'Сбор данных устройства...';

    try {
        const fpData = await getFingerprint();
        userHash = fpData.hash;

        initStatus.textContent = 'Отправка на сервер...';

        // Отправляем ТОЛЬКО fingerprint, БЕЗ имени
        const res = await fetch('/chat/api.php?action=create_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: userHash,
                data: fpData  // Здесь НЕТ имени
            })
        });

        if (!res.ok) throw new Error('Ошибка сервера: ' + res.status);

        const json = await res.json();
        if (!json.success || !json.profile) throw new Error('Некорректный ответ');

        userProfile = json.profile;

        // Закрываем модалку инициализации
        initModal.style.display = 'none';

        // Открываем модалку ввода имени
        nameModal.style.display = 'flex';
        nameInput.value = userProfile.name || '';
        nameInput.focus();

    } catch (err) {
        initStatus.textContent = 'Ошибка: ' + err.message;
        console.error(err);
        setTimeout(() => {
            initModal.style.display = 'none';
        }, 2000);
    }
}

// Сохранение имени
async function saveName() {
    const newName = nameInput.value.trim();
    if (!newName || newName.length > 20) {
        alert('Имя должно быть от 1 до 20 символов');
        return;
    }

    try {
        const res = await fetch('/chat/api.php?action=update_name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash: userHash, name: newName })
        });

        if (!res.ok) throw new Error('Ошибка сервера');

        const json = await res.json();
        if (json.success) {
            userProfile.name = newName;
            localStorage.setItem('profileHash', userHash);
            localStorage.setItem('chatUsername', newName);

            // Обновляем UI
            updateProfileUI();

            // Закрываем модалку
            nameModal.style.display = 'none';

            // Активируем чат
            activateChat();
        }
    } catch (e) {
        alert('Ошибка сохранения имени');
        console.error(e);
    }
}

// Обновление UI профиля
function updateProfileUI() {
    guestMode.style.display = 'none';
    userMode.style.display = 'flex';
    
    profileAvatar.textContent = userProfile.name[0].toUpperCase();
    profileNameEl.textContent = userProfile.name;

    // Tooltip с fingerprint
    if (userProfile.fingerprint) {
        const list = Object.entries(userProfile.fingerprint)
            .filter(([k]) => k !== 'hash')
            .map(([k, v]) => {
                const val = String(v);
                return `<strong>${k}:</strong> ${escapeHtml(val.substring(0, 100))}${val.length > 100 ? '...' : ''}`;
            })
            .join('<br>');
        fingerprintTooltip.innerHTML = list || 'Нет данных';
    }

    // Разблокируем ввод
    chatInput.disabled = false;
    sendButton.disabled = false;
    chatInput.placeholder = 'Напиши сообщение...';
}

// Инициализация модуля
function initProfileModule() {
    // Слушаем событие согласия
    document.addEventListener('consentGiven', startIdentification);

    // Кнопка сохранения имени
    nameSaveBtn.addEventListener('click', saveName);

    // Enter в поле имени
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveName();
    });

    // Клик по имени - открытие модалки смены имени
    profileNameEl.addEventListener('click', () => {
        if (!userProfile) return;
        nameInput.value = userProfile.name || '';
        nameModal.style.display = 'flex';
        nameInput.focus();
    });

    // Проверяем, есть ли сохранённый профиль
    const savedHash = localStorage.getItem('profileHash');
    const savedName = localStorage.getItem('chatUsername');

    if (savedHash && savedName) {
        // Восстанавливаем профиль
        userHash = savedHash;
        userProfile = { name: savedName };
        updateProfileUI();
        activateChat();
    }
}

document.addEventListener('DOMContentLoaded', initProfileModule);

// Экспортируем для использования в других модулях
export { userProfile, userHash };