# Slack Approval Bot

A Slack bot that facilitates approval workflows within an organization. Users can request approvals from other team members using a simple slash command.

## Features

- Slash command `/approval-test` to initiate approval requests
- Modal interface for selecting approver and entering request details
- Approve/Reject buttons for approvers
- Automatic notifications for requesters when their request is approved or rejected

## Setup

1. Create a new Slack App at https://api.slack.com/apps
2. Enable Socket Mode in your Slack App
3. Add the following bot token scopes:
   - `chat:write`
   - `commands`
   - `users:read`
   - `chat:write.public`

4. Create a Slash Command:
   - Command: `/approval-test`
   - Request URL: Leave empty (we're using Socket Mode)
   - Short Description: "Request approval from a team member"
   - Usage Hint: "[approver] [request details]"

5. Install the app to your workspace

6. Copy the following tokens from your Slack App:
   - Bot User OAuth Token (starts with `xoxb-`)
   - Signing Secret
   - App-Level Token (starts with `xapp-`)

7. Create a `.env` file in the project root and add your tokens:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   PORT=3000
   ```

8. Install dependencies:
   ```bash
   npm install
   ```

9. Start the bot:
   ```bash
   npm start
   ```

## Usage

1. Type `/approval-test` in any Slack channel
2. Select an approver from the dropdown
3. Enter your approval request details
4. Click Submit
5. The approver will receive a message with Approve/Reject buttons
6. The requester will be notified of the decision

