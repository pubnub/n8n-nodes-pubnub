# 🚀 Quick Start: PubNub n8n Nodes

## ✅ Setup Complete!

Your PubNub n8n nodes are ready to use!

---

## 📝 How to Use

### Start n8n

```bash
./start-n8n.sh
```

This will:
- Install n8n if needed
- Link your PubNub custom nodes
- Start n8n on http://localhost:5678

### View Testing Guide

```bash
./test-pubnub-node.sh
```

Or just open it in any text editor to see step-by-step testing instructions.

---

## 🎯 Quick Test (2 minutes)

### 1. Start n8n
```bash
./start-n8n.sh
```

Wait for: `Editor is now accessible via: http://localhost:5678`

### 2. Open n8n in Browser
Go to: http://localhost:5678

### 3. Add Credentials
- Click **"Credentials"** → **"Add Credential"**
- Search **"PubNub API"**
- Enter:
  - **Publish Key**: `demo`
  - **Subscribe Key**: `demo`
- Click **"Save"**

### 4. Create Test Workflow
- Click **"New Workflow"**
- Add **"Manual Trigger"** node
- Add **"PubNub"** node
- Configure:
  - **Resource**: Message
  - **Operation**: Publish
  - **Channel**: `test-channel`
  - **Message**:
    ```json
    {
      "text": "Hello from n8n!",
      "timestamp": "{{$now.toISO()}}"
    }
    ```
- Click **"Execute Workflow"**

✅ **Success!** You should see output with a `timetoken`!

### 5. Verify (Optional)
Open https://www.pubnub.com/docs/general/messages/debug
- Subscribe to: `test-channel`
- Run your workflow again
- See the message appear in real-time! 🎉

---

## 📦 Available Nodes

### PubNub Node (Regular Operations)
**Message Operations:**
- Publish: Send messages to channels
- Signal: Send lightweight signals

**History Operations:**
- Fetch Messages: Get message history
- Delete Messages: Clear messages
- Message Counts: Get count stats

**Presence Operations:**
- Here Now: Current users/occupancy
- Where Now: User's active channels
- Set/Get State: User state management

**Channel Groups:**
- Add/Remove Channels
- List Channels
- Delete Groups

### PubNub Trigger Node (Real-time)
- Trigger on new messages
- Trigger on presence events
- Support for filter expressions
- Channel and channel group subscriptions

---

## 🛑 Stop n8n

Press `Ctrl+C` in the terminal where n8n is running

---

## 🔧 Troubleshooting

### PubNub nodes don't appear?
```bash
# Restart n8n
# Press Ctrl+C, then:
./start-n8n.sh
```

### Need to reinstall?
```bash
# Re-link the package
cd ~/.n8n/custom
npm link n8n-nodes-pubnub
```

### Check if nodes are linked:
```bash
ls -la ~/.n8n/custom/node_modules/
```

You should see `n8n-nodes-pubnub` pointing to your package.

---

## 📚 Documentation

- **Full README**: See `README.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Testing Guide**: Run `./test-pubnub-node.sh`

---

## 🎉 Next Steps

1. Test basic publish/subscribe
2. Try the Trigger node for real-time workflows
3. Explore all operations (History, Presence, etc.)
4. Build your real-time automation! 🚀

---

**Need Help?**
- PubNub Docs: https://www.pubnub.com/docs/
- n8n Docs: https://docs.n8n.io/
- Check the logs where n8n is running
