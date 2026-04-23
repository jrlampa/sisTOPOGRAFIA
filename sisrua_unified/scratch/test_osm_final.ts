
async function testOsm() {
  const lat = -22.758878;
  const lon = -42.881869;
  const radius = 500;
  const apiBaseUrl = 'http://localhost:3001/api';

  console.log(`Testing OSM Proxy for lat=${lat}, lon=${lon}, radius=${radius}...`);
  
  try {
    const response = await fetch(`${apiBaseUrl}/osm?lat=${lat}&lng=${lon}&radius=${radius}`);
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

testOsm();
