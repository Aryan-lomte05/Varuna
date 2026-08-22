/**
 * VARUNA - 3D Underwater Submersible Deep Dive Engine
 * Simulates ARGO Float hydrostatics at depth 0m to 2000m
 */

(function() {
  let scene, camera, renderer, floatGroup, marineSnow;
  let currentDepth = 1250; // default 1250m

  window.initUnderwaterScene = function() {
    const container = document.getElementById('underwater-canvas-container');
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene & Camera
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x021124, 0.08);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x0a2540, 1.2);
    scene.add(ambientLight);

    const godRayLight = new THREE.SpotLight(0x2ee6c6, 3.5);
    godRayLight.position.set(0, 8, 2);
    godRayLight.angle = Math.PI / 6;
    godRayLight.penumbra = 0.8;
    scene.add(godRayLight);

    const beaconLight = new THREE.PointLight(0xffa500, 2, 5);
    beaconLight.position.set(0, 0.5, 0);
    scene.add(beaconLight);

    // 4. Submersible ARGO Float 3D Mesh
    floatGroup = new THREE.Group();
    scene.add(floatGroup);

    // Float Main Cylinder Hull (Yellow/Black INCOIS Float)
    const hullGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.2, 24);
    const hullMat = new THREE.MeshPhongMaterial({
      color: 0xf5b041, // Yellow ARGO Hull
      specular: 0xffffff,
      shininess: 60
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    floatGroup.add(hull);

    // Sensor Antenna Top Cap
    const capGeo = new THREE.CylinderGeometry(0.08, 0.25, 0.6, 16);
    const capMat = new THREE.MeshPhongMaterial({ color: 0x1c2833 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 1.3;
    floatGroup.add(cap);

    // Antenna Probe Tip
    const probeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
    const probeMat = new THREE.MeshBasicMaterial({ color: 0x2ee6c6 });
    const probe = new THREE.Mesh(probeGeo, probeMat);
    probe.position.y = 1.8;
    floatGroup.add(probe);

    // Bottom Bladder Housing
    const bottomGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const bottomMat = new THREE.MeshPhongMaterial({ color: 0x283747 });
    const bottom = new THREE.Mesh(bottomGeo, bottomMat);
    bottom.position.y = -1.1;
    floatGroup.add(bottom);

    // 5. Marine Snow Particles
    const snowCount = 250;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 8;
      snowPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0x83ffe3,
      size: 0.04,
      transparent: true,
      opacity: 0.6
    });
    marineSnow = new THREE.Points(snowGeo, snowMat);
    scene.add(marineSnow);

    // 6. Animation Loop
    let time = 0;
    function animate() {
      requestAnimationFrame(animate);
      time += 0.02;

      // Gentle hydrostatic drift & rotation
      floatGroup.position.y = Math.sin(time * 0.7) * 0.15;
      floatGroup.rotation.y = Math.sin(time * 0.3) * 0.2;
      floatGroup.rotation.z = Math.cos(time * 0.5) * 0.05;

      // Animate marine snow drift
      const positions = marineSnow.geometry.attributes.position.array;
      for (let i = 0; i < snowCount; i++) {
        positions[i * 3 + 1] -= 0.005;
        if (positions[i * 3 + 1] < -4) positions[i * 3 + 1] = 4;
      }
      marineSnow.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    }
    animate();

    // 7. Depth Slider Control setup
    setupDepthControls();
  };

  function setupDepthControls() {
    const slider = document.getElementById('deep-dive-depth-slider');
    if (!slider) return;

    slider.addEventListener('input', (e) => {
      currentDepth = parseInt(e.target.value);
      updateHydrostaticReadout(currentDepth);
    });

    updateHydrostaticReadout(currentDepth);
  }

  function updateHydrostaticReadout(depth) {
    const pressure = (depth * 1.0016).toFixed(1); // dbar approx equal to depth in meters
    const temp = (4 + (28.4 - 4) * Math.exp(-depth / 450)).toFixed(1);
    const doxy = Math.max(10, (48.2 + 30 * Math.sin(depth / 300))).toFixed(1);
    const salinity = (34.2 + (35.2 - 34.2) * Math.exp(-depth / 800)).toFixed(1);

    document.getElementById('dd-depth-val').textContent = `${depth} m`;
    document.getElementById('dd-pressure-val').textContent = `${pressure} dbar`;
    document.getElementById('dd-temp-val').textContent = `${temp} °C`;
    document.getElementById('dd-doxy-val').textContent = `${doxy} µmol/kg`;
    document.getElementById('dd-salinity-val').textContent = `${salinity} PSU`;

    // Update Mini Graph
    drawMiniSubsurfaceGraph(depth, parseFloat(temp), parseFloat(doxy));
  }

  function drawMiniSubsurfaceGraph(depth, temp, doxy) {
    const canvas = document.getElementById('deep-dive-mini-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth || 300;
    const h = canvas.height = 100;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Plot Temperature Curve
    ctx.beginPath();
    ctx.strokeStyle = '#2ee6c6';
    ctx.lineWidth = 2;

    for (let x = 0; x < w; x += 5) {
      const d = (x / w) * 2000;
      const t = 4 + (28.4 - 4) * Math.exp(-d / 450);
      const y = h - (t / 32) * h;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Active Depth Indicator Needle
    const activeX = (depth / 2000) * w;
    ctx.strokeStyle = '#ff4d4d';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(activeX, 0);
    ctx.lineTo(activeX, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
})();
