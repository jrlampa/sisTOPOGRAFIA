
import { fetchWithCircuitBreaker } from '../server/utils/externalApi.js';

async function testFetch() {
  const lat = -22.758878;
  const lon = -42.881869;
  const radius = 100;
  const query = `[out:json][timeout:60];(node(around:${radius},${lat},${lon});way(around:${radius},${lat},${lon});rel(around:${radius},${lat},${lon}););out body geom qt;`;
  const body = new URLSearchParams();
  body.append("data", query);

  const endpoint = "https://overpass-api.de/api/interpreter";

  console.log(`Testing Fetch directly from Node...`);
  
  try {
    const response = await fetchWithCircuitBreaker(
      "TEST_CB",
      endpoint,
      {
        method: "POST",
        body: body,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
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

testFetch();
