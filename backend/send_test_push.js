#!/usr/bin/env node

/**
 * Test script to send push notifications via Expo's Push API.
 * 
 * Usage:
 *   node backend/send_test_push.js <EXPO_PUSH_TOKEN> [TITLE] [BODY] [RECORD_ID] [CATEGORY]
 * 
 * Example:
 *   node backend/send_test_push.js "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" "New Homework Assigned" "Please complete page 45 of your math book." "38" "Homework"
 */

const args = process.argv.slice(2);
const expoPushToken = args[0];

if (!expoPushToken) {
  console.log(`
Usage:
  node backend/send_test_push.js <EXPO_PUSH_TOKEN> [TITLE] [BODY] [RECORD_ID] [CATEGORY]

Arguments:
  EXPO_PUSH_TOKEN: The Expo push token displayed in the app drawer footer (required).
  TITLE:           The title of the notification (default: "Test Notification").
  BODY:            The body text of the notification (default: "This is a test notification from the school app backend.").
  RECORD_ID:       Optional ID of the notification item to expand/highlight in the app (e.g. "38").
  CATEGORY:        Optional category of the notification (default: "General", e.g., "Homework", "Alerts", "Academics").
`);
  process.exit(1);
}

const title = args[1] || "Test Notification";
const body = args[2] || "This is a test notification from the school app backend.";
const recordId = args[3] || null;
const category = args[4] || "General";

// Prepare the payload for Expo's Push API
const payload = {
  to: expoPushToken,
  sound: "default",
  title: title,
  body: body,
  data: {
    recordId: recordId,
    type: category
  }
};

console.log("Sending push notification...");
console.log("Target Token:", expoPushToken);
console.log("Payload:", JSON.stringify(payload, null, 2));

fetch("https://exp.host/--/api/v2/push/send", {
  method: "POST",
  headers: {
    "Accept": "application/json",
    "Accept-encoding": "gzip, deflate",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
})
  .then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }
    console.log("\nResponse from Expo Push API:");
    console.log(JSON.stringify(data, null, 2));
    
    // Expo returns an array of receipts in data.data
    if (data.data && data.data[0]) {
      const receipt = data.data[0];
      if (receipt.status === "ok") {
        console.log("\nSuccess: Notification successfully queued at Expo servers!");
      } else {
        console.error(`\nError from Expo: ${receipt.message}`);
        if (receipt.details) {
          console.error("Details:", receipt.details);
        }
      }
    }
  })
  .catch((err) => {
    console.error("\nFailed to send push notification:", err.message || err);
  });
