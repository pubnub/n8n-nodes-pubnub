# Testing PubNub n8n Nodes Locally

## Step 1: Link Your Package to n8n

### Option A: Using npm link (Recommended for Development)

1. **In your node package directory** (`/Users/stephen/Desktop/n8n`):
```bash
npm link
```

2. **Navigate to your n8n custom nodes directory**:
```bash
# Create the directory if it doesn't exist
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom

# Link the package
npm link n8n-nodes-pubnub
```

### Option B: Copy to n8n nodes directory

```bash
# Copy the entire package to n8n's custom directory
cp -r /Users/stephen/Desktop/n8n ~/.n8n/nodes/n8n-nodes-pubnub
cd ~/.n8n/nodes/n8n-nodes-pubnub
npm install
```

## Step 2: Restart n8n

Stop your n8n instance (Ctrl+C) and restart it:

```bash
n8n start
```

Or if you're running it in development mode:
```bash
n8n start --tunnel
```

## Step 3: Get PubNub Test Keys

You can use PubNub's demo keys for testing:
- **Publish Key**: `demo`
- **Subscribe Key**: `demo`

Or get your own keys:
1. Go to https://admin.pubnub.com/
2. Sign up or log in
3. Create a new app or use an existing one
4. Copy the Publish and Subscribe keys

## Step 4: Configure PubNub Credentials in n8n

1. Open n8n in your browser (usually http://localhost:5678)
2. Go to **Credentials** (in the left sidebar)
3. Click **Add Credential**
4. Search for "PubNub" and select **PubNub API**
5. Fill in:
   - **Publish Key**: `demo` (or your key)
   - **Subscribe Key**: `demo` (or your key)
   - **Secret Key**: (leave empty for demo)
   - **User ID**: (leave empty - will auto-generate)
6. Click **Save**

## Step 5: Create a Test Workflow

### Test 1: Simple Publish Message

1. Create a **New Workflow**
2. Add a **Manual Trigger** node (or Schedule Trigger)
3. Add a **PubNub** node
4. Configure the PubNub node:
   - **Credential**: Select your PubNub API credential
   - **Resource**: Message
   - **Operation**: Publish
   - **Channel**: `test-channel`
   - **Message**: 
   ```json
   {
     "text": "Hello from n8n!",
     "timestamp": "{{$now.toISO()}}",
     "user": "n8n-tester"
   }
   ```
5. Click **Execute Node** or **Execute Workflow**
6. Check the output - you should see a success response with a timetoken

### Test 2: Publish and Subscribe (Full Loop)

**Workflow 1: Publisher**
1. Manual Trigger node
2. PubNub node (Publish to `n8n-test-channel`)

**Workflow 2: Subscriber** 
1. **PubNub Trigger** node:
   - **Trigger On**: Message
   - **Channels**: `n8n-test-channel`
2. Add any node to process the message (like **Code** or **Set** node)
3. **Activate** the workflow
4. Execute the Publisher workflow
5. Check that the Subscriber workflow was triggered

## Step 6: Verify Installation

Check if nodes are loaded:

```bash
# Check n8n logs for any errors
# Look for messages like "Loaded nodes: PubNub, PubNubTrigger"
```

## Troubleshooting

### Nodes Not Appearing?

1. **Check n8n logs** for errors when starting
2. **Verify the package is linked**:
   ```bash
   ls -la ~/.n8n/custom/node_modules/
   # Should see n8n-nodes-pubnub
   ```
3. **Check n8n version compatibility**:
   ```bash
   n8n --version
   ```

### "Cannot find module" errors?

1. Make sure dependencies are installed:
   ```bash
   cd /Users/stephen/Desktop/n8n
   npm install
   npm run build
   ```

2. Verify the dist folder exists:
   ```bash
   ls -la dist/
   ```

### Credentials not saving?

1. Make sure n8n has write permissions to `~/.n8n/`
2. Check n8n logs for database errors

### Messages not publishing?

1. **Check PubNub keys are correct**
2. **Test with PubNub's demo keys** first
3. **Check the PubNub Debug Console**:
   - Go to https://admin.pubnub.com/
   - Select your app
   - Go to Debug Console
   - Subscribe to your test channel
   - Publish from n8n and watch for messages

## Quick Test Script

Here's a quick test you can run from n8n's Code node:

```javascript
// This tests if PubNub SDK is working
const items = $input.all();

// Test data
const testMessage = {
  text: "Test from n8n Code node",
  timestamp: new Date().toISOString()
};

return [{ json: { 
  success: true, 
  message: testMessage,
  note: "Now test with actual PubNub node"
}}];
```

## Expected Results

### Successful Publish:
```json
{
  "timetoken": "16234567890123456"
}
```

### Successful Trigger:
```json
{
  "event": "message",
  "channel": "test-channel",
  "message": {
    "text": "Hello from n8n!",
    "timestamp": "2024-11-13T...",
    "user": "n8n-tester"
  },
  "timetoken": "16234567890123456",
  "publisher": "n8n-user-123456"
}
```

## Advanced Testing

### Test Presence:
```
Resource: Presence
Operation: Here Now
Channels: test-channel
Options: 
  - Include UUIDs: true
```

### Test History:
```
Resource: History
Operation: Fetch Messages
Channel: test-channel
Options:
  - Count: 10
  - Include Metadata: true
```

### Test Channel Groups:
```
Resource: Channel Group
Operation: Add Channels
Channel Group: my-test-group
Channels: channel1,channel2,channel3
```

## Next Steps

Once basic publishing works:
1. Test all operations (History, Presence, Channel Groups)
2. Test the Trigger node with real-time messages
3. Test error handling (invalid keys, wrong channel, etc.)
4. Test with your production PubNub keys
5. Build real workflows!

## Need Help?

- **PubNub Docs**: https://www.pubnub.com/docs/
- **n8n Community**: https://community.n8n.io/
- **Check logs**: `~/.n8n/logs/` or console output

Happy Testing! 🚀
