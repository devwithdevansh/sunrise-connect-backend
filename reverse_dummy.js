

async function reverseDummyPayments() {
  const API_URL = 'http://localhost:5000/api/v1';

  try {
    console.log('Fetching recent payments...');
    const res = await fetch(`${API_URL}/payments?limit=20`);
    const json = await res.json();
    const payments = json.data || [];

    const dummyPayments = payments.filter(p => [650, 4200].includes(p.amount));
    console.log(`Found ${dummyPayments.length} dummy payments to reverse`);

    for (const payment of dummyPayments) {
      console.log(`Reversing payment ${payment._id} of amount ${payment.amount}...`);
      const reverseRes = await fetch(`${API_URL}/payments/${payment._id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Reversing dummy payment made during testing' })
      });
      if (reverseRes.ok) {
        console.log(`Successfully reversed payment ${payment._id}`);
      } else {
        console.error(`Failed to reverse payment ${payment._id}: ${reverseRes.statusText}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

reverseDummyPayments();
