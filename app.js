const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Load .env file

const app = express();
app.use(express.json());

// --- ADD THIS X-RAY LOGGER ---
app.use((req, res, next) => {
  console.log(`[X-RAY] Incoming Request: ${req.method} ${req.path}`);
  next();
});
// CONFIGURATION
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN; 
const phoneId = process.env.PHONE_NUMBER_ID; 

// 1. VERIFICATION (GET)
// Note: Changed path to '/webhook' to keep root '/' free for your future landing page
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// 2. RECEIVE MESSAGES (POST)
app.post('/webhook', async (req, res) => {
  // 1. Acknowledge immediately
  res.status(200).send('EVENT_RECEIVED');

  // 2. LOG EVERYTHING (The "Blind" Check)
  console.log("---- INCOMING WEBHOOK RAW BODY ----");
  console.log(JSON.stringify(req.body, null, 2)); 
  console.log("-----------------------------------");

  const body = req.body;

  // Check if it's a WhatsApp message
  if (body.object === 'whatsapp_business_account') {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const senderId = message.from; // User's Phone Number
        const type = message.type;

        console.log(`Received ${type} from ${senderId}`);

        // LOGIC: HANDLE TEXT MESSAGES
        if (type === 'text') {
          const textBody = message.text.body.toLowerCase();

          if (textBody.includes('hi') || textBody.includes('hello')) {
            await sendInteractiveMenu(senderId);
          } else {
            await sendMessage(senderId, `You said: "${textBody}". Say 'Hi' to see the menu.`);
          }
        }
        
        // LOGIC: HANDLE BUTTON CLICKS
        else if (type === 'interactive') {
          const btnId = message.interactive.button_reply.id;
          if (btnId === 'btn_book') {
            await sendMessage(senderId, "📅 Booking Flow started! (Coming soon)");
          } else if (btnId === 'btn_status') {
            await sendMessage(senderId, "⏳ No active queue token found.");
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error.message);
    }
  }
});

// --- HELPER FUNCTIONS (The "Mouth") ---

// Function to send simple text
async function sendMessage(to, text) {
  try {
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      }
    });
  } catch (error) {
    console.error('Failed to send message:', error.response ? error.response.data : error.message);
  }
}

// Function to send Buttons
async function sendInteractiveMenu(to) {
  try {
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: "Welcome to Whizor! 🏥\nHow can I help you?" },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'btn_book', title: 'Book Doctor' } },
              { type: 'reply', reply: { id: 'btn_status', title: 'Check Queue' } }
            ]
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to send menu:', error.response ? error.response.data : error.message);
  }
}

// Start Server
app.listen(port, () => {
  console.log(`Whizor Bot listening on port ${port}`);
});