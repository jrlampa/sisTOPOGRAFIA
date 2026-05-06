
async function testRateLimit() {
  const url = 'http://localhost:3001/api/dg/runs';
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < 110; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        successCount++;
      } else {
        failCount++;
        if (response.status === 429) {
          console.log(`Request ${i+1}: Rate limited (429)`);
        } else {
          console.log(`Request ${i+1}: Status ${response.status}`);
        }
      }
    } catch (error) {
      failCount++;
      console.log(`Request ${i+1}: Error ${error.message}`);
    }
  }

  console.log(`Success: ${successCount}, Fail: ${failCount}`);
}

testRateLimit();
