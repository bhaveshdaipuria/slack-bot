require("dotenv").config();
const { App } = require("@slack/bolt");
const express = require("express");

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
		// Get all users in the workspace
		const result = await client.users.list();
		const users = result.members.filter(
			(member) => !member.is_bot && !member.deleted,
		);

		// Create the modal view
		const modalView = {
			type: "modal",
			callback_id: "approval_modal",
			title: {
				type: "plain_text",
				text: "Request Approval",
				emoji: true,
			},
			submit: {
				type: "plain_text",
				text: "Submit",
				emoji: true,
			},
			close: {
				type: "plain_text",
				text: "Cancel",
				emoji: true,
			},
			blocks: [
				{
					type: "input",
					block_id: "approver_select",
					element: {
						type: "users_select",
						placeholder: {
							type: "plain_text",
							text: "Select an approver",
							emoji: true,
						},
						action_id: "approver_select-action",
					},
					label: {
						type: "plain_text",
						text: "Approver",
						emoji: true,
					},
				},
				{
					type: "input",
					block_id: "approval_text",
					element: {
						type: "plain_text_input",
						multiline: true,
						action_id: "approval_text-action",
						placeholder: {
							type: "plain_text",
							text: "Enter your approval request details...",
							emoji: true,
						},
					},
					label: {
						type: "plain_text",
						text: "Approval Request",
						emoji: true,
					},
				},
			],
		};

		await client.views.open({
			trigger_id: body.trigger_id,
			view: modalView,
		});
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

	// Create approval message with buttons
	const approvalMessage = {
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
						text: {
							type: "plain_text",
							text: "Approve",
							emoji: true,
						},
						style: "primary",
						value: `approve_${requesterId}`,
						action_id: "approve_action",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "Reject",
							emoji: true,
						},
						style: "danger",
						value: `reject_${requesterId}`,
						action_id: "reject_action",
					},
				],
			},
		],
	};

	// Send message to approver
	const result = await client.chat.postMessage({
		channel: approverId,
		...approvalMessage,
	});

	// Store the approval request
	pendingApprovals.set(result.ts, {
		requesterId,
		approverId,
		approvalText,
		status: "pending",
	});
});

// Handle approval/rejection actions
app.action("approve_action", async ({ ack, body, client }) => {
	await ack();

	const messageTs = body.message.ts;
	const approval = pendingApprovals.get(messageTs);

	if (approval) {
		// Update approval status
		approval.status = "approved";
		pendingApprovals.set(messageTs, approval);

		// Notify requester
		await client.chat.postMessage({
			channel: approval.requesterId,
			text: `Your approval request has been approved by <@${approval.approverId}>!`,
		});

		// Update the original message
		await client.chat.update({
			channel: approval.approverId,
			ts: messageTs,
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `*Approval Request*\nFrom: <@${approval.requesterId}>\n\n${approval.approvalText}\n\n✅ *Approved*`,
					},
				},
			],
		});
	}
});

app.action("reject_action", async ({ ack, body, client }) => {
	await ack();

	const messageTs = body.message.ts;
	const approval = pendingApprovals.get(messageTs);

	if (approval) {
		// Update approval status
		approval.status = "rejected";
		pendingApprovals.set(messageTs, approval);

		// Notify requester
		await client.chat.postMessage({
			channel: approval.requesterId,
			text: `Your approval request has been rejected by <@${approval.approverId}>`,
		});

		// Update the original message
		await client.chat.update({
			channel: approval.approverId,
			ts: messageTs,
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `*Approval Request*\nFrom: <@${approval.requesterId}>\n\n${approval.approvalText}\n\n❌ *Rejected*`,
					},
				},
			],
		});
	}
});

// Start the app
(async () => {
	await app.start(process.env.PORT || 3000);
	console.log("⚡️ Bolt app is running!");
})();
