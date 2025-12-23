// Import Express and Axios
const express = require('express');
const axios = require('axios'); // <--- NEW IMPORT

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN; // <--- ADD THIS IN RENDER ENV
const phoneNumberId = process.env.PHONE_NUMBER_ID; // <--- ADD THIS IN RENDER ENV

// --- HELPER: Send Message ---
async function sendMessage(to, text) {
  try {
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text },
      },
    });
    console.log(`✅ Reply sent to ${to}`);
  } catch (error) {
    console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
  }
}

// Route for GET requests (Verification)
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests (Incoming Messages)
app.post('/', async (req, res) => {
  const body = req.body;

  // Log the receipt
  console.log('\n\nWebhook received request:\n');
  console.log(JSON.stringify(body, null, 2));

  // Check if this is a WhatsApp status update
  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      // Extract the message details
      const msg = body.entry[0].changes[0].value.messages[0];
      const from = msg.from; // Sender's phone number
      const text = msg.text ? msg.text.body : 'Image/Media'; // The message content

      console.log(`💬 Received from ${from}: ${text}`);

      // --- LOGIC: SEND REPLY ---
      await sendMessage(from, `I received your message: "${text}"`);
    }
  }

  // Always return 200 OK to Meta
  res.status(200).end();
});

app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});