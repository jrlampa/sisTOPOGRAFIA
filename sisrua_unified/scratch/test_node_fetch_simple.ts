
async function testFetchSimple() {
  const lat = -22.758878;
  const lon = -42.881869;
  const radius = 100;
  const query = `[out:json][timeout:60];(node(around:${radius},${lat},${lon});way(around:${radius},${lat},${lon});rel(around:${radius},${lat},${lon}););out body geom qt;`;

  const endpoint = "https://overpass-api.de/api/interpreter";

  console.log(`Testing SIMPLE GET directly from Node...`);
  
  try {
    const response = await fetch(
      `${endpoint}?data=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          "User-Agent": "curl/8.4.0",
        },
      }
    );

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response (first 200 chars):', text.substring(0, 200));
    
    try {
        const json = JSON.parse(text);
        console.log('Success! Elements:', json.elements?.length);
    } catch (e) {
        console.error('Failed to parse JSON');
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testFetchSimple();
