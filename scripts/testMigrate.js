import fetch from 'node-fetch';

async function run() {
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'devansh@gmail.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;

  const studentsRes = await fetch('http://localhost:5000/api/v1/students?limit=100', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const studentsData = await studentsRes.json();
  const testMitraj = studentsData.data.find(s => s.studentName.toLowerCase().includes('mitraj'));
  
  if (!testMitraj) {
    console.log('test mitraj not found');
    return;
  }
  console.log('Found:', testMitraj.studentName, testMitraj._id);

  const updateRes = await fetch(`http://localhost:5000/api/v1/students/${testMitraj._id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({
      grNo: '123',
      gender: 'Male',
      fatherName: 'test',
      motherName: 'test',
      dob: '2010-01-01',
      aadharNo: '123456789012',
      isMigrated: true
    })
  });
  const updateData = await updateRes.json();
  console.log('Update result:', updateRes.status, updateData);
}

run();
