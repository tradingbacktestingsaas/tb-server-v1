import express from "express";

const router = express.Router();

router.post("/tradesync", (req, res) => {
  try {
    const event = req.body;

    console.log("📩 Webhook received:", event);

    switch (event.event) {
      case "connected":
        handleConnected(event);
        break;

      case "not_connected":
        handleNotConnected(event);
        break;

      case "reconnected":
        handleReconnected(event);
        break;

      case "out_of_sync":
        handleOutOfSync(event);
        break;

      case "in_sync":
        handleInSync(event);
        break;

      case "equity_alert":
        handleEquityAlert(event);
        break;

      default:
        console.log("⚠️ Unknown event:", event);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Server error");
  }
});

// Example handlers
function handleConnected(event) {
  console.log(`✅ Account ${event.account_id} connected`);
}

function handleNotConnected(event) {
  console.log(`❌ Account ${event.account_id} not connected`);
}

function handleOutOfSync(event) {
  console.log(`⚠️ Account ${event.account_id} out of sync`);
}

function handleInSync(event) {
  console.log(`🔄 Account ${event.account_id} back in sync`);
}

function handleEquityAlert(event) {
  console.log(`💰 Equity alert on account ${event.account_id}`);
}

export default router;
