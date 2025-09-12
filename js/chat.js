// Main chat functionality
let pendingAdminAction = null;
let messageListener = null;
let onlineUsersListener = null;

// Navigation functions
function navigateToGames() {
    if (!RainbetUtils.isAuthenticated()) {
        RainbetUtils.addSystemMessage('You must be logged in to access games');
        return;
    }
    RainbetUtils.navigateTo('games.html');
}

function navigateToShop() {
    if (!RainbetUtils.isAuthenticated()) {
        RainbetUtils.addSystemMessage('You must be logged in to access the shop');
        return;
    }
    RainbetUtils.navigateTo('shop.html');
}

// Authentication functions
function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelector('.tab:first-child').classList.add('active');
        document.getElementById('loginTab').classList.add('active');
    } else {
        document.querySelector('.tab:last-child').classList.add('active');
        document.getElementById('registerTab').classList.add('active');
    }
    RainbetUtils.clearMessage();
}

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const confirm = document.getElementById('regConfirm').value.trim();
    const activationCode = document.getElementById('regActivationCode').value.trim();
    
    if (!username || !password || !confirm || !activationCode) {
        RainbetUtils.showMessage('Please fill in all fields', true);
        return;
    }
    
    if (username.length < 3) {
        RainbetUtils.showMessage('Username must be at least 3 characters', true);
        return;
    }
    
    // Check for emojis in username
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(username)) {
        RainbetUtils.showMessage('Username cannot contain emojis', true);
        return;
    }
    
    if (password.length < 4) {
        RainbetUtils.showMessage('Password must be at least 4 characters', true);
        return;
    }
    
    if (password !== confirm) {
        RainbetUtils.showMessage('Passwords do not match', true);
        return;
    }

    try {
        const settings = await RainbetUtils.getChatSettings();
        if (activationCode !== settings.activationCode) {
            RainbetUtils.showMessage('Invalid activation code', true);
            return;
        }
        
        // Check if account already exists in Firebase
        const accountRef = window.firebaseRef(window.firebaseDb, `accounts/${username}`);
        const accountSnapshot = await window.firebaseGet(accountRef);
        
        if (accountSnapshot.exists()) {
            RainbetUtils.showMessage('Username already taken', true);
            return;
        }
        
        // Create account in Firebase
        await window.firebaseSet(accountRef, {
            password: password,
            created: Date.now(),
            isAdmin: false
        });
        
        // Initialize user data with points
        const userRef = window.firebaseRef(window.firebaseDb, `users/${username}`);
        await window.firebaseSet(userRef, {
            points: 100,
            items: {},
            lastDaily: 0
        });
        
        RainbetUtils.showMessage('Account created! You can now login.');
        document.getElementById('regUsername').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirm').value = '';
        document.getElementById('regActivationCode').value = '';
        document.getElementById('loginUsername').value = username;
        switchTab('login');
    } catch (error) {
        console.error('Registration error:', error);
        RainbetUtils.showMessage('Error creating account. Please try again.', true);
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!username || !password) {
        RainbetUtils.showMessage('Please enter username and password', true);
        return;
    }
    
    try {
        const accountRef = window.firebaseRef(window.firebaseDb, `accounts/${username}`);
        const accountSnapshot = await window.firebaseGet(accountRef);
        
        if (!accountSnapshot.exists()) {
            RainbetUtils.showMessage('Username not found', true);
            return;
        }
        
        const accountData = accountSnapshot.val();
        if (accountData.password !== password) {
            RainbetUtils.showMessage('Wrong password', true);
            return;
        }
        
        RainbetUtils.setCurrentUser(username, accountData.isAdmin || false);
        await enterChat();
        
        // Set user as online
        const onlineRef = window.firebaseRef(window.firebaseDb, `online/${username}`);
        await window.firebaseSet(onlineRef, {
            lastSeen: window.firebaseServerTimestamp(),
            status: 'online'
        });
        
        // Remove user from online list when they disconnect
        const onDisconnectRef = window.firebaseOnDisconnect(onlineRef);
        onDisconnectRef.remove();
        
    } catch (error) {
        console.error('Login error:', error);
        RainbetUtils.showMessage('Error logging in. Please try again.', true);
    }
}

async function enterChat() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('chatMain').style.display = 'block';
    document.getElementById('settingsButton').style.display = 'flex';
    document.getElementById('shopButton').style.display = 'flex';
    document.getElementById('gamesButton').style.display = 'flex';
    document.getElementById('leaderboard').style.display = 'block';
    
    // Update chat title
    const settings = await RainbetUtils.getChatSettings();
    document.getElementById('chatTitle').textContent = settings.chatName;
    
    // Setup real-time message listener
    setupMessageListener();
    
    // Setup online users listener
    setupOnlineUsersListener();
    
    await displayMessages();
    await updateLeaderboard();
    
    document.getElementById('messageInput').focus();
    
    // Update leaderboard every 30 seconds
    setInterval(async () => {
        await updateLeaderboard();
    }, 30000);
}

// Real-time message listener
function setupMessageListener() {
    if (messageListener) {
        window.firebaseOff(window.firebaseRef(window.firebaseDb, 'messages'), 'value', messageListener);
    }
    
    const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
    messageListener = window.firebaseOnValue(messagesRef, (snapshot) => {
        displayMessages();
    });
}

// Online users listener
function setupOnlineUsersListener() {
    if (onlineUsersListener) {
        window.firebaseOff(window.firebaseRef(window.firebaseDb, 'online'), 'value', onlineUsersListener);
    }
    
    const onlineRef = window.firebaseRef(window.firebaseDb, 'online');
    onlineUsersListener = window.firebaseOnValue(onlineRef, (snapshot) => {
        updateOnlineCount(snapshot);
    });
}

function updateOnlineCount(snapshot) {
    const onlineCountDiv = document.getElementById('onlineCount');
    if (snapshot.exists()) {
        const onlineUsers = snapshot.val();
        const count = Object.keys(onlineUsers).length;
        onlineCountDiv.textContent = `${count} user${count !== 1 ? 's' : ''} online`;
    } else {
        onlineCountDiv.textContent = '0 users online';
    }
}

// Message functions
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (!message) return;
    
    const currentUser = RainbetUtils.getCurrentUser();
    if (await isUserTimedOut(currentUser)) {
        const userRef = window.firebaseRef(window.firebaseDb, `users/${currentUser}`);
        const snapshot = await window.firebaseGet(userRef);
        if (snapshot.exists()) {
            const user = snapshot.val();
            const minutesLeft = Math.ceil((user.timeoutUntil - Date.now()) / (1000 * 60));
            await RainbetUtils.addSystemMessage(`You are timed out for ${minutesLeft} more minutes`);
        }
        messageInput.value = '';
        return;
    }
    
    if (message === '/admin') {
        requestAdminStatus();
        messageInput.value = '';
        return;
    }
    
    if (message === '/adminpanel') {
        if (!RainbetUtils.isCurrentUserAdmin) {
            RainbetUtils.addSystemMessage('You must be admin to use /adminpanel command');
        } else {
            openAdmin();
        }
        messageInput.value = '';
        return;
    }
    
    if (message === '/help') {
        const helpText = `
🤖 Available Commands:
• /help - Show this help message
• /shop - Go to the shop
• /games - Go to the games page
• /give <username> <amount> - Give points to another user
• /admin - Request admin status (if available)
• /adminpanel - Open admin panel (admin only)

📖 Game Types Available:
• 🪙 Coin Flip - Guess heads or tails
• 🥤 Find the Gold - Follow the golden coin
• 🎲 Lucky Dice - Predict the dice sum
• 🎰 Fruit Slots - Match three symbols
• 🃏 Blackjack - Beat the dealer
• 🎫 Number Lottery - Pick lucky numbers
• 💣 Mines - Avoid the bombs

💰 Shop Features:
• Text Effects: Large text, bold text, highlights
• Visual Effects: Glow effects, electric borders
• VIP Badge: Premium status symbol
• Tier System: Buy tier 1, then upgrade to 2 and 3
• Extend: Prolong item duration for 75% of max price
        `.trim();
        await RainbetUtils.addSystemMessage(helpText);
        messageInput.value = '';
        return;
    }
    
    if (message.startsWith('/give ')) {
        const parts = message.split(' ');
        if (parts.length !== 3) {
            RainbetUtils.addSystemMessage('Usage: /give <username> <amount>');
            messageInput.value = '';
            return;
        }
        
        const targetUsername = parts[1];
        const amount = parseInt(parts[2]);
        
        if (isNaN(amount) || amount <= 0) {
            RainbetUtils.addSystemMessage('Invalid amount. Please enter a positive number.');
            messageInput.value = '';
            return;
        }
        
        const currentUser = RainbetUtils.getCurrentUser();
        const userPoints = RainbetUtils.getUserPoints();
        
        if (amount > userPoints) {
            RainbetUtils.addSystemMessage(`You only have ${userPoints} points. Cannot give ${amount} points.`);
            messageInput.value = '';
            return;
        }
        
        // Check if target user exists
        const targetUserRef = window.firebaseRef(window.firebaseDb, `users/${targetUsername}`);
        const targetSnapshot = await window.firebaseGet(targetUserRef);
        if (!targetSnapshot.exists()) {
            await RainbetUtils.addSystemMessage(`User "${targetUsername}" not found.`);
            messageInput.value = '';
            return;
        }
        
        // Deduct from current user
        if (!(await RainbetUtils.deductPoints(amount))) {
            await RainbetUtils.addSystemMessage('Failed to deduct points.');
            messageInput.value = '';
            return;
        }
        
        // Give to target user
        await RainbetUtils.awardPoints(amount, targetUsername);
        
        // Add system message
        await RainbetUtils.addSystemMessage(`${currentUser} gave ${amount} points to ${targetUsername}!`);
        await updateLeaderboard();
        
        messageInput.value = '';
        return;
    }
    
    if (message === '/shop') {
        navigateToShop();
        messageInput.value = '';
        return;
    }
    
    if (message === '/games') {
        navigateToGames();
        messageInput.value = '';
        return;
    }
    
    // Send message to Firebase
    try {
        const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
        await window.firebasePush(messagesRef, {
            username: RainbetUtils.getCurrentUser(),
            message: message,
            timestamp: window.firebaseServerTimestamp()
        });
        
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        // Fallback to localStorage
        const messages = JSON.parse(localStorage.getItem('chat_messages') || '[]');
        messages.push({
            username: RainbetUtils.getCurrentUser(),
            message: message,
            timestamp: Date.now()
        });
        
        if (messages.length > 50) {
            messages.splice(0, messages.length - 50);
        }
        localStorage.setItem('chat_messages', JSON.stringify(messages));
        
        messageInput.value = '';
        await displayMessages();
    }
}

async function displayMessages() {
    const messagesDiv = document.getElementById('messages');
    const wasAtBottom = messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 1;
    messagesDiv.innerHTML = '';
    
    try {
        const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
        const snapshot = await window.firebaseGet(messagesRef);
        const currentUser = RainbetUtils.getCurrentUser();
        
        if (snapshot.exists()) {
            const messagesData = snapshot.val();
            const messages = Object.values(messagesData).sort((a, b) => {
                const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : a.timestamp || 0;
                const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : b.timestamp || 0;
                return timeA - timeB;
            });
            
            // Keep only last 50 messages for display
            const recentMessages = messages.slice(-50);
            
            for (const msg of recentMessages) {
                // Skip messages targeted to other users
                if (msg.targetUser && msg.targetUser !== currentUser) {
                    continue;
                }
                
                const messageDiv = document.createElement('div');
                let className = 'message';
                if (msg.username === currentUser) className += ' own';
                if (msg.isSystem) className += ' system';
                messageDiv.className = className;
                
                // Apply user's purchased styles
                if (msg.username !== 'System') {
                    const userRef = window.firebaseRef(window.firebaseDb, `users/${msg.username}`);
                    const userSnapshot = await window.firebaseGet(userRef);
                    if (userSnapshot.exists()) {
                        const userData = userSnapshot.val();
                        if (userData && userData.items) {
                            applyMessageStyles(messageDiv, userData.items);
                        }
                    }
                }
                
                let usernameDisplay = msg.username;
                if (msg.username !== 'System') {
                    const userRef = window.firebaseRef(window.firebaseDb, `users/${msg.username}`);
                    const userSnapshot = await window.firebaseGet(userRef);
                    if (userSnapshot.exists()) {
                        const userData = userSnapshot.val();
                        if (userData && userData.items) {
                            usernameDisplay = getUserDisplayName(msg.username, userData.items);
                        }
                    }
                }
                
                messageDiv.innerHTML = `<div class="message-user">${RainbetUtils.escapeHtml(usernameDisplay)}</div>` +
                                     `<div>${RainbetUtils.escapeHtml(msg.message)}</div>`;
                messagesDiv.appendChild(messageDiv);
            }
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        // Fallback to localStorage
        const messages = JSON.parse(localStorage.getItem('chat_messages') || '[]');
        const currentUser = RainbetUtils.getCurrentUser();
        
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            let className = 'message';
            if (msg.username === currentUser) className += ' own';
            if (msg.isSystem) className += ' system';
            messageDiv.className = className;
            
            let usernameDisplay = msg.username;
            messageDiv.innerHTML = `<div class="message-user">${RainbetUtils.escapeHtml(usernameDisplay)}</div>` +
                                 `<div>${RainbetUtils.escapeHtml(msg.message)}</div>`;
            messagesDiv.appendChild(messageDiv);
        });
    }
    
    if (wasAtBottom) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function applyMessageStyles(messageDiv, items) {
    const now = Date.now();
    
    // Check each item and apply styles if still active
    if (items.rainbow_text && items.rainbow_text > now - (60 * 60 * 1000)) {
        messageDiv.style.background = 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffc107)';
        messageDiv.style.color = 'white';
    }
    if (items.bold_text && items.bold_text > now - (2 * 60 * 60 * 1000)) {
        messageDiv.style.fontWeight = 'bold';
    }
    if (items.large_text && items.large_text > now - (60 * 60 * 1000)) {
        messageDiv.style.fontSize = '16px';
    }
    if (items.xlarge_text && items.xlarge_text > now - (60 * 60 * 1000)) {
        messageDiv.style.fontSize = '20px';
    }
    if (items.glow_effect && items.glow_effect > now - (30 * 60 * 1000)) {
        messageDiv.style.boxShadow = '0 0 15px rgba(52, 152, 219, 0.8)';
    }
    if (items.dark_theme && items.dark_theme > now - (3 * 60 * 60 * 1000)) {
        messageDiv.style.background = '#2c3e50';
        messageDiv.style.color = 'white';
    }
    if (items.italic_text && items.italic_text > now - (2 * 60 * 60 * 1000)) {
        messageDiv.style.fontStyle = 'italic';
    }
    if (items.border_effect && items.border_effect > now - (60 * 60 * 1000)) {
        messageDiv.style.border = '3px solid #e74c3c';
    }
    if (items.fire_text && items.fire_text > now - (45 * 60 * 1000)) {
        messageDiv.style.background = 'linear-gradient(45deg, #ff4500, #ff8500)';
        messageDiv.style.color = 'white';
    }
    if (items.ice_text && items.ice_text > now - (45 * 60 * 1000)) {
        messageDiv.style.background = 'linear-gradient(45deg, #87ceeb, #b0e0e6)';
        messageDiv.style.color = '#2c3e50';
    }
    if (items.electric_border && items.electric_border > now - (30 * 60 * 1000)) {
        messageDiv.style.border = '2px solid #ffff00';
        messageDiv.style.boxShadow = '0 0 10px #ffff00, inset 0 0 10px #ffff00';
        messageDiv.style.animation = 'pulse 2s infinite';
    }
    if (items.ghost_mode && items.ghost_mode > now - (2 * 60 * 60 * 1000)) {
        messageDiv.style.opacity = '0.6';
    }
    if (items.color_shift && items.color_shift > now - (45 * 60 * 1000)) {
        messageDiv.style.animation = 'colorShift 3s infinite';
    }
    if (items.wave_effect && items.wave_effect > now - (25 * 60 * 1000)) {
        messageDiv.style.animation = 'wave 2s ease-in-out infinite';
    }
}

function getUserDisplayName(username, items) {
    const now = Date.now();
    
    if (items.vip_badge && items.vip_badge > (now - (24 * 60 * 60 * 1000))) {
        return '👑 ' + username;
    } else if (items.winner_badge && items.winner_badge > (now - (12 * 60 * 60 * 1000))) {
        return '🏆 ' + username;
    } else if (items.theater_mask && items.theater_mask > (now - (8 * 60 * 60 * 1000))) {
        return '🎭 ' + username;
    }
    
    return username;
}

async function updateLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';
    
    try {
        const usersRef = window.firebaseRef(window.firebaseDb, 'users');
        const snapshot = await window.firebaseGet(usersRef);
        const userArray = [];
        
        if (snapshot.exists()) {
            const userdata = snapshot.val();
            for (const username in userdata) {
                const user = userdata[username];
                userArray.push({ username: username, points: user.points || 0 });
            }
        }
        
        userArray.sort((a, b) => b.points - a.points);
        
        const currentUser = RainbetUtils.getCurrentUser();
        userArray.forEach((user, index) => {
            const leaderDiv = document.createElement('div');
            leaderDiv.className = 'leader-item';
            if (user.username === currentUser) {
                leaderDiv.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
                leaderDiv.style.fontWeight = 'bold';
            }
            
            let trophy = '';
            if (index === 0) trophy = '🥇 ';
            else if (index === 1) trophy = '🥈 ';
            else if (index === 2) trophy = '🥉 ';
            else trophy = (index + 1) + '. ';
            
            leaderDiv.innerHTML = `<div class="leader-name">${trophy}${RainbetUtils.escapeHtml(user.username)}</div>` +
                                `<div class="leader-points">${user.points}</div>`;
            leaderboardList.appendChild(leaderDiv);
        });
        
        if (userArray.length === 0) {
            leaderboardList.innerHTML = 'No users yet';
        }
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        leaderboardList.innerHTML = 'Error loading leaderboard';
    }
}

// Settings functions
function openSettings() {
    document.getElementById('settingsModal').style.display = 'block';
    document.getElementById('currentUsername').value = RainbetUtils.getCurrentUser();
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
    RainbetUtils.clearMessage('settingsMessage');
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmNewPassword').value.trim();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        RainbetUtils.showMessage('Please fill in all fields', true, 'settingsMessage');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        RainbetUtils.showMessage('New passwords do not match', true, 'settingsMessage');
        return;
    }
    
    if (newPassword.length < 4) {
        RainbetUtils.showMessage('New password must be at least 4 characters', true, 'settingsMessage');
        return;
    }
    
    try {
        const currentUser = RainbetUtils.getCurrentUser();
        const accountRef = window.firebaseRef(window.firebaseDb, `accounts/${currentUser}`);
        const snapshot = await window.firebaseGet(accountRef);
        
        if (!snapshot.exists()) {
            RainbetUtils.showMessage('Account not found', true, 'settingsMessage');
            return;
        }
        
        const accountData = snapshot.val();
        if (accountData.password !== currentPassword) {
            RainbetUtils.showMessage('Current password is incorrect', true, 'settingsMessage');
            return;
        }
        
        accountData.password = newPassword;
        await window.firebaseSet(accountRef, accountData);
        
        RainbetUtils.showMessage('Password changed successfully!', false, 'settingsMessage');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
    } catch (error) {
        console.error('Error changing password:', error);
        RainbetUtils.showMessage('Error changing password', true, 'settingsMessage');
    }
}

// Admin functions
function requestAdminStatus() {
    pendingAdminAction = 'requestAdmin';
    document.getElementById('adminPasswordModal').style.display = 'block';
}

async function confirmAdminAction() {
    const password = document.getElementById('adminPasswordInput').value.trim();
    const errorDiv = document.getElementById('adminPasswordError');
    
    if (password !== '76897689') {
        errorDiv.textContent = 'Incorrect security code';
        return;
    }
    
    if (pendingAdminAction === 'requestAdmin') {
        try {
            const currentUser = RainbetUtils.getCurrentUser();
            const accountRef = window.firebaseRef(window.firebaseDb, `accounts/${currentUser}`);
            const snapshot = await window.firebaseGet(accountRef);
            
            if (snapshot.exists()) {
                const accountData = snapshot.val();
                accountData.isAdmin = true;
                await window.firebaseSet(accountRef, accountData);
                
                RainbetUtils.isCurrentUserAdmin = true;
                sessionStorage.setItem('rainbet_is_admin', 'true');
                
                await RainbetUtils.addSystemMessage(currentUser + ' is now an admin!');
            }
        } catch (error) {
            console.error('Error making user admin:', error);
        }
    }
    
    cancelAdminAction();
}

function cancelAdminAction() {
    document.getElementById('adminPasswordModal').style.display = 'none';
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminPasswordError').textContent = '';
    pendingAdminAction = null;
}

function openAdmin() {
    document.getElementById('adminModal').style.display = 'block';
    loadUserPointsList();
    loadOnlineUsersList();
}

function closeAdmin() {
    document.getElementById('adminModal').style.display = 'none';
}

async function updateChatName() {
    const newName = document.getElementById('chatNameInput').value.trim();
    if (!newName) {
        alert('Please enter a chat name');
        return;
    }
    
    await RainbetUtils.updateChatSettings({ chatName: newName });
    document.getElementById('chatTitle').textContent = newName;
    await RainbetUtils.addSystemMessage(`Chat name changed to: ${newName}`);
    alert('Chat name updated!');
}

async function givePointsToUser() {
    const targetUsername = document.getElementById('targetUsername').value.trim();
    const pointAmount = parseInt(document.getElementById('pointAmount').value);
    
    if (!targetUsername || !pointAmount) {
        alert('Please enter username and amount');
        return;
    }
    
    try {
        const userRef = window.firebaseRef(window.firebaseDb, `users/${targetUsername}`);
        const snapshot = await window.firebaseGet(userRef);
        
        if (!snapshot.exists()) {
            alert('User not found');
            return;
        }
        
        await RainbetUtils.awardPoints(pointAmount, targetUsername);
        await RainbetUtils.addSystemMessage(`Admin gave ${pointAmount} points to ${targetUsername}`);
        await updateLeaderboard();
        await loadUserPointsList();
        alert('Points awarded!');
    } catch (error) {
        console.error('Error giving points:', error);
        alert('Error giving points');
    }
}

async function givePointsToAll() {
    try {
        const usersRef = window.firebaseRef(window.firebaseDb, 'users');
        const snapshot = await window.firebaseGet(usersRef);
        
        if (snapshot.exists()) {
            const userdata = snapshot.val();
            for (const username in userdata) {
                await RainbetUtils.awardPoints(100, username);
            }
        }
        
        await RainbetUtils.addSystemMessage('Admin gave 100 points to all users!');
        await updateLeaderboard();
        await loadUserPointsList();
        alert('Points given to all users!');
    } catch (error) {
        console.error('Error giving points to all:', error);
        alert('Error giving points to all users');
    }
}

async function clearAllMessages() {
    if (!confirm('Are you sure you want to clear all messages?')) return;
    
    try {
        const messagesRef = window.firebaseRef(window.firebaseDb, 'messages');
        await window.firebaseSet(messagesRef, null);
        alert('All messages cleared!');
    } catch (error) {
        console.error('Error clearing messages:', error);
        alert('Error clearing messages');
    }
}

async function resetAllDailyCredits() {
    if (!confirm('Are you sure you want to reset all daily credits?')) return;
    
    try {
        const usersRef = window.firebaseRef(window.firebaseDb, 'users');
        const snapshot = await window.firebaseGet(usersRef);
        
        if (snapshot.exists()) {
            const userdata = snapshot.val();
            for (const username in userdata) {
                userdata[username].lastDaily = 0;
            }
            await window.firebaseSet(usersRef, userdata);
        }
        
        await RainbetUtils.addSystemMessage('Admin reset all daily credits');
        alert('Daily credits reset for all users!');
    } catch (error) {
        console.error('Error resetting daily credits:', error);
        alert('Error resetting daily credits');
    }
}

async function loadUserPointsList() {
    const userPointsList = document.getElementById('userPointsList');
    userPointsList.innerHTML = '';
    
    try {
        const usersRef = window.firebaseRef(window.firebaseDb, 'users');
        const snapshot = await window.firebaseGet(usersRef);
        
        if (snapshot.exists()) {
            const userdata = snapshot.val();
            for (const username in userdata) {
                const user = userdata[username];
                const isTimedOut = user.timeoutUntil && user.timeoutUntil > Date.now();
                const timeoutText = isTimedOut ? ` (⏱️ ${Math.ceil((user.timeoutUntil - Date.now()) / (1000 * 60))}min)` : '';
                
                const userDiv = document.createElement('div');
                userDiv.style.cssText = 'padding: 8px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between;';
                userDiv.innerHTML = `<strong style="${isTimedOut ? 'color: #e74c3c;' : ''}">${RainbetUtils.escapeHtml(username)}${timeoutText}</strong><span>${user.points || 0} points</span>`;
                userPointsList.appendChild(userDiv);
            }
        }
    } catch (error) {
        console.error('Error loading user points list:', error);
        userPointsList.innerHTML = 'Error loading users';
    }
}

async function loadOnlineUsersList() {
    const onlineUsersList = document.getElementById('onlineUsersList');
    onlineUsersList.innerHTML = '';
    
    try {
        const onlineRef = window.firebaseRef(window.firebaseDb, 'online');
        const onlineSnapshot = await window.firebaseGet(onlineRef);
        const usersRef = window.firebaseRef(window.firebaseDb, 'users');
        const usersSnapshot = await window.firebaseGet(usersRef);
        
        if (!onlineSnapshot.exists()) {
            onlineUsersList.innerHTML = '<em style="color: #666;">No users online</em>';
            return;
        }
        
        const onlineUsers = onlineSnapshot.val();
        const userdata = usersSnapshot.exists() ? usersSnapshot.val() : {};
        
        for (const username in onlineUsers) {
            const user = userdata[username] || {};
            const isTimedOut = user.timeoutUntil && user.timeoutUntil > Date.now();
            const statusIcon = isTimedOut ? '🔇' : '🟢';
            
            const userDiv = document.createElement('div');
            userDiv.style.cssText = 'padding: 4px 0; color: #333;';
            userDiv.innerHTML = `${statusIcon} ${RainbetUtils.escapeHtml(username)}`;
            onlineUsersList.appendChild(userDiv);
        }
    } catch (error) {
        console.error('Error loading online users list:', error);
        onlineUsersList.innerHTML = '<em style="color: #666;">Error loading online users</em>';
    }
}

async function timeoutUser() {
    const username = document.getElementById('timeoutUsername').value.trim();
    const duration = parseInt(document.getElementById('timeoutDuration').value);
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    if (isNaN(duration) || duration <= 0) {
        alert('Please enter a valid duration');
        return;
    }
    
    try {
        const userRef = window.firebaseRef(window.firebaseDb, `users/${username}`);
        const snapshot = await window.firebaseGet(userRef);
        
        if (!snapshot.exists()) {
            alert('User not found');
            return;
        }
        
        const userData = snapshot.val();
        const timeoutUntil = Date.now() + (duration * 60 * 1000);
        userData.timeoutUntil = timeoutUntil;
        await window.firebaseSet(userRef, userData);
        
        await RainbetUtils.addSystemMessage(`${username} has been timed out for ${duration} minutes`);
        await loadUserPointsList();
        await loadOnlineUsersList();
        
        document.getElementById('timeoutUsername').value = '';
        alert(`${username} has been timed out for ${duration} minutes`);
    } catch (error) {
        console.error('Error timing out user:', error);
        alert('Error timing out user');
    }
}

async function removeTimeout() {
    const username = document.getElementById('timeoutUsername').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    try {
        const userRef = window.firebaseRef(window.firebaseDb, `users/${username}`);
        const snapshot = await window.firebaseGet(userRef);
        
        if (!snapshot.exists()) {
            alert('User not found');
            return;
        }
        
        const userData = snapshot.val();
        delete userData.timeoutUntil;
        await window.firebaseSet(userRef, userData);
        
        await RainbetUtils.addSystemMessage(`${username}'s timeout has been removed`);
        await loadUserPointsList();
        await loadOnlineUsersList();
        
        document.getElementById('timeoutUsername').value = '';
        alert(`${username}'s timeout has been removed`);
    } catch (error) {
        console.error('Error removing timeout:', error);
        alert('Error removing timeout');
    }
}

function showPassword(inputId) {
    document.getElementById(inputId).type = 'text';
}

function hidePassword(inputId) {
    document.getElementById(inputId).type = 'password';
}

async function isUserTimedOut(username) {
    try {
        const userRef = window.firebaseRef(window.firebaseDb, `users/${username}`);
        const snapshot = await window.firebaseGet(userRef);
        if (snapshot.exists()) {
            const user = snapshot.val();
            return user && user.timeoutUntil && user.timeoutUntil > Date.now();
        }
        return false;
    } catch (error) {
        console.error('Error checking timeout:', error);
        return false;
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be available
    let attempts = 0;
    while (!window.firebaseDb && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.firebaseDb) {
        console.warn('Firebase not available, using fallback localStorage mode');
        RainbetUtils.initializeLocalData();
    }
    
    // Check if user is already logged in
    const currentUser = RainbetUtils.getCurrentUser();
    if (currentUser) {
        await enterChat();
    }
    
    // Enter key support
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Login form enter key support
    ['loginUsername', 'loginPassword'].forEach(id => {
        document.getElementById(id)?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                login();
            }
        });
    });
});