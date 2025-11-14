#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          PubNub Node Testing Guide                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

cat << 'EOF'
🧪 TESTING YOUR PUBNUB NODES

Prerequisites:
─────────────────────────────────────────────────────────────
✓ n8n is running (use ./start-n8n.sh)
✓ n8n is open in browser at http://localhost:5678

Step 1: Add PubNub Credentials
─────────────────────────────────────────────────────────────
1. In n8n UI, click "Credentials" in left sidebar
2. Click "Add Credential"
3. Search for "PubNub API"
4. Enter:
   - Publish Key: demo
   - Subscribe Key: demo
   - (Leave other fields empty)
5. Click "Save"

Step 2: Test Publish Message
─────────────────────────────────────────────────────────────
1. Create a "New Workflow"
2. Add "Manual Trigger" node (or click "Add first step")
3. Add "PubNub" node:
   - Click "+" → Search "PubNub" → Select it
4. Configure PubNub node:
   - Credential: Select your PubNub API credential
   - Resource: Message
   - Operation: Publish
   - Channel: test-channel
   - Message:
     {
       "text": "Hello from n8n!",
       "timestamp": "{{$now.toISO()}}",
       "user": "tester"
     }
5. Click "Execute Workflow"
6. ✅ Success! You should see output with a "timetoken"

Step 3: Verify Message was Sent (Optional)
─────────────────────────────────────────────────────────────
Open PubNub Debug Console to see your message:
1. Go to: https://www.pubnub.com/docs/general/messages/debug
2. In "Channel Name" field, enter: test-channel
3. Click "Subscribe"
4. Go back to n8n and execute your workflow again
5. You'll see the message appear in real-time! 🎉

Step 4: Test Other Operations
─────────────────────────────────────────────────────────────

Test Fetch History:
  - Resource: History
  - Operation: Fetch Messages
  - Channel: test-channel
  - Options → Count: 10

Test Presence:
  - Resource: Presence
  - Operation: Here Now
  - Channels: test-channel

Test Signal:
  - Resource: Message
  - Operation: Signal
  - Channel: test-channel
  - Signal: "Hi!"

Step 5: Test Trigger Node (Real-time!)
─────────────────────────────────────────────────────────────
1. Create a NEW workflow
2. Add "PubNub Trigger" node:
   - Trigger On: Message
   - Channels: test-channel
3. Add a "Code" or "Set" node after it to process messages
4. ACTIVATE the workflow (toggle switch at top)
5. In your first workflow, publish a message to test-channel
6. Watch the trigger workflow execute automatically! 🚀

Troubleshooting
─────────────────────────────────────────────────────────────
❌ Can't find PubNub node?
   → Restart n8n: Ctrl+C then ./start-n8n.sh

❌ Publish fails?
   → Check your PubNub keys are correct
   → Try with demo/demo keys first

❌ Trigger doesn't fire?
   → Make sure workflow is ACTIVATED (toggle switch)
   → Check channel names match exactly

Need Help?
─────────────────────────────────────────────────────────────
• PubNub Docs: https://www.pubnub.com/docs/
• n8n Docs: https://docs.n8n.io/
• Check console logs where n8n is running

Happy Testing! 🎉

EOF
