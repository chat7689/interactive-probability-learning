# Google Sheets Logging Integration Setup

This guide will help you set up Google Sheets logging for the Interactive Probability Learning system to track user activities, game results, admin actions, and more.

## 📋 What Gets Logged

The system automatically logs the following activities to your Google Sheet:

- **User Authentication**: Login events with timestamps and user details
- **Game Activities**: Bets placed, wins, losses, amounts, and game types
- **Admin Actions**: Message clearing, settings changes, wealth redistribution
- **Points Transactions**: Credits earned, spent, awarded, or deducted
- **Security Events**: Unauthorized access attempts, suspicious activities
- **Shop Purchases**: Items bought, costs, success/failure status
- **Chat Messages**: Optional message logging for moderation purposes

## 🚀 Setup Instructions

### Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it something like "Interactive Probability Learning Activity Log"
4. Copy the spreadsheet ID from the URL (the long string between `/d/` and `/edit`)
   - Example: `https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7/edit`
   - The ID is: `1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7`

### Step 2: Create Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Click **"New Project"**
3. Delete the default code and paste this script:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Replace 'YOUR_SPREADSHEET_ID' with your actual spreadsheet ID
    const sheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
    const logSheet = sheet.getSheetByName('ActivityLog') || sheet.insertSheet('ActivityLog');

    // Add headers if they don't exist
    if (logSheet.getLastRow() === 0) {
      logSheet.getRange(1, 1, 1, 12).setValues([
        ['Timestamp', 'Type', 'Username', 'Action/Game', 'Details', 'Amount', 'Result', 'Net Profit', 'IP', 'User Agent', 'Success', 'Raw Data']
      ]);

      // Format headers
      const headerRange = logSheet.getRange(1, 1, 1, 12);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('white');

      // Auto-resize columns
      logSheet.autoResizeColumns(1, 12);
    }

    // Determine values for each column
    const timestamp = data.timestamp || new Date().toISOString();
    const type = data.type || '';
    const username = data.username || '';
    const actionGame = data.action || data.game || data.eventType || '';
    const details = data.details || data.message || data.result || data.reason || '';
    const amount = data.amount || data.betAmount || data.cost || '';
    const result = data.winnings || data.success || data.transactionType || '';
    const netProfit = data.netProfit || (data.winnings && data.betAmount ? data.winnings - data.betAmount : '');
    const ip = data.ip || '';
    const userAgent = data.userAgent || '';
    const success = data.success !== undefined ? data.success : '';
    const rawData = JSON.stringify(data);

    // Add the log entry
    logSheet.appendRow([
      timestamp,
      type,
      username,
      actionGame,
      details,
      amount,
      result,
      netProfit,
      ip,
      userAgent,
      success,
      rawData
    ]);

    // Auto-resize columns periodically (every 100 rows)
    if (logSheet.getLastRow() % 100 === 0) {
      logSheet.autoResizeColumns(1, 12);
    }

    return ContentService.createTextOutput('Success');
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput('Error: ' + error.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Google Apps Script is running. Use POST requests for logging.');
}
```

4. **Replace `YOUR_SPREADSHEET_ID`** with the actual ID you copied from Step 1
5. Save the project (Ctrl+S) and give it a name like "Probability Learning Logger"

### Step 3: Deploy as Web App

1. Click the **"Deploy"** button (top right)
2. Choose **"New deployment"**
3. Click the gear icon ⚙️ next to "Type" and select **"Web app"**
4. Configure the deployment:
   - **Description**: "Probability Learning Activity Logger"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
5. Click **"Deploy"**
6. **Copy the Web App URL** (it will look like: `https://script.google.com/macros/s/ABC123.../exec`)

### Step 4: Configure in Admin Panel

1. Login to your Interactive Probability Learning system as an admin
2. Open the **Admin Panel** (⚙️ button)
3. Find the **"📊 Google Sheets Logging"** section
4. Paste the Web App URL from Step 3 into the **"Google Apps Script URL"** field
5. Check the **"Enable Google Sheets Logging"** checkbox
6. Click **"Connect"**
7. Click **"🧪 Test Connection"** to verify everything is working

## 📊 Sheet Structure

Your Google Sheet will have the following columns:

| Column | Description |
|--------|-------------|
| Timestamp | When the event occurred (ISO format) |
| Type | Event type (USER_LOGIN, GAME_ACTIVITY, ADMIN_ACTION, etc.) |
| Username | User who performed the action |
| Action/Game | Specific action or game name |
| Details | Additional details about the event |
| Amount | Money/credits involved (bets, winnings, costs) |
| Result | Outcome or transaction type |
| Net Profit | Calculated profit/loss for games |
| IP | User's IP address (limited by browser security) |
| User Agent | Browser/device information |
| Success | Whether the operation succeeded |
| Raw Data | Complete JSON data for debugging |

## 🔧 Customization

### Adding Custom Filters

You can add filters and formatting to your sheet:

1. Select the header row
2. Go to **Data** → **Create a filter**
3. Use dropdown arrows to filter by event type, user, date range, etc.

### Creating Summary Charts

Create charts to visualize activity:

1. Select your data range
2. Go to **Insert** → **Chart**
3. Choose chart types like:
   - Line chart for activity over time
   - Pie chart for game popularity
   - Bar chart for user activity levels

### Setting Up Alerts

Get notified of important events:

1. Go to **Tools** → **Notification rules**
2. Set conditions like "when any changes are made"
3. Choose email frequency (immediately, daily, weekly)

## 🔒 Security Considerations

- **Permissions**: The Apps Script runs with your Google account permissions
- **Data Privacy**: Sensitive user data is logged - ensure compliance with privacy policies
- **Access Control**: Only share the sheet with authorized personnel
- **Backup**: Consider regular exports for data backup

## 🐛 Troubleshooting

### "Connection failed" Error
- Check that the Web App URL is correct
- Ensure the Apps Script deployment is set to "Anyone" access
- Verify the spreadsheet ID in the script

### Missing Data in Sheet
- Check browser console for JavaScript errors
- Verify that logging is enabled in admin panel
- Test the connection using the test button

### Permission Errors
- Re-deploy the Apps Script with updated permissions
- Make sure you're the owner of both the sheet and script

## 📈 Advanced Features

### Multiple Sheets for Different Data Types
Modify the script to create separate sheets for different event types:

```javascript
// In the doPost function, add:
const sheetName = getSheetNameForEventType(data.type);
const logSheet = sheet.getSheetByName(sheetName) || sheet.insertSheet(sheetName);
```

### Data Retention Policies
Add automatic cleanup of old logs:

```javascript
// Add this function to periodically clean old data
function cleanupOldLogs() {
  const sheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const logSheet = sheet.getSheetByName('ActivityLog');
  // Keep only last 10,000 rows
  if (logSheet.getLastRow() > 10000) {
    logSheet.deleteRows(2, logSheet.getLastRow() - 10000);
  }
}
```

## 🎯 Success!

Once set up, your Google Sheet will automatically receive real-time logs of all system activities. You can use this data for:

- **Analytics**: Understanding user behavior and popular games
- **Monitoring**: Tracking system usage and performance
- **Security**: Identifying suspicious activities or unauthorized access
- **Compliance**: Maintaining audit trails for financial transactions
- **Optimization**: Making data-driven improvements to the system

The logging system is designed to be non-intrusive and won't affect the performance of your Interactive Probability Learning system.