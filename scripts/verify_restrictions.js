import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/v1';

async function loginWithEmail(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const d = await res.json().catch(()=>({}));
    throw new Error(`Login failed for ${email}: ${d.message || res.statusText}`);
  }
  const data = await res.json();
  return data.data.accessToken;
}

async function runTest(name, fn) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const result = await fn();
    if (result === true) {
      console.log('✅ PASS');
    } else {
      console.log(`❌ FAIL (${result})`);
    }
  } catch (err) {
    console.log(`❌ ERROR (${err.message})`);
  }
}

async function main() {
  console.log('Starting Restriction Tests...\n');
  
  let tokenA, tokenB, tokenC;
  try {
    tokenA = await loginWithEmail('teacher.a@test.com', 'password123');
    tokenB = await loginWithEmail('teacher.b@test.com', 'password123');
    tokenC = await loginWithEmail('teacher.c@test.com', 'password123');
    console.log('✅ Successfully logged in as all dummy teachers.');
  } catch(e) {
    console.error('Failed to login:', e.message);
    process.exit(1);
  }

  console.log('\n--- Test Suite ---');

  // 1. Teacher A (Class Teacher 10-A) accessing 10-A students
  await runTest('Teacher A can access 10-A students (Class Teacher)', async () => {
    const res = await fetch(`${BASE_URL}/students?standard=10&division=A&medium=English`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    return res.status === 200;
  });

  // 2. Teacher A accessing 10-B students (Not Class Teacher, only Subject Teacher)
  await runTest('Teacher A CANNOT access 10-B students roster', async () => {
    const res = await fetch(`${BASE_URL}/students?standard=10&division=B&medium=English`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    return res.status === 403;
  });

  // 3. Teacher B accessing 10-A students (Not Class Teacher, only Subject Teacher)
  await runTest('Teacher B CANNOT access 10-A students roster', async () => {
    const res = await fetch(`${BASE_URL}/students?standard=10&division=A&medium=English`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    return res.status === 403;
  });

  // 4. Any Teacher accessing Fees
  await runTest('Teacher A CANNOT access Fees module', async () => {
    const res = await fetch(`${BASE_URL}/erp/fees/fee-structures`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    return res.status === 403;
  });

  // 5. Teacher C accessing Timetable
  await runTest('Teacher C can fetch their empty timetable', async () => {
    const res = await fetch(`${BASE_URL}/erp/timetable/my-timetable`, {
      headers: { 'Authorization': `Bearer ${tokenC}` }
    });
    return res.status === 200;
  });

  console.log('\nTests Complete!');
}

main();
