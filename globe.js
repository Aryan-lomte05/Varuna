/**
 * VARUNA - 3D Earth Globe Engine with ARGO Float Telemetry & Hover Raycasting
 * Powered by Three.js — with Procedural Earth Texture & Color-coded Float Markers
 */

(function () {
  let scene, camera, renderer, globeGroup, earthMesh, gridMesh, atmosphereMesh, innerAtmosMesh;
  let floatsGroup, floatMeshes = [];
  let raycaster, mouse;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let zoomDistance = 2.8;
  let animFrameId = null;

  // Initialize Globe
  window.initVarunaGlobe = function (argoDataset, onSelectFloat) {
    const container = document.getElementById('globe-container');
    if (!container) return;

    // Destroy previous instance if re-init
    if (animFrameId) cancelAnimationFrame(animFrameId);
    while (container.firstChild) container.removeChild(container.firstChild);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    scene = new THREE.Scene();
    scene.background = null;
    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.z = zoomDistance;

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Lighting - sun + ambient + dark back
    const ambientLight = new THREE.AmbientLight(0x334466, 0.7);
    scene.add(ambientLight);

    // Primary sun from upper right
    const sunLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Cyan accent from camera side
    const cyanFill = new THREE.DirectionalLight(0x1affe8, 0.6);
    cyanFill.position.set(-3, 1, 4);
    scene.add(cyanFill);

    // Night side dark blue
    const nightLight = new THREE.DirectionalLight(0x001133, 0.8);
    nightLight.position.set(-6, -2, -5);
    scene.add(nightLight);

    // 4. Globe Group — rotated to center Indian Ocean
    globeGroup = new THREE.Group();
    globeGroup.rotation.y = -1.2;
    globeGroup.rotation.x = 0.22;
    scene.add(globeGroup);

    // 5. Procedural Earth Texture using canvas
    const earthTexture = createEarthTexture();

    // 6. Earth Sphere with realistic colors
    const sphereGeo = new THREE.SphereGeometry(1, 96, 96);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      specularMap: createSpecularMap(),
      specular: new THREE.Color(0x1a3d5c),
      shininess: 18,
      emissive: new THREE.Color(0x000511),
      emissiveIntensity: 0.15,
    });
    earthMesh = new THREE.Mesh(sphereGeo, earthMat);
    globeGroup.add(earthMesh);

    // 7. Thin latitude/longitude grid overlay
    const gridGeo = new THREE.SphereGeometry(1.006, 36, 36);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x2ee6c6,
      wireframe: true,
      transparent: true,
      opacity: 0.06
    });
    gridMesh = new THREE.Mesh(gridGeo, gridMat);
    globeGroup.add(gridMesh);

    // 8. Inner atmosphere glow (blue halo)
    const innerAtmosGeo = new THREE.SphereGeometry(1.018, 48, 48);
    const innerAtmosMat = new THREE.MeshBasicMaterial({
      color: 0x1a9fe0,
      transparent: true,
      opacity: 0.08,
      side: THREE.FrontSide
    });
    innerAtmosMesh = new THREE.Mesh(innerAtmosGeo, innerAtmosMat);
    globeGroup.add(innerAtmosMesh);

    // 9. Outer cyan atmosphere (Fresnel-like halo from BackSide)
    const outerAtmosGeo = new THREE.SphereGeometry(1.06, 48, 48);
    const outerAtmosMat = new THREE.MeshBasicMaterial({
      color: 0x2ee6c6,
      transparent: true,
      opacity: 0.10,
      side: THREE.BackSide
    });
    atmosphereMesh = new THREE.Mesh(outerAtmosGeo, outerAtmosMat);
    globeGroup.add(atmosphereMesh);

    // 10. Stars background
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 400;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, sizeAttenuation: true });
    scene.add(new THREE.Points(starsGeo, starsMat));

    // 11. ARGO Float Markers
    floatsGroup = new THREE.Group();
    globeGroup.add(floatsGroup);
    floatMeshes = [];

    raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.05 };
    mouse = new THREE.Vector2(-10, -10);

    createFloatMarkers(argoDataset);

    // 12. Event Listeners
    setupInteractions(container, argoDataset, onSelectFloat);

    // 13. Animation Loop
    function animate() {
      animFrameId = requestAnimationFrame(animate);

      if (!isDragging) {
        globeGroup.rotation.y += 0.0005;
      }

      // Pulse anomaly floats
      const time = Date.now() * 0.003;
      floatMeshes.forEach(item => {
        if (item.data.isAnomaly) {
          const s = 1 + Math.sin(time + item.data.idNumber * 0.1) * 0.35;
          item.mesh.scale.set(s, s, s);
        }
      });

      // Subtle atmosphere pulse
      if (atmosphereMesh) {
        atmosphereMesh.material.opacity = 0.08 + Math.sin(time * 0.5) * 0.02;
      }

      renderer.render(scene, camera);
    }
    animate();

    // Responsive resize
    window.addEventListener('resize', () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
  };

  // ─── Procedural Earth Texture ────────────────────────────────────────────
  function createEarthTexture() {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d');

    // Deep ocean base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGrad.addColorStop(0, '#0a1f3a');
    oceanGrad.addColorStop(0.5, '#0d2644');
    oceanGrad.addColorStop(1, '#071830');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ocean depth variation (subtle noise-like patches)
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 20 + Math.random() * 80;
      const alpha = 0.03 + Math.random() * 0.07;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(20,80,140,${alpha})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw simplified landmasses by painting continent regions
    ctx.fillStyle = '#2d4a1e';

    // Helper: draw continent ellipse region
    function continent(cx, cy, rx, ry, angle = 0, color = '#2a4520') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.scale(rx, ry);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Africa (greenish-brown)
    continent(1010, 260, 95, 150, 0.1, '#3a5c28');
    // Mountain range highlights Africa
    continent(1000, 200, 40, 30, 0, '#4a6c35');
    continent(1030, 350, 55, 60, -0.2, '#4a6030');

    // Europe
    continent(950, 140, 50, 40, 0.3, '#3d5a2a');
    continent(960, 110, 30, 25, 0.1, '#3d5a2a');

    // Asia – large mass
    continent(1200, 150, 200, 100, 0.05, '#3a5822');
    continent(1350, 120, 120, 70, 0, '#2d4a1e');
    // India subcontinent – key landmark
    continent(1200, 230, 50, 70, 0.1, '#3a5828');
    // Southeast Asia
    continent(1380, 230, 60, 50, -0.1, '#2d4a1e');

    // North America
    continent(300, 150, 120, 120, -0.2, '#3a5520');
    continent(250, 200, 80, 80, 0, '#334d1e');

    // South America
    continent(380, 310, 70, 130, 0.1, '#3d5a28');

    // Australia
    continent(1520, 310, 80, 60, -0.1, '#5a4a25');
    // Australia desert reddish tint overlay
    continent(1525, 315, 55, 40, -0.1, '#6b4f28');

    // Greenland/Arctic
    continent(430, 80, 55, 35, 0, '#8ab4c8');
    // Antarctica
    ctx.fillStyle = '#b0ccd6';
    ctx.fillRect(0, canvas.height - 35, canvas.width, 35);

    // Add subtle coastal shine
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 5 + Math.random() * 15;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(100,220,200,0.06)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  function createSpecularMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d');
    // Oceans are shiny (white = specular), land is dark (no specular)
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Rough land patches (dark = no specular)
    ctx.fillStyle = '#222222';
    // Repaint approximate land mask very roughly
    function land(cx, cy, rx, ry) {
      ctx.save(); ctx.translate(cx * (size / 2048), cy * (size / 512));
      ctx.scale(rx * (size / 2048), ry * (size / 512));
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore();
      ctx.fill();
    }
    land(1010, 260, 95, 150); land(950, 140, 50, 40); land(1200, 150, 200, 100);
    land(1350, 120, 120, 70); land(300, 150, 120, 120); land(380, 310, 70, 130);
    land(1520, 310, 80, 60); land(1200, 230, 50, 70);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  // ─── Lat/Lon to 3D Vector ────────────────────────────────────────────────
  function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  // ─── Color-coded ARGO Float Markers ─────────────────────────────────────
  // Color by water body region:
  //   Arabian Sea  → Electric Cyan #2ee6c6
  //   Bay of Bengal → Soft Purple #a78bfa
  //   Equatorial IO → Lime Green #4ade80
  //   Lakshadweep   → Amber #fb923c
  //   Andaman Sea   → Sky Blue #38bdf8
  //   CRITICAL override → Red #ff4d4d
  //   WARNING override  → Orange #ffa500
  const REGION_COLORS = {
    'Arabian Sea':              0x2ee6c6,
    'Bay of Bengal':            0xa78bfa,
    'Equatorial Indian Ocean':  0x4ade80,
    'Lakshadweep Sea':          0xfb923c,
    'Andaman Sea':              0x38bdf8,
  };

  function createFloatMarkers(dataset) {
    const pinGeo = new THREE.SphereGeometry(0.014, 12, 12);

    dataset.forEach(item => {
      let colorHex = REGION_COLORS[item.region] || 0x00ffc6;
      if (item.status === 'CRITICAL') colorHex = 0xff4d4d;
      else if (item.status === 'WARNING') colorHex = 0xffa500;

      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(pinGeo, mat);

      const pos = latLonToVector3(item.lat, item.lon, 1.016);
      mesh.position.copy(pos);
      mesh.userData = item;

      // Spike/stem outward
      mesh.lookAt(new THREE.Vector3(0, 0, 0));

      floatsGroup.add(mesh);
      floatMeshes.push({ mesh, data: item });
    });
  }

  // ─── Interactions ────────────────────────────────────────────────────────
  function setupInteractions(container, dataset, onSelectFloat) {
    const tooltip = document.getElementById('hover-tooltip');

    container.addEventListener('mousedown', e => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    container.addEventListener('mousemove', e => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - previousMousePosition.x;
        const dy = e.clientY - previousMousePosition.y;
        globeGroup.rotation.y += dx * 0.005;
        globeGroup.rotation.x += dy * 0.005;
        previousMousePosition = { x: e.clientX, y: e.clientY };
        if (tooltip) tooltip.style.display = 'none';
        return;
      }

      // Raycasting hover
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(floatsGroup.children);

      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const fd = hitMesh.userData;
        container.style.cursor = 'pointer';
        hitMesh.scale.set(2.2, 2.2, 2.2);

        if (tooltip && fd) {
          tooltip.style.display = 'block';
          tooltip.style.left = `${e.clientX + 18}px`;
          tooltip.style.top = `${Math.max(80, e.clientY - 80)}px`;

          document.getElementById('tt-id').textContent = fd.id;
          document.getElementById('tt-region').textContent = fd.region;
          document.getElementById('tt-latlon').textContent =
            `${Math.abs(fd.lat).toFixed(2)}°${fd.lat >= 0 ? 'N' : 'S'}, ${Math.abs(fd.lon).toFixed(2)}°${fd.lon >= 0 ? 'E' : 'W'}`;
          document.getElementById('tt-temp').textContent =
            `${fd.temp.toFixed(1)}°C (${fd.tempAnomaly > 0 ? '+' : ''}${fd.tempAnomaly.toFixed(1)}°C)`;
          document.getElementById('tt-salinity').textContent = `${fd.salinity.toFixed(1)} PSU`;
          document.getElementById('tt-doxy').textContent = `${fd.doxy.toFixed(1)} µmol/kg`;

          const chlaEl = document.getElementById('tt-chla');
          if (chlaEl) chlaEl.textContent = `${fd.chla.toFixed(2)} mg/m³`;

          document.getElementById('tt-species').textContent = fd.species;

          const statusBadge = document.getElementById('tt-status');
          if (statusBadge) {
            statusBadge.textContent = fd.status;
            statusBadge.style.color = fd.status === 'CRITICAL' ? '#ff4d4d'
              : fd.status === 'WARNING' ? '#ffa500' : '#00ffc6';
          }
        }
      } else {
        container.style.cursor = isDragging ? 'grabbing' : 'grab';
        if (tooltip) tooltip.style.display = 'none';

        // Reset scales
        floatMeshes.forEach(item => {
          if (!item.data.isAnomaly) item.mesh.scale.set(1, 1, 1);
        });

        // Update lat/lon in HUD bottom bar
        const earthHits = raycaster.intersectObject(earthMesh);
        if (earthHits.length > 0) {
          const point = earthHits[0].point.clone().applyMatrix4(
            globeGroup.matrixWorld.clone().invert()
          );
          const sph = new THREE.Spherical().setFromVector3(point);
          const lat = 90 - (sph.phi * 180 / Math.PI);
          const lon = (sph.theta * 180 / Math.PI) - 180;
          const latEl = document.getElementById('hud-live-lat');
          const lonEl = document.getElementById('hud-live-lon');
          if (latEl) latEl.textContent = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
          if (lonEl) lonEl.textContent = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
        }
      }
    });

    // Zoom via wheel
    container.addEventListener('wheel', e => {
      e.preventDefault();
      zoomDistance += e.deltaY * 0.0015;
      zoomDistance = Math.max(1.5, Math.min(5.0, zoomDistance));
      camera.position.z = zoomDistance;

      const zoomEl = document.getElementById('hud-zoom-level');
      if (zoomEl) {
        const pct = Math.round(((5.0 - zoomDistance) / 3.5) * 100);
        zoomEl.textContent = `${pct}%`;
      }
    }, { passive: false });

    // Click to open modal
    container.addEventListener('click', () => {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(floatsGroup.children);
      if (hits.length > 0 && onSelectFloat) {
        onSelectFloat(hits[0].object.userData);
      }
    });

    // UI zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      zoomDistance = Math.max(1.5, zoomDistance - 0.4);
      camera.position.z = zoomDistance;
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      zoomDistance = Math.min(5.0, zoomDistance + 0.4);
      camera.position.z = zoomDistance;
    });
    document.getElementById('btn-reset-view')?.addEventListener('click', () => {
      zoomDistance = 2.8;
      camera.position.z = zoomDistance;
      globeGroup.rotation.set(0.22, -1.2, 0);
    });
  }
})();
