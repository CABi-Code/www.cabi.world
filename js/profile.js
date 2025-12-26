// Модуль профиля пользователя

import { getFingerprint } from './fingerprint.js';
import { activateChat, updateMessagesName } from './chat.js';

let userProfile = null;
let userHash = null;

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

// Загрузка профиля с сервера по hash
async function loadProfileFromServer(hash) {
    console.log('Loading profile from server:', hash);
    
    try {
        const res = await fetch('/chat/api.php?action=get_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash: hash })
        });

        if (!res.ok) throw new Error('Server error: ' + res.status);

        const json = await res.json();
        console.log('Profile loaded:', json);
        
        if (json.success && json.profile) {
            return json.profile;
        }
        
        return null;
    } catch (err) {
        console.error('Error loading profile:', err);
        return null;
    }
}

// Начало процесса инициализации (вызывается после согласия)
async function startIdentification() {
    console.log('Starting identification...');
    
    if (!initModal || !initStatus) {
        console.error('Init modal elements not found');
        return;
    }
    
    initModal.style.display = 'flex';
    initStatus.textContent = 'Сбор данных устройства...';

    try {
        const fpData = await getFingerprint();
        userHash = fpData.hash;
        
        console.log('Fingerprint collected:', userHash);

        initStatus.textContent = 'Отправка на сервер...';

        // Отправляем ТОЛЬКО fingerprint, БЕЗ имени
        const res = await fetch('/chat/api.php?action=create_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: userHash,
                data: fpData
            })
        });

        if (!res.ok) throw new Error('Ошибка сервера: ' + res.status);

        const json = await res.json();
        console.log('Server response:', json);
        
        if (!json.success || !json.profile) throw new Error('Некорректный ответ');

        userProfile = json.profile;

        // Закрываем модалку инициализации
        initModal.style.display = 'none';

        // Открываем модалку ввода имени
        if (nameModal && nameInput) {
            nameModal.style.display = 'flex';
            nameInput.value = userProfile.name || '';
            nameInput.focus();
        }

    } catch (err) {
        console.error('Identification error:', err);
        initStatus.textContent = 'Ошибка: ' + err.message;
        setTimeout(() => {
            initModal.style.display = 'none';
        }, 2000);
    }
}

// Сохранение имени
async function saveName() {
    if (!nameInput) return;
    
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
            const oldName = userProfile.name;
            userProfile.name = newName;
            localStorage.setItem('profileHash', userHash);
            localStorage.setItem('chatUsername', newName);

            // Обновляем UI
            updateProfileUI();

            // Закрываем модалку
            if (nameModal) nameModal.style.display = 'none';

            // Обновляем имена в сообщениях чата
            if (oldName !== newName) {
                updateMessagesName(userHash, newName);
            }

            // Активируем чат (если ещё не активирован)
            activateChat();
        }
    } catch (e) {
        alert('Ошибка сохранения имени');
        console.error(e);
    }
}

// Обновление UI профиля
function updateProfileUI() {
    if (guestMode) guestMode.style.display = 'none';
    if (userMode) userMode.style.display = 'flex';
    
    if (profileAvatar) profileAvatar.textContent = userProfile.name[0].toUpperCase();
    if (profileNameEl) profileNameEl.textContent = userProfile.name;

    // Tooltip с fingerprint
    if (userProfile.fingerprint && fingerprintTooltip) {
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
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = 'Напиши сообщение...';
    }
    if (sendButton) sendButton.disabled = false;
}

// Инициализация модуля
async function initProfileModule() {
    console.log('Profile module initializing...');
    
    // Слушаем событие согласия
    document.addEventListener('consentGiven', () => {
        console.log('Consent given event received');
        startIdentification();
    });

    // Кнопка сохранения имени
    if (nameSaveBtn) {
        nameSaveBtn.addEventListener('click', saveName);
    }

    // Enter в поле имени
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveName();
        });
    }

    // Клик по имени - открытие модалки смены имени
    if (profileNameEl && nameModal && nameInput) {
        profileNameEl.addEventListener('click', () => {
            if (!userProfile) return;
            nameInput.value = userProfile.name || '';
            nameModal.style.display = 'flex';
            nameInput.focus();
        });
    }

    // Проверяем, есть ли сохранённый hash в localStorage
    const savedHash = localStorage.getItem('profileHash');

    if (savedHash) {
        console.log('Found saved hash, loading from server:', savedHash);
        
        // Сначала собираем fingerprint чтобы проверить совпадение
        const fpData = await getFingerprint();
        const currentHash = fpData.hash;
        
        console.log('Current hash:', currentHash);
        console.log('Saved hash:', savedHash);
        
        // Если hash совпадает - загружаем профиль с сервера
        if (currentHash === savedHash) {
            const profile = await loadProfileFromServer(savedHash);
            
            if (profile) {
                userHash = savedHash;
                userProfile = profile;
                updateProfileUI();
                activateChat();
                console.log('Profile restored from server');
            } else {
                console.log('Profile not found on server, clearing localStorage');
                localStorage.removeItem('profileHash');
                localStorage.removeItem('chatUsername');
            }
        } else {
            console.log('Hash mismatch, device changed. Clearing localStorage');
            localStorage.removeItem('profileHash');
            localStorage.removeItem('chatUsername');
        }
    }
}

// Ждём загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileModule);
} else {
    initProfileModule();
}

// Экспортируем для использования в других модулях
export { userProfile, userHash };