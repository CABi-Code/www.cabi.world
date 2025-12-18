// Модуль чата с поддержкой редактирования и удаления

import { userProfile, userHash } from './profile.js';

let allMessages = [];
let currentPage = 0;
let loading = false;
let hasMore = true;
let lastTimestamp = 0;

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');

const editModal = document.getElementById('editModal');
const editInput = document.getElementById('editInput');
const editSave = document.getElementById('editSave');
const editCancel = document.getElementById('editCancel');

let editingMessageId = null;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function createMessageElement(msg) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    div.dataset.messageId = msg.id;
    
    const avatarLetter = (msg.name || 'А')[0].toUpperCase();
    const isOwn = msg.hash === userHash;
    
    let actionsHtml = '';
    if (isOwn) {
        actionsHtml = `
            <div class="message-actions">
                <button class="message-action-btn edit" data-action="edit" data-id="${msg.id}" title="Редактировать">✏️</button>
                <button class="message-action-btn delete" data-action="delete" data-id="${msg.id}" title="Удалить">🗑️</button>
            </div>
        `;
    }
    
    const editedLabel = msg.edited ? '<div class="chat-message-edited">(изменено)</div>' : '';
    
    div.innerHTML = `
        <div class="chat-message-avatar">${escapeHtml(avatarLetter)}</div>
        <div class="chat-message-content">
            <div class="chat-message-header">
                <span class="chat-message-name">${escapeHtml(msg.name)}</span>
                <span class="chat-message-time">${formatTime(msg.timestamp)}</span>
            </div>
            <div class="chat-message-text">${escapeHtml(msg.text)}</div>
            ${editedLabel}
        </div>
        ${actionsHtml}
    `;
    
    return div;
}

function renderAll() {
    chatMessages.innerHTML = '';
    if (allMessages.length === 0) {
        chatMessages.innerHTML = '<div class="chat-empty">Здесь пока нет сообщений. Будь первым! 🚀</div>';
        return;
    }
    const fragment = document.createDocumentFragment();
    allMessages.forEach(msg => fragment.appendChild(createMessageElement(msg)));
    chatMessages.appendChild(fragment);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendNewMessages(newMsgs) {
    if (newMsgs.length === 0) return;
    const fragment = document.createDocumentFragment();
    const shouldScroll = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 50;
    
    newMsgs.forEach(msg => {
        // Проверяем, не обновление ли это существующего сообщения
        const existingIndex = allMessages.findIndex(m => m.id === msg.id);
        if (existingIndex !== -1) {
            // Обновляем существующее
            allMessages[existingIndex] = msg;
            const existingEl = chatMessages.querySelector(`[data-message-id="${msg.id}"]`);
            if (existingEl) {
                existingEl.replaceWith(createMessageElement(msg));
            }
        } else {
            // Добавляем новое
            fragment.appendChild(createMessageElement(msg));
            allMessages.push(msg);
            lastTimestamp = Math.max(lastTimestamp, msg.timestamp);
        }
    });
    
    if (fragment.children.length > 0) {
        chatMessages.appendChild(fragment);
    }
    
    if (shouldScroll) chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadPage(page, prepend = false) {
    if (loading) return;
    loading = true;
    try {
        const res = await fetch(`/chat/api.php?page=${page}`);
        if (!res.ok) return;
        const data = await res.json();
        const pageMessages = data.messages.sort((a, b) => a.timestamp - b.timestamp);
        
        if (page === 1) {
            const newMsgs = pageMessages.filter(m => m.timestamp > lastTimestamp);
            if (currentPage < 1) {
                allMessages = pageMessages;
                lastTimestamp = Math.max(...pageMessages.map(m => m.timestamp), 0);
                renderAll();
            } else {
                appendNewMessages(newMsgs);
            }
        } else if (prepend) {
            const oldHeight = chatMessages.scrollHeight;
            allMessages = pageMessages.concat(allMessages);
            renderAll();
            chatMessages.scrollTop = chatMessages.scrollHeight - oldHeight;
        }
        currentPage = Math.max(currentPage, page);
        hasMore = data.messages.length === 20;
    } catch (e) {
        console.error('Ошибка загрузки сообщений:', e);
    } finally {
        loading = false;
    }
}

async function sendMessage() {
    if (!userProfile || !userProfile.name || !userHash) {
        alert('Профиль не загружен');
        return;
    }

    const text = chatInput.value.trim();
    if (!text) return;

    sendButton.disabled = true;

    try {
        const res = await fetch('/chat/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: userProfile.name,
                text: text,
                hash: userHash  // Отправляем hash для привязки
            })
        });

        if (res.ok) {
            const json = await res.json();
            if (json.success) {
                chatInput.value = '';
                appendNewMessages([json.message]);
                autoResizeTextarea();
            }
        } else {
            alert('Ошибка отправки');
        }
    } catch (e) {
        console.error('Ошибка:', e);
        alert('Не удалось отправить');
    } finally {
        sendButton.disabled = false;
    }
}

async function editMessage(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message || message.hash !== userHash) return;

    editingMessageId = messageId;
    editInput.value = message.text;
    editModal.style.display = 'flex';
    editInput.focus();
}

async function saveEdit() {
    if (!editingMessageId) return;

    const newText = editInput.value.trim();
    if (!newText || newText.length > 200) {
        alert('Сообщение должно быть от 1 до 200 символов');
        return;
    }

    try {
        const res = await fetch('/chat/api.php?action=edit_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: userHash,
                message_id: editingMessageId,
                text: newText
            })
        });

        if (res.ok) {
            const json = await res.json();
            if (json.success) {
                // Обновляем локально
                appendNewMessages([json.message]);
                editModal.style.display = 'none';
                editingMessageId = null;
            }
        } else {
            alert('Ошибка редактирования');
        }
    } catch (e) {
        console.error('Ошибка:', e);
        alert('Не удалось отредактировать');
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Удалить это сообщение?')) return;

    try {
        const res = await fetch('/chat/api.php?action=delete_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: userHash,
                message_id: messageId
            })
        });

        if (res.ok) {
            const json = await res.json();
            if (json.success) {
                // Удаляем локально
                allMessages = allMessages.filter(m => m.id !== messageId);
                const el = chatMessages.querySelector(`[data-message-id="${messageId}"]`);
                if (el) el.remove();
                
                if (allMessages.length === 0) {
                    chatMessages.innerHTML = '<div class="chat-empty">Здесь пока нет сообщений. Будь первым! 🚀</div>';
                }
            }
        } else {
            alert('Ошибка удаления');
        }
    } catch (e) {
        console.error('Ошибка:', e);
        alert('Не удалось удалить');
    }
}

function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
}

function activateChat() {
    // Загружаем первую страницу
    loadPage(1);

    // Обработчики отправки
    sendButton.addEventListener('click', sendMessage);
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatInput.addEventListener('input', autoResizeTextarea);

    // Прокрутка вверх - подгрузка старых
    chatMessages.addEventListener('scroll', () => {
        if (chatMessages.scrollTop < 200 && !loading && hasMore) {
            loadPage(currentPage + 1, true);
        }
    });

    // Обновление каждые 6 секунд
    setInterval(() => {
        if (!loading && currentPage >= 1) loadPage(1);
    }, 6000);

    // Делегирование для кнопок действий
    chatMessages.addEventListener('click', (e) => {
        const btn = e.target.closest('.message-action-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        const messageId = btn.dataset.id;

        if (action === 'edit') {
            editMessage(messageId);
        } else if (action === 'delete') {
            deleteMessage(messageId);
        }
    });

    // Модалка редактирования
    editSave.addEventListener('click', saveEdit);
    editCancel.addEventListener('click', () => {
        editModal.style.display = 'none';
        editingMessageId = null;
    });

    editInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        }
    });
}

export { activateChat, loadPage, appendNewMessages };