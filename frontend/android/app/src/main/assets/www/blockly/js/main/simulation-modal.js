// =====================================================================
// THREE.JS SIMULATION MODAL (10 simulations)
// =====================================================================
var currentSimBlock = null, currentSimType = '', simSpeed = 50;
var simScene, simCamera, simRenderer, simAnimId, simObjects = [];
var SIM_META = {
  sim_solar: { title: "Solar System", desc: "Planets orbiting the sun", grad: "linear-gradient(135deg,#f59e0b,#ef4444)" },
  sim_pendulum: { title: "Pendulum", desc: "Swinging pendulum physics", grad: "linear-gradient(135deg,#ef4444,#b91c1c)" },
  sim_particles: { title: "Particles", desc: "Particle fountain effect", grad: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  sim_dna: { title: "DNA Helix", desc: "Double helix rotation", grad: "linear-gradient(135deg,#06b6d4,#0891b2)" },
  sim_gears: { title: "Gear System", desc: "Interlocking gears spinning", grad: "linear-gradient(135deg,#64748b,#475569)" },
  sim_wave: { title: "Wave Surface", desc: "Animated sine wave mesh", grad: "linear-gradient(135deg,#0ea5e9,#0284c7)" },
  sim_bouncing: { title: "Bouncing Balls", desc: "Physics bouncing simulation", grad: "linear-gradient(135deg,#f97316,#ea580c)" },
  sim_windmill: { title: "Wind Turbine", desc: "Spinning turbine blades", grad: "linear-gradient(135deg,#22c55e,#16a34a)" },
  sim_atom: { title: "Atom Model", desc: "Electron orbit simulation", grad: "linear-gradient(135deg,#a855f7,#7c3aed)" },
  sim_globe: { title: "Earth Globe", desc: "Rotating wireframe globe", grad: "linear-gradient(135deg,#3b82f6,#2563eb)" }
};

function openSimModal(block, simType) {
  currentSimBlock = block; currentSimType = simType;
  simSpeed = parseInt(block.getFieldValue('SIM_SPEED') || '50');
  document.getElementById('simSpeedSlider').value = simSpeed;
  document.getElementById('simSpeedVal').textContent = simSpeed;
  var m = SIM_META[simType] || { title: simType, desc: '3D', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' };
  document.getElementById('simTitle').textContent = m.title;
  document.getElementById('simDesc').textContent = m.desc;
  document.getElementById('simHeader').style.background = m.grad;
  document.getElementById('simModal').style.display = 'flex';
  setTimeout(function () { initSimScene(simType); }, 60);
}
function closeSimModal() {
  document.getElementById('simModal').style.display = 'none'; currentSimBlock = null;
  if (simAnimId) cancelAnimationFrame(simAnimId);
  if (simRenderer) { simRenderer.dispose(); document.getElementById('simCanvas').innerHTML = ''; simRenderer = null; }
  simObjects = [];
}
function saveSimModal() {
  if (!currentSimBlock) { closeSimModal(); return; }
  currentSimBlock.setFieldValue(simSpeed.toString(), 'SIM_SPEED');
  closeSimModal();
}
function onSimSpeedChange(v) { simSpeed = parseInt(v); document.getElementById('simSpeedVal').textContent = v; }

function initSimScene(simType) {
  var c = document.getElementById('simCanvas'); c.innerHTML = '';
  simScene = new THREE.Scene(); simScene.background = new THREE.Color(0x0f172a);
  simCamera = new THREE.PerspectiveCamera(50, c.clientWidth / c.clientHeight, 0.1, 1000);
  simCamera.position.set(0, 3, 6); simCamera.lookAt(0, 0, 0);
  simRenderer = new THREE.WebGLRenderer({ antialias: true });
  simRenderer.setSize(c.clientWidth, c.clientHeight);
  simRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  c.appendChild(simRenderer.domElement);
  simScene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 5, 5); simScene.add(dl);
  simScene.add(new THREE.GridHelper(8, 16, 0x1e293b, 0x0f172a));
  simObjects = [];
  var isDrag = false, pX = 0, pY = 0, rX = 0.4, rY = 0;
  c.onpointerdown = function (e) { isDrag = true; pX = e.clientX; pY = e.clientY; c.setPointerCapture(e.pointerId); };
  c.onpointermove = function (e) { if (!isDrag) return; rY += (e.clientX - pX) * 0.01; rX += (e.clientY - pY) * 0.01; rX = Math.max(-1.2, Math.min(1.2, rX)); pX = e.clientX; pY = e.clientY; simCamera.position.set(6 * Math.sin(rY) * Math.cos(rX), 6 * Math.sin(rX) + 2, 6 * Math.cos(rY) * Math.cos(rX)); simCamera.lookAt(0, 0, 0); };
  c.onpointerup = function () { isDrag = false; };
  buildSim(simType); animateSim();
}

function buildSim(type) {
  var i, m, g;
  switch (type) {
    case 'sim_solar':
      simScene.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5 })));
      [{ r: 1.2, s: 0.1, c: 0x94a3b8, sp: 2 }, { r: 1.7, s: 0.15, c: 0x3b82f6, sp: 1.2 }, { r: 2.3, s: 0.12, c: 0xef4444, sp: 0.8 }, { r: 3, s: 0.3, c: 0xd4a574, sp: 0.4 }, { r: 3.7, s: 0.22, c: 0x06b6d4, sp: 0.3 }].forEach(function (p) {
        m = new THREE.Mesh(new THREE.SphereGeometry(p.s, 16, 16), new THREE.MeshStandardMaterial({ color: p.c }));
        m._oR = p.r; m._oS = p.sp; m._a = Math.random() * 6.28; simScene.add(m); simObjects.push(m);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.005, 8, 64), new THREE.MeshBasicMaterial({ color: 0x1e293b })); ring.rotation.x = Math.PI / 2; simScene.add(ring);
      }); break;
    case 'sim_pendulum':
      simScene.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshStandardMaterial({ color: 0x94a3b8 })));
      var pg = new THREE.Group();
      pg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3, 8), new THREE.MeshStandardMaterial({ color: 0x64748b })));
      pg.children[0].position.y = -1.5;
      var bob = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 32), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 }));
      bob.position.y = -3; pg.add(bob); pg.position.y = 3; pg._a = 0.8; pg._v = 0;
      simScene.add(pg); simObjects.push(pg); simObjects._t = 'pend'; break;
    case 'sim_particles':
      for (i = 0; i < 80; i++) { m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random() * 0.15 + 0.75, 0.8, 0.6) })); m._vx = (Math.random() - 0.5) * 0.08; m._vy = Math.random() * 0.12 + 0.05; m._vz = (Math.random() - 0.5) * 0.08; m._life = Math.random() * 60; simScene.add(m); simObjects.push(m); } simObjects._t = 'part'; break;
    case 'sim_dna':
      for (i = 0; i < 40; i++) { var a = (i / 40) * Math.PI * 4; var s1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0x06b6d4 })); var s2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0xf43f5e })); s1.position.set(Math.cos(a) * 1.2, i * 0.15 - 3, Math.sin(a) * 1.2); s2.position.set(Math.cos(a + Math.PI) * 1.2, i * 0.15 - 3, Math.sin(a + Math.PI) * 1.2); simScene.add(s1); simScene.add(s2); if (i % 4 === 0) { var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 })); bar.position.set(0, i * 0.15 - 3, 0); bar.rotation.z = Math.PI / 2; bar.rotation.y = a; simScene.add(bar); } simObjects.push(s1); simObjects.push(s2); } simObjects._t = 'dna'; break;
    case 'sim_gears':
      for (i = 0; i < 3; i++) { var gg = new THREE.Group(); gg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7 + i * 0.4, 0.7 + i * 0.4, 0.3, 12 + i * 4), new THREE.MeshStandardMaterial({ color: i === 0 ? 0x64748b : i === 1 ? 0x94a3b8 : 0x475569, metalness: 0.7, roughness: 0.2 }))); gg.children[0].rotation.x = Math.PI / 2; gg.position.x = i === 0 ? -1.5 : i === 1 ? 0 : 1.5; gg.position.y = 1; gg._sp = i === 1 ? -1 : 1; gg._gr = 1 / (1 + i * 0.3); simScene.add(gg); simObjects.push(gg); } break;
    case 'sim_wave':
      m = new THREE.Mesh(new THREE.PlaneGeometry(8, 8, 40, 40), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.7 })); m.rotation.x = -Math.PI / 2; simScene.add(m); simObjects.push(m); simObjects._t = 'wave'; break;
    case 'sim_bouncing':
      simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x1e293b }))); simScene.children[simScene.children.length - 1].rotation.x = -Math.PI / 2; simScene.children[simScene.children.length - 1].position.y = -0.01;
      for (i = 0; i < 8; i++) { m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i / 8, 0.7, 0.5), metalness: 0.3, roughness: 0.4 })); m.position.set((i - 3.5) * 0.8, 2 + Math.random() * 3, 0); m._vy = 0; m._bn = 0.8; simScene.add(m); simObjects.push(m); } simObjects._t = 'bounce'; break;
    case 'sim_windmill':
      simScene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 4, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }))); simScene.children[simScene.children.length - 1].position.y = 2;
      simScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }))); simScene.children[simScene.children.length - 1].position.y = 4;
      var bg2 = new THREE.Group(); for (i = 0; i < 3; i++) { var bl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xfafafa })); bl.position.y = 1.1; var bgg = new THREE.Group(); bgg.add(bl); bgg.rotation.z = (i / 3) * Math.PI * 2; bg2.add(bgg); } bg2.position.set(0, 4, 0.2); simScene.add(bg2); simObjects.push(bg2); break;
    case 'sim_atom':
      simScene.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 32), new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.3 })));
      for (i = 0; i < 3; i++) { var orb = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.5, 0.008, 8, 64), new THREE.MeshBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.3 })); orb.rotation.x = Math.PI / 2 + i * 0.6; orb.rotation.y = i * 1.0; simScene.add(orb); var el = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.6 })); el._oR = 1.4 + i * 0.5; el._oS = 2 - i * 0.4; el._a = i * 2; el._tX = Math.PI / 2 + i * 0.6; el._tY = i * 1.0; simScene.add(el); simObjects.push(el); } simObjects._t = 'atom'; break;
    case 'sim_globe':
      m = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 24), new THREE.MeshStandardMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.4 })); simScene.add(m); simObjects.push(m);
      simScene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 5, 8), new THREE.MeshBasicMaterial({ color: 0x6b7280 })));
      for (i = 0; i < 6; i++) { var lt = new THREE.Mesh(new THREE.TorusGeometry(2 * Math.cos((i - 2.5) * 0.5), 0.008, 8, 64), new THREE.MeshBasicMaterial({ color: 0x1e40af, transparent: true, opacity: 0.3 })); lt.position.y = 2 * Math.sin((i - 2.5) * 0.5); simScene.add(lt); } break;
  }
}

function animateSim() {
  simAnimId = requestAnimationFrame(animateSim);
  var t = Date.now() * 0.001, spd = simSpeed / 50;
  switch (currentSimType) {
    case 'sim_solar': simObjects.forEach(function (p) { if (p._oR) { p._a += p._oS * 0.01 * spd; p.position.set(Math.cos(p._a) * p._oR, 0, Math.sin(p._a) * p._oR); p.rotation.y += 0.02 * spd; } }); break;
    case 'sim_pendulum': if (simObjects[0]) { var dt = 0.016 * spd; simObjects[0]._v -= (9.8 / 3) * Math.sin(simObjects[0]._a) * dt; simObjects[0]._v *= 0.999; simObjects[0]._a += simObjects[0]._v * dt; simObjects[0].rotation.z = simObjects[0]._a; } break;
    case 'sim_particles': simObjects.forEach(function (p) { if (p._vx !== undefined) { p._life++; if (p._life > 60) { p.position.set(0, 0, 0); p._vy = Math.random() * 0.12 + 0.05; p._vx = (Math.random() - 0.5) * 0.08; p._vz = (Math.random() - 0.5) * 0.08; p._life = 0; } p.position.x += p._vx * spd; p.position.y += p._vy * spd; p.position.z += p._vz * spd; p._vy -= 0.002 * spd; } }); break;
    case 'sim_dna': simObjects.forEach(function (s) { s.position.y += 0.005 * spd; if (s.position.y > 3) s.position.y -= 6; }); break;
    case 'sim_gears': simObjects.forEach(function (g) { if (g._sp !== undefined) g.rotation.z += 0.02 * g._sp * g._gr * spd; }); break;
    case 'sim_wave': if (simObjects[0] && simObjects[0].geometry) { var pos = simObjects[0].geometry.attributes.position; for (var i = 0; i < pos.count; i++) { pos.setZ(i, Math.sin(pos.getX(i) * 1.5 + t * 2 * spd) * Math.cos(pos.getY(i) * 1.5 + t * 2 * spd) * 0.5); } pos.needsUpdate = true; } break;
    case 'sim_bouncing': simObjects.forEach(function (b) { if (b._vy !== undefined) { b._vy -= 0.005 * spd; b.position.y += b._vy * spd; if (b.position.y < 0.22) { b.position.y = 0.22; b._vy = Math.abs(b._vy) * b._bn; } } }); break;
    case 'sim_windmill': if (simObjects[0]) simObjects[0].rotation.z += 0.03 * spd; break;
    case 'sim_atom': simObjects.forEach(function (e) { if (e._oR) { e._a += e._oS * 0.02 * spd; var x = Math.cos(e._a) * e._oR, y = Math.sin(e._a) * e._oR; var v = new THREE.Vector3(x, 0, y); v.applyAxisAngle(new THREE.Vector3(1, 0, 0), e._tX); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), e._tY); e.position.copy(v); } }); break;
    case 'sim_globe': if (simObjects[0]) simObjects[0].rotation.y += 0.005 * spd; break;
  }
  if (simRenderer && simScene && simCamera) simRenderer.render(simScene, simCamera);
}

