import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: 'd:/projects/sunrise-connect/backend/.env' });

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const phone = '918347077689'; // test4 parent
const finalTemplateName = 'fees_english'; // assume it is fees_english based on the screenshot
const languageCode = 'en_US'; // or en

const payload = {
  messaging_product: 'whatsapp',
  to: phone,
  type: 'template',
  template: {
    name: finalTemplateName,
    language: { code: languageCode },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'test4' },
          { type: 'text', text: '📚 Education & Term (Term 1 + June to July): ₹6600, 🚌 Transport (June to July): ₹1300' },
          { type: 'text', text: '7900' }
        ]
      }
    ]
  }
};

async function test() {
  try {
    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
test();
