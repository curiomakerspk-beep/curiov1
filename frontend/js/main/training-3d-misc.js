// =====================================================================
// APP START
// =====================================================================

// =====================================================================
// 3D SPEEDOMETER — Modal Logic (Three.js)
// =====================================================================
var currentSpeedoBlock = null;
var speedo3DValue = 0;
var speedo3DTarget = 0;
var speedo3DScene, speedo3DCamera, speedo3DRenderer;
var speedo3DNeedle, speedo3DGlow, speedo3DArcs = [];
var speedo3DAnimId;

function openSpeedo3D(block) {
  currentSpeedoBlock = block;
  speedo3DTarget = parseInt(block.getFieldValue('SPEED_VAL') || '0');
  speedo3DValue = speedo3DTarget;
  document.getElementById('speedo3DSlider').value = speedo3DTarget;
  updateSpeedo3DUI();
  document.getElementById('speedo3DModal').style.display = 'flex';
  setTimeout(initSpeedo3DScene, 50);
}

function closeSpeedo3D() {
  document.getElementById('speedo3DModal').style.display = 'none';
  currentSpeedoBlock = null;
  if (speedo3DAnimId) cancelAnimationFrame(speedo3DAnimId);
  if (speedo3DRenderer) {
    speedo3DRenderer.dispose();
    document.getElementById('speedo3DCanvas').innerHTML = '';
    speedo3DRenderer = null;
  }
}

function saveSpeedo3D() {
  if (!currentSpeedoBlock) { closeSpeedo3D(); return; }
  currentSpeedoBlock.setFieldValue(speedo3DTarget.toString(), 'SPEED_VAL');
  var label = currentSpeedoBlock.getField('SPEED_LABEL');
  if (label) label.setValue(speedo3DTarget + '%');
  closeSpeedo3D();
}

function setSpeedo3D(val) {
  speedo3DTarget = val;
  document.getElementById('speedo3DSlider').value = val;
  updateSpeedo3DUI();
}

function onSpeedo3DSlider(val) {
  speedo3DTarget = parseInt(val);
  updateSpeedo3DUI();
}

function updateSpeedo3DUI() {
  document.getElementById('speedo3DValue').textContent = speedo3DTarget;
  document.getElementById('speedo3DSliderVal').textContent = speedo3DTarget + '%';
  document.querySelectorAll('.speedo3d-preset').forEach(function (b) {
    var v = parseInt(b.textContent);
    b.classList.toggle('active', v === speedo3DTarget);
  });
}

function initSpeedo3DScene() {
  var container = document.getElementById('speedo3DCanvas');
  container.innerHTML = '';
  var W = container.clientWidth, H = container.clientHeight;

  speedo3DScene = new THREE.Scene();
  speedo3DCamera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  speedo3DCamera.position.set(0, 0.5, 5.5);
  speedo3DCamera.lookAt(0, 0, 0);

  speedo3DRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  speedo3DRenderer.setSize(W, H);
  speedo3DRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  speedo3DRenderer.setClearColor(0x000000, 0);
  container.appendChild(speedo3DRenderer.domElement);

  speedo3DScene.add(new THREE.AmbientLight(0xffffff, 0.4));
  var d = new THREE.DirectionalLight(0xffffff, 0.6);
  d.position.set(2, 3, 5);
  speedo3DScene.add(d);
  speedo3DScene.add(new THREE.PointLight(0x10b981, 0.5, 10).position.set(-3, 1, 2) || new THREE.PointLight(0x10b981, 0.5, 10));

  // Bezel
  var bezel = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.15, 16, 64),
    new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8, roughness: 0.2 })
  );
  speedo3DScene.add(bezel);

  // Face
  var face = new THREE.Mesh(
    new THREE.CircleGeometry(2.05, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.1, roughness: 0.9 })
  );
  face.position.z = -0.05;
  speedo3DScene.add(face);

  // Arc segments
  speedo3DArcs = [];
  for (var i = 0; i < 30; i++) {
    var sa = Math.PI * 0.75 - (i / 30) * Math.PI * 1.5;
    var ea = Math.PI * 0.75 - ((i + 1) / 30) * Math.PI * 1.5;
    var curve = new THREE.ArcCurve(0, 0, 1.95, sa, ea, true);
    var pts = curve.getPoints(4);
    var tg = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p.x, p.y, 0.01); })),
      4, 0.06, 8, false
    );
    var pct = i / 30;
    var cr, cg, cb;
    if (pct < 0.4) { cr = 0.06; cg = 0.73; cb = 0.51; }
    else if (pct < 0.7) { cr = 0.95; cg = 0.75; cb = 0.05; }
    else { cr = 0.94; cg = 0.27; cb = 0.27; }
    var m = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({
      color: new THREE.Color(cr, cg, cb),
      emissive: new THREE.Color(cr, cg, cb),
      emissiveIntensity: 0.05, metalness: 0.3, roughness: 0.5,
      transparent: true, opacity: 0.25
    }));
    speedo3DScene.add(m);
    speedo3DArcs.push(m);
  }

  // Tick marks
  for (var t = 0; t <= 10; t++) {
    var ta = Math.PI * 0.75 - (t / 10) * Math.PI * 1.5;
    var isMaj = t % 2 === 0;
    var ir = isMaj ? 1.55 : 1.65;
    var pts2 = [
      new THREE.Vector3(Math.cos(ta) * ir, Math.sin(ta) * ir, 0.01),
      new THREE.Vector3(Math.cos(ta) * 1.85, Math.sin(ta) * 1.85, 0.01)
    ];
    speedo3DScene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts2),
      new THREE.LineBasicMaterial({ color: isMaj ? 0xe2e8f0 : 0x4b5563 })
    ));
    if (isMaj) {
      var lr = 1.35;
      var cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      var cx = cv.getContext('2d');
      cx.fillStyle = '#94a3b8';
      cx.font = 'bold 32px monospace';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(String(t * 10), 32, 32);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
      sp.position.set(Math.cos(ta) * lr, Math.sin(ta) * lr, 0.02);
      sp.scale.set(0.4, 0.4, 1);
      speedo3DScene.add(sp);
    }
  }

  // Hub
  var hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.15, 32),
    new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9, roughness: 0.1 })
  );
  hub.rotation.x = Math.PI / 2; hub.position.z = 0.1;
  speedo3DScene.add(hub);

  // Needle
  var ns = new THREE.Shape();
  ns.moveTo(0, -0.04); ns.lineTo(1.6, -0.015); ns.lineTo(1.7, 0);
  ns.lineTo(1.6, 0.015); ns.lineTo(0, 0.04); ns.lineTo(-0.2, 0); ns.closePath();
  speedo3DNeedle = new THREE.Mesh(
    new THREE.ShapeGeometry(ns),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide })
  );
  speedo3DNeedle.position.z = 0.15;
  speedo3DNeedle.rotation.z = Math.PI * 0.75;
  speedo3DScene.add(speedo3DNeedle);

  // Needle glow
  var gs = new THREE.Shape();
  gs.moveTo(0, -0.06); gs.lineTo(1.65, -0.02); gs.lineTo(1.65, 0.02); gs.lineTo(0, 0.06); gs.closePath();
  speedo3DGlow = new THREE.Mesh(
    new THREE.ShapeGeometry(gs),
    new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  );
  speedo3DGlow.position.z = 0.12;
  speedo3DGlow.rotation.z = Math.PI * 0.75;
  speedo3DScene.add(speedo3DGlow);

  // Pointer drag
  var isDrag = false;
  container.addEventListener('pointerdown', function (e) {
    isDrag = true; updateSpeedFromPointer3D(e, container);
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', function (e) {
    if (!isDrag) return;
    updateSpeedFromPointer3D(e, container);
  });
  container.addEventListener('pointerup', function () { isDrag = false; });

  animateSpeedo3D();
}

function updateSpeedFromPointer3D(e, container) {
  var rect = container.getBoundingClientRect();
  var dx = e.clientX - (rect.left + rect.width / 2);
  var dy = -(e.clientY - (rect.top + rect.height / 2));
  var angle = Math.atan2(dy, dx);
  var deg = angle * 180 / Math.PI;
  if (deg >= -135 && deg < 135) {
    var norm = Math.max(0, Math.min(1, (135 - deg) / 270));
    speedo3DTarget = Math.round(norm * 100);
    document.getElementById('speedo3DSlider').value = speedo3DTarget;
    updateSpeedo3DUI();
  }
}

function animateSpeedo3D() {
  speedo3DAnimId = requestAnimationFrame(animateSpeedo3D);
  speedo3DValue += (speedo3DTarget - speedo3DValue) * 0.12;
  var pct = speedo3DValue / 100;
  var na = Math.PI * 0.75 - pct * Math.PI * 1.5;
  speedo3DNeedle.rotation.z = na;
  speedo3DGlow.rotation.z = na;

  var nr, ng, nb;
  if (pct < 0.4) { nr = 0.06 + pct * 2.2; ng = 0.73; nb = 0.3; }
  else if (pct < 0.7) { nr = 0.95; ng = 0.75 - (pct - 0.4) * 1.5; nb = 0.1; }
  else { nr = 0.94; ng = Math.max(0, 0.27 - (pct - 0.7) * 0.5); nb = 0.27; }
  speedo3DNeedle.material.color.setRGB(nr, ng, nb);
  speedo3DGlow.material.color.setRGB(nr, ng, nb);
  speedo3DGlow.material.opacity = 0.1 + Math.sin(Date.now() * 0.005) * 0.05 + pct * 0.1;

  speedo3DArcs.forEach(function (m, i) {
    var ap = i / speedo3DArcs.length;
    var lit = ap <= pct;
    m.material.emissiveIntensity = lit ? 0.6 : 0.05;
    m.material.opacity = lit ? 1 : 0.25;
  });

  if (speedo3DRenderer && speedo3DScene && speedo3DCamera)
    speedo3DRenderer.render(speedo3DScene, speedo3DCamera);
}

