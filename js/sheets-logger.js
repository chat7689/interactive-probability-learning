/*
 * Google Sheets Logging Integration for Interactive Probability Learning
 * Logs various activities to Google Sheets for tracking and analytics
 */

class SheetsLogger {
    constructor() {
        // Google Apps Script Web App URL - Replace with your actual URL
        this.SHEETS_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
        this.enabled = false; // Set to true when you have the URL configured
    }

    /**
     * Generic function to send data to Google Sheets
     */
    async logToSheets(data) {
        if (!this.enabled || !this.SHEETS_URL || this.SHEETS_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            console.log('Sheets logging disabled or not configured');
            return;
        }

        try {
            const response = await fetch(this.SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            console.log('Successfully logged to Google Sheets');
        } catch (error) {
            console.error('Error logging to Google Sheets:', error);
        }
    }

    /**
     * Log user login/authentication events
     */
    async logUserLogin(username) {
        await this.logToSheets({
            type: 'USER_LOGIN',
            timestamp: new Date().toISOString(),
            username: username,
            ip: this.getClientIP(),
            userAgent: navigator.userAgent
        });
    }

    /**
     * Log game activities
     */
    async logGameActivity(username, game, action, betAmount = 0, result = '', winnings = 0) {
        await this.logToSheets({
            type: 'GAME_ACTIVITY',
            timestamp: new Date().toISOString(),
            username: username,
            game: game,
            action: action, // 'BET_PLACED', 'GAME_WON', 'GAME_LOST'
            betAmount: betAmount,
            result: result,
            winnings: winnings,
            netProfit: winnings - betAmount
        });
    }

    /**
     * Log admin actions
     */
    async logAdminAction(username, action, details = '') {
        await this.logToSheets({
            type: 'ADMIN_ACTION',
            timestamp: new Date().toISOString(),
            username: username,
            action: action, // 'CLEAR_MESSAGES', 'UPDATE_SETTINGS', 'REDISTRIBUTE_WEALTH', etc.
            details: details,
            ip: this.getClientIP()
        });
    }

    /**
     * Log points/credits transactions
     */
    async logPointsTransaction(username, type, amount, reason = '') {
        await this.logToSheets({
            type: 'POINTS_TRANSACTION',
            timestamp: new Date().toISOString(),
            username: username,
            transactionType: type, // 'EARNED', 'SPENT', 'AWARDED', 'DEDUCTED'
            amount: amount,
            reason: reason,
            balance: this.getCurrentUserPoints(username)
        });
    }

    /**
     * Log chat messages (optional - for moderation)
     */
    async logChatMessage(username, message, isSystem = false) {
        await this.logToSheets({
            type: 'CHAT_MESSAGE',
            timestamp: new Date().toISOString(),
            username: username,
            message: message,
            isSystem: isSystem,
            messageLength: message.length
        });
    }

    /**
     * Log security events
     */
    async logSecurityEvent(eventType, username, details = '') {
        await this.logToSheets({
            type: 'SECURITY_EVENT',
            timestamp: new Date().toISOString(),
            eventType: eventType,
            username: username,
            details: details,
            ip: this.getClientIP(),
            userAgent: navigator.userAgent
        });
    }

    /**
     * Log shop purchases
     */
    async logShopPurchase(username, item, cost, success = true) {
        await this.logToSheets({
            type: 'SHOP_PURCHASE',
            timestamp: new Date().toISOString(),
            username: username,
            item: item,
            cost: cost,
            success: success,
            userBalance: this.getCurrentUserPoints(username)
        });
    }

    /**
     * Get client IP (approximate)
     */
    getClientIP() {
        // Note: This won't get the real IP due to browser security
        // For real IP tracking, you'd need server-side logging
        return 'Browser-Hidden';
    }

    /**
     * Get current user points (helper function)
     */
    getCurrentUserPoints(username) {
        try {
            if (window.RainbetUtils && window.RainbetUtils.getCurrentUser() === username) {
                return document.getElementById('userPoints')?.textContent || 0;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Enable/disable logging
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Set the Google Apps Script URL
     */
    setURL(url) {
        this.SHEETS_URL = url;
        this.enabled = true;
    }
}

// Create global instance
window.SheetsLogger = new SheetsLogger();

/*
 * =================================================================================
 * GOOGLE APPS SCRIPT SETUP INSTRUCTIONS:
 * =================================================================================
 *
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Replace the default code with the following:
 *
 * function doPost(e) {
 *   try {
 *     const data = JSON.parse(e.postData.contents);
 *     const sheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
 *     const logSheet = sheet.getSheetByName('ActivityLog') || sheet.insertSheet('ActivityLog');
 *
 *     // Add headers if they don't exist
 *     if (logSheet.getLastRow() === 0) {
 *       logSheet.getRange(1, 1, 1, 10).setValues([
 *         ['Timestamp', 'Type', 'Username', 'Action/Game', 'Details', 'Amount', 'Result', 'IP', 'User Agent', 'Raw Data']
 *       ]);
 *     }
 *
 *     // Add the log entry
 *     logSheet.appendRow([
 *       data.timestamp || new Date().toISOString(),
 *       data.type || '',
 *       data.username || '',
 *       data.action || data.game || '',
 *       data.details || data.message || data.result || '',
 *       data.amount || data.betAmount || data.cost || '',
 *       data.winnings || data.success || '',
 *       data.ip || '',
 *       data.userAgent || '',
 *       JSON.stringify(data)
 *     ]);
 *
 *     return ContentService.createTextOutput('Success');
 *   } catch (error) {
 *     Logger.log('Error: ' + error.toString());
 *     return ContentService.createTextOutput('Error: ' + error.toString());
 *   }
 * }
 *
 * 4. Save the project
 * 5. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App URL and paste it in the SHEETS_URL variable above
 * 7. Create a Google Sheet and copy its ID to replace 'YOUR_SPREADSHEET_ID'
 * 8. Set SheetsLogger.setEnabled(true) in your main JavaScript
 *
 * =================================================================================
 */