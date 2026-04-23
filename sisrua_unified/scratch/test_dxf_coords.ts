
import { GeoLocation } from '../src/types';

async function testDxfAndAnalysis() {
  const lat = -22.758878;
  const lon = -42.881869;
  const radius = 2000;
  const apiBaseUrl = 'http://localhost:3001/api';

  console.log(`Starting DXF generation and analysis test...`);
  console.log(`Coords: ${lat}, ${lon} | Radius: ${radius}m`);

  try {
    // 1. Trigger DXF generation
    console.log('\n--- Step 1: Triggering DXF Generation ---');
    const dxfResponse = await fetch(`${apiBaseUrl}/dxf`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': 'system-admin'
      },
      body: JSON.stringify({
        lat,
        lon,
        radius,
        mode: 'circle',
        layers: {
          buildings: true,
          roads: true,
          nature: true,
          contours: true
        }
      })
    });

    if (!dxfResponse.ok) {
      throw new Error(`DXF trigger failed: ${dxfResponse.status} ${await dxfResponse.text()}`);
    }

    const dxfData = await dxfResponse.json() as { jobId?: string, status: string, url?: string };
    console.log('DXF Response:', dxfData);

    if (dxfData.status === 'queued' && dxfData.jobId) {
      console.log(`Job queued with ID: ${dxfData.jobId}. Waiting for completion...`);
      
      // Poll for status
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5s interval
      
      while (attempts < maxAttempts) {
        attempts++;
        const statusResponse = await fetch(`${apiBaseUrl}/jobs/${dxfData.jobId}`);
        const statusData = await statusResponse.json() as { status: string, progress: number, error?: string, result?: any };
        
        console.log(`Attempt ${attempts}: Status=${statusData.status}, Progress=${statusData.progress}%`);
        
        if (statusData.status === 'completed') {
          console.log('DXF Job completed successfully!');
          console.log('Result:', statusData.result);
          break;
        } else if (statusData.status === 'failed') {
          throw new Error(`DXF Job failed: ${statusData.error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } else if (dxfData.status === 'success') {
      console.log('DXF was already cached or generated instantly.');
      console.log('URL:', dxfData.url);
    }

    // 2. Trigger Analysis
    console.log('\n--- Step 2: Triggering AI Analysis ---');
    // We need some stats for analysis. Let's fetch OSM data first to get stats.
    const osmResponse = await fetch(`${apiBaseUrl}/osm`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': 'test-verification-user'
      },
      body: JSON.stringify({ lat, lng: lon, radius })
    });
    
    if (!osmResponse.ok) {
       console.warn(`OSM fetch failed (might be too many elements for proxy): ${osmResponse.status}`);
    } else {
      const osmData = await osmResponse.json();
      const stats = osmData._stats || { totalBuildings: 0, totalRoads: 0 };
      
      const analysisResponse = await fetch(`${apiBaseUrl}/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': 'test-verification-user'
        },
        body: JSON.stringify({ 
          stats, 
          locationName: `Teste Coords ${lat}, ${lon}` 
        })
      });

      if (!analysisResponse.ok) {
        console.error(`Analysis failed: ${analysisResponse.status} ${await analysisResponse.text()}`);
      } else {
        const analysisData = await analysisResponse.json();
        console.log('Analysis Result:', analysisData.analysis);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDxfAndAnalysis();
