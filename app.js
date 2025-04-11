require("dotenv").config();
const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Store pending approvals
const pendingApprovals = new Map();

// Handle the /approval-test slash command
app.command("/approval-test", async ({ command, ack, body, client }) => {
  await ack();

  try {
    // Create the modal view
    const modalView = {
      type: "modal",
      callback_id: "approval_modal",
      title: { type: "plain_text", text: "Request Approval" },
      submit: { type: "plain_text", text: "Submit" },
      blocks: [
        {
          type: "input",
          block_id: "approver_select",
          element: {
            type: "users_select",
            placeholder: { type: "plain_text", text: "Select approver" },
            action_id: "approver_select-action",
          },
          label: { type: "plain_text", text: "Approver" },
        },
        {
          type: "input",
          block_id: "approval_text",
          element: {
            type: "plain_text_input",
            multiline: true,
            action_id: "approval_text-action",
            placeholder: { type: "plain_text", text: "Request details..." },
          },
          label: { type: "plain_text", text: "Details" },
        },
      ],
    };

    await client.views.open({ trigger_id: body.trigger_id, view: modalView });
  } catch (error) {
    console.error(error);
  }
});

// Handle modal submission
app.view("approval_modal", async ({ ack, body, view, client }) => {
  await ack();

  const approverId =
    view.state.values.approver_select["approver_select-action"].selected_user;
  const approvalText =
    view.state.values.approval_text["approval_text-action"].value;
  const requesterId = body.user.id;

  // Send approval request message to approver
  const message = await client.chat.postMessage({
    channel: approverId,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*New Approval Request*\nFrom: <@${requesterId}>\n\n${approvalText}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            value: `approve_${requesterId}`,
            action_id: "approve_action",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            style: "danger",
            value: `reject_${requesterId}`,
            action_id: "reject_action",
          },
        ],
      },
    ],
  });

  // Store approval request
  pendingApprovals.set(message.ts, {
    requesterId,
    approverId,
    approvalText,
    status: "pending",
  });
});

// Handle approve action - DELETE the message
app.action("approve_action", async ({ ack, body, client }) => {
  await ack();

  const messageTs = body.message.ts;
  const approval = pendingApprovals.get(messageTs);

  if (approval) {
    // Delete the approval request message
    await client.chat.delete({
      channel: approval.approverId,
      ts: messageTs,
    });

    // Notify requester
    await client.chat.postMessage({
      channel: approval.requesterId,
      text: `✅ Your request was approved by <@${body.user.id}>!`,
    });

    // Notify approver
    await client.chat.postMessage({
      channel: body.user.id,
      text: `You approved a request from <@${approval.requesterId}>:\n> ${approval.approvalText}`,
    });

    // Clean up
    pendingApprovals.delete(messageTs);
  }
});

// Handle reject action - DELETE the message
app.action("reject_action", async ({ ack, body, client }) => {
  await ack();

  const messageTs = body.message.ts;
  const approval = pendingApprovals.get(messageTs);

  if (approval) {
    // Delete the approval request message
    await client.chat.delete({
      channel: approval.approverId,
      ts: messageTs,
    });

    // Notify requester
    await client.chat.postMessage({
      channel: approval.requesterId,
      text: `❌ Your request was rejected by <@${body.user.id}>`,
    });
    // Notify approver
    await client.chat.postMessage({
      channel: body.user.id,
      text: `You rejected a request from <@${approval.requesterId}>:\n> ${approval.approvalText}`,
    });

    // Clean up
    pendingApprovals.delete(messageTs);
  }
});

// Start the app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚡️ Approval bot running!");
})();
