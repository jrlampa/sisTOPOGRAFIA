
async function testOsmFinal() {
  const lat = -22.758878;
  const lon = -42.881869;
  const radius = 200;
  const apiBaseUrl = 'http://localhost:3001/api';

  console.log(`Testing FINAL OSM Proxy via POST to Backend...`);
  
  try {
    const response = await fetch(`${apiBaseUrl}/osm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lat, lng: lon, radius })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Success! Elements count:', data.elements?.length || 0);
      if (data._stats) {
        console.log('Stats:', data._stats);
      }
    } else {
      console.error('Request failed:', response.status, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testOsmFinal();
