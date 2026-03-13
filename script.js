
// // This array holds all the data for your floats.
// const floatsData = [
//     {
//       id: 4903660,
//       status: 'active',
//       location: '35.80°N, 40.20°W',
//       lastUpdate: 'Sep 26, 2025'
//     },
//     {
//       id: 4903661,
//       status: 'active',
//       location: '34.15°N, 39.88°W',
//       lastUpdate: 'Sep 27, 2025'
//     },
//     {
//       id: 4903234,
//       status: 'inactive',
//       location: '37.05°N, 41.12°W',
//       lastUpdate: 'Sep 22, 2025'
//     },
//     {
//         id: 4903614,
//         status: 'active',
//         location: '39.05°N, 47.12°W',
//         lastUpdate: 'Sep 29, 2025'
//     }
//     // ...and so on for hundreds of floats
//   ];

// const container=document.getElementById("float-container");

// floatsData.forEach(float=>{
//      const cardHTML=`<a href="/path/to/float/${float.id}" class="float-card-link">
//       <article class="float-card">
//             <div class="card-header">
//             <h2>Float ${float.id}</h2>
//             <span class="status-badge ${float.status}">${float.status}</span>
//             </div>
//             <div class="card-details">
//             <p>📍 ${float.location}</p>
//             <p>🗓️ ${float.lastUpdate}</p>
//             </div>
//             <div class="action-icon-container"></div>
//       </article>
//     </a>
//    `;
//    container.innerHTML += cardHTML;
// });

// // // Handle Tab Switching
// // function openTab(evt, tabId) {
// //     let tabPanels = document.getElementsByClassName("tab-panel");
// //     for (let i = 0; i < tabPanels.length; i++) {
// //       tabPanels[i].classList.remove("active");
// //     }
  
// //     let tabBtns = document.getElementsByClassName("tab-btn");
// //     for (let i = 0; i < tabBtns.length; i++) {
// //       tabBtns[i].classList.remove("active");
// //     }
  
// //     document.getElementById(tabId).classList.add("active");
// //     evt.currentTarget.classList.add("active");
// //   }
  
// //   // Back button (go to dashboard)
// //   function goBack() {
// //     window.history.back();
// //   }

// var map = L.map('map-container').setView([19.0760, 72.8777], 13);

// // Add a tile layer
// // New Esri World Imagery Layer
// L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
//     attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
// }).addTo(map);

// // Add a marker with a popup
// L.marker([19.0760, 72.8777]).addTo(map)
//     .bindPopup('<b>Hello Mumbai!</b><br>Welcome to the Gateway of India.')
//     .openPopup();
    
// // Example of drawing a circle
// var circle = L.circle([19.0886, 72.8681], { // Chhatrapati Shivaji Maharaj Int'l Airport
//     color: 'red',
//     fillColor: '#f03',
//     fillOpacity: 0.5,
//     radius: 2000
// }).addTo(map).bindPopup("This is the airport area.");

// --- 1. INITIALIZE CLIENTS ---
const SUPABASE_URL = 'https://nskcjldhwowefenrnkfl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5za2NqbGRod293ZWZlbnJua2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDA1MzIsImV4cCI6MjA3Mjg3NjUzMn0.LqWo0u5SWTXHD8orJ7KrLCNhuSaYvGpIWm4GmuGRf4I';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const map = L.map('map-container').setView([0, 0], 2);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}).addTo(map);

// --- 2. DATA FETCHING FUNCTION ---
async function getFloatsData() {
  const { data, error } = await supabaseClient.rpc('get_latest_float_data',{});
  if (error) {
    console.error('Error fetching data:', error);
    return [];
  }
  return data;
}

// --- 3. MAIN FUNCTION TO BUILD THE PAGE ---
async function main() {
  const floatContainer = document.getElementById('float-container');
  const floats = await getFloatsData();

  if (floats.length === 0) {
    floatContainer.innerHTML = '<p>No float data found.</p>';
    return;
  }
  floatContainer.innerHTML = ''; // Clear "Loading..." message
  
  floats.forEach(float => {
    // Create the float card
    const cardHTML = `
      <a href="detail.html?id=${float.id}" class="float-card-link">
        <article class="float-card">
          <h4>Float ${float.id}</h4>
          <p>📍 Location: ${float.latitude.toFixed(4)}, ${float.longitude.toFixed(4)}</p>
          <p>🗓️ Last Update: ${new Date(float.last_update).toLocaleString()}</p>
        </article>
      </a>
    `;
    floatContainer.innerHTML += cardHTML;
    
    // Create the map marker
    L.marker([float.latitude, float.longitude])
      .addTo(map)
      .bindPopup(`<b>Float ${float.id}</b><br>Last seen: ${new Date(float.last_update).toLocaleDateString()}`);
  });
}

// --- 4. RUN THE APP ---
main();
  
  