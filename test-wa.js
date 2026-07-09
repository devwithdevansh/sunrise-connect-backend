async function test() {
  const WHATSAPP_PHONE_NUMBER_ID = '1207994982394717';
  const WHATSAPP_API_TOKEN = 'EAAUILRbf4pIBRz7gaTdPUiVPIZB7EOnMdQZBPqXwCrnvmBr8K8xq0nDR5D8D1T4rY3cnws5GZAm6fwmF3ivr7A1eUS2ZBxfWg8rsXFOluxUvCk9OZAjYSiN2aM2Xm0DSV9wrZAZAZABfBZBX4HUeynW9fz7G6y4L0tk8wYLktyvZCbNshYFeCgULP9xHZA6ZCoNoZC5WMptra9EhwszIrQaMKqRqpSefpZAjl8nfc7dHO7ixKw0ZCLP8OLa6yoXdzwRZCc5szlhuFaIW1GNu3Uq367uXJqvwPwZDZD';
  // Use a random valid number or just test if we get an auth error vs a validation error
  const to = '919999999999';

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' }
    }
  };

  try {
    const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    console.log("Fetching: " + url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    console.log("Status:", response.status);
    console.log(JSON.stringify(json, null, 2));
  } catch(e) {
    console.error("Error:", e);
  }
}

test();
