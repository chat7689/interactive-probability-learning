// Shared utilities for School Rainbet
class RainbetUtils {
    static currentUser = '';
    static isCurrentUserAdmin = false;

    // Data management functions
    static async initializeData() {
        try {
            // Initialize Firebase settings if they don't exist
            const settingsRef = window.firebaseRef(window.firebaseDb, 'settings');
            const settingsSnapshot = await window.firebaseGet(settingsRef);
            if (!settingsSnapshot.exists()) {
                await window.firebaseSet(settingsRef, {
                    activationCode: 'code',
                    chatName: 'School Rainbet'
                });
            }
        } catch (error) {
            console.error('Error initializing Firebase data:', error);
            // Fallback to localStorage if Firebase fails
            this.initializeLocalData();
        }
    }

    static initializeLocalData() {
        if (!localStorage.getItem('chat_accounts')) {
            localStorage.setItem('chat_accounts', JSON.stringify({}));
        }
        if (!localStorage.getItem('chat_messages')) {
            localStorage.setItem('chat_messages', JSON.stringify([]));
        }
        if (!localStorage.getItem('chat_userdata')) {
            localStorage.setItem('chat_userdata', JSON.stringify({}));
        }
        if (!localStorage.getItem('chat_settings')) {
            localStorage.setItem('chat_settings', JSON.stringify({
                activationCode: 'code',
                chatName: 'School Rainbet'
            }));
        }
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static showMessage(text, isError = false, elementId = 'message') {
        const messageDiv = document.getElementById(elementId);
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = isError ? 'error' : 'success';
        }
    }

    static clearMessage(elementId = 'message') {
        const messageDiv = document.getElementById(elementId);
        if (messageDiv) {
            messageDiv.textContent = '';
        }
    }

    // User management
    static getCurrentUser() {
        if (!this.currentUser) {
            this.currentUser = sessionStorage.getItem('rainbet_current_user') || '';
            this.isCurrentUserAdmin = sessionStorage.getItem('rainbet_is_admin') === 'true';
        }
        return this.currentUser;
    }

    static setCurrentUser(username, isAdmin = false) {
        this.currentUser = username;
        this.isCurrentUserAdmin = isAdmin;
        sessionStorage.setItem('rainbet_current_user', username);
        sessionStorage.setItem('rainbet_is_admin', isAdmin.toString());
    }

    static logout() {
        this.currentUser = '';
        this.isCurrentUserAdmin = false;
        sessionStorage.removeItem('rainbet_current_user');
        sessionStorage.removeItem('rainbet_is_admin');
        window.location.href = 'index.html';
    }

    // Points management
    static async getUserPoints(username = null) {
        const user = username || this.getCurrentUser();
        try {
            const userRef = window.firebaseRef(window.firebaseDb, `users/${user}`);
            const snapshot = await window.firebaseGet(userRef);
            if (snapshot.exists()) {
                const userData = snapshot.val();
                return userData.points || 0;
            }
            return 0;
        } catch (error) {
            console.error('Error getting user points:', error);
            // Fallback to localStorage
            const userdata = JSON.parse(localStorage.getItem('chat_userdata') || '{}');
            return userdata[user] ? userdata[user].points || 0 : 0;
        }
    }

    static async deductPoints(amount, username = null) {
        const user = username || this.getCurrentUser();
        try {
            const userRef = window.firebaseRef(window.firebaseDb, `users/${user}`);
            const snapshot = await window.firebaseGet(userRef);
            
            if (!snapshot.exists()) {
                return false;
            }
            
            const userData = snapshot.val();
            if (!userData || userData.points < amount) {
                return false;
            }
            
            userData.points -= amount;
            await window.firebaseSet(userRef, userData);
            return true;
        } catch (error) {
            console.error('Error deducting points:', error);
            // Fallback to localStorage
            const userdata = JSON.parse(localStorage.getItem('chat_userdata') || '{}');
            const userData = userdata[user];
            
            if (!userData || userData.points < amount) {
                return false;
            }
            
            userData.points -= amount;
            userdata[user] = userData;
            localStorage.setItem('chat_userdata', JSON.stringify(userdata));
            return true;
        }
    }

    static async awardPoints(amount, username = null) {
        const user = username || this.getCurrentUser();
        try {
            const userRef = window.firebaseRef(window.firebaseDb, `users/${user}`);
            const snapshot = await window.firebaseGet(userRef);
            
            let userData;
            if (snapshot.exists()) {
                userData = snapshot.val();
            } else {
                userData = { points: 0, items: {}, lastDaily: 0 };
            }
            
            userData.points = (userData.points || 0) + amount;
            await window.firebaseSet(userRef, userData);
        } catch (error) {
            console.error('Error awarding points:', error);
            // Fallback to localStorage
            const userdata = JSON.parse(localStorage.getItem('chat_userdata') || '{}');
            const userData = userdata[user] || { points: 0, items: {}, lastDaily: 0 };
            userData.points += amount;
            userdata[user] = userData;
            localStorage.setItem('chat_userdata', JSON.stringify(userdata));
        }
    }

    // Navigation functions
    static navigateTo(page) {
        // Store current scroll position
        sessionStorage.setItem('rainbet_scroll_pos', window.pageYOffset.toString());
        
        // Add loading overlay
        this.showLoadingOverlay();
        
        // Navigate after short delay for smooth transition
        setTimeout(() => {
            window.location.href = page;
        }, 150);
    }

    static showLoadingOverlay() {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(44, 62, 80, 0.9);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                font-size: 18px;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            overlay.innerHTML = '<div>Loading...</div>';
            document.body.appendChild(overlay);
        }
        
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
    }

    static hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }

    // Message management
    static async addSystemMessage(text) {
        try {
            const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
            await window.firebasePush(messagesRef, {
                username: 'System',
                message: text,
                timestamp: window.firebaseServerTimestamp(),
                isSystem: true
            });
        } catch (error) {
            console.error('Error adding system message:', error);
            // Fallback to localStorage
            const messages = JSON.parse(localStorage.getItem('chat_messages') || '[]');
            messages.push({
                username: 'System',
                message: text,
                timestamp: Date.now(),
                isSystem: true
            });
            if (messages.length > 50) {
                messages.splice(0, messages.length - 50);
            }
            localStorage.setItem('chat_messages', JSON.stringify(messages));
        }
    }

    static async addUserSystemMessage(text, targetUser = null) {
        if (!targetUser) {
            targetUser = this.getCurrentUser();
        }
        
        try {
            const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
            await window.firebasePush(messagesRef, {
                username: 'System',
                message: text,
                timestamp: window.firebaseServerTimestamp(),
                isSystem: true,
                targetUser: targetUser
            });
        } catch (error) {
            console.error('Error adding user system message:', error);
            // Fallback to localStorage
            const messages = JSON.parse(localStorage.getItem('chat_messages') || '[]');
            messages.push({
                username: 'System',
                message: text,
                timestamp: Date.now(),
                isSystem: true,
                targetUser: targetUser
            });
            if (messages.length > 50) {
                messages.splice(0, messages.length - 50);
            }
            localStorage.setItem('chat_messages', JSON.stringify(messages));
        }
    }

    // User authentication
    static isAuthenticated() {
        return !!this.getCurrentUser();
    }

    static requireAuth() {
        if (!this.isAuthenticated()) {
            this.navigateTo('index.html');
            return false;
        }
        return true;
    }

    // Settings
    static async getChatSettings() {
        try {
            const settingsRef = window.firebaseRef(window.firebaseDb, 'settings');
            const snapshot = await window.firebaseGet(settingsRef);
            if (snapshot.exists()) {
                return snapshot.val();
            }
            return { activationCode: 'code', chatName: 'School Rainbet' };
        } catch (error) {
            console.error('Error getting chat settings:', error);
            // Fallback to localStorage
            return JSON.parse(localStorage.getItem('chat_settings') || '{"activationCode":"code","chatName":"School Rainbet"}');
        }
    }

    static async updateChatSettings(newSettings) {
        try {
            const settingsRef = window.firebaseRef(window.firebaseDb, 'settings');
            const snapshot = await window.firebaseGet(settingsRef);
            let settings = {};
            
            if (snapshot.exists()) {
                settings = snapshot.val();
            }
            
            Object.assign(settings, newSettings);
            await window.firebaseSet(settingsRef, settings);
        } catch (error) {
            console.error('Error updating chat settings:', error);
            // Fallback to localStorage
            const settings = JSON.parse(localStorage.getItem('chat_settings') || '{}');
            Object.assign(settings, newSettings);
            localStorage.setItem('chat_settings', JSON.stringify(settings));
        }
    }

    // Page initialization
    static initPage() {
        this.initializeData();
        this.hideLoadingOverlay();
        
        // Restore scroll position if available
        const scrollPos = sessionStorage.getItem('rainbet_scroll_pos');
        if (scrollPos) {
            window.scrollTo(0, parseInt(scrollPos));
            sessionStorage.removeItem('rainbet_scroll_pos');
        }
    }

    // User items and shop functionality
    static async getUserItems(username = null) {
        const user = username || this.getCurrentUser();
        try {
            const userRef = window.firebaseRef(window.firebaseDb, `users/${user}`);
            const snapshot = await window.firebaseGet(userRef);
            if (snapshot.exists()) {
                const userData = snapshot.val();
                return userData.items || {};
            }
            return {};
        } catch (error) {
            console.error('Error getting user items:', error);
            // Fallback to localStorage
            const userdata = JSON.parse(localStorage.getItem('chat_userdata') || '{}');
            return userdata[user] ? userdata[user].items || {} : {};
        }
    }

    static async hasActiveItem(itemId, duration, username = null) {
        const items = await this.getUserItems(username);
        if (!items[itemId]) return false;
        
        const now = Date.now();
        return items[itemId] > (now - duration);
    }

    static async purchaseItem(itemId, price, username = null) {
        const user = username || this.getCurrentUser();
        if (!(await this.deductPoints(price, user))) {
            return false;
        }
        
        try {
            const userRef = window.firebaseRef(window.firebaseDb, `users/${user}`);
            const snapshot = await window.firebaseGet(userRef);
            let userData = { points: 0, items: {}, lastDaily: 0 };
            
            if (snapshot.exists()) {
                userData = snapshot.val();
            }
            
            userData.items[itemId] = Date.now();
            await window.firebaseSet(userRef, userData);
            
            await this.addSystemMessage(`${user} bought an item from the shop!`);
            return true;
        } catch (error) {
            console.error('Error purchasing item:', error);
            // Fallback to localStorage
            const userdata = JSON.parse(localStorage.getItem('chat_userdata') || '{}');
            const userData = userdata[user];
            userData.items[itemId] = Date.now();
            userdata[user] = userData;
            localStorage.setItem('chat_userdata', JSON.stringify(userdata));
            
            await this.addSystemMessage(`${user} bought an item from the shop!`);
            return true;
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    RainbetUtils.initPage();
});