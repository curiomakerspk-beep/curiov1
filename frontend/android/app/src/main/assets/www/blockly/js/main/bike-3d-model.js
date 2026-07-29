const _FRONT_WHEEL_SET = new Set([
  "pCylinder31", "pCylinder68",
  "pPipe10", "pPipe26",
  "pCylinder33", "pCylinder41",
  "pPipe12", "pPipe16"
]);
const _REAR_WHEEL_SET = new Set([
  "polySurface142", "polySurface143",
  "polySurface164", "polySurface165"
]);

let bikeState = {
  scene: null, camera: null, renderer: null, animId: null,
  initialized: false, block: null,
  wheelMeshes: [], spinSpeed: 0,
  theta: -0.3, phi: 1.1, radius: 14,
  isDragging: false, prevX: 0, prevY: 0
};

function openBikeModelModal(block) {
  bikeState.block = block;
  const saved = parseInt(block.getFieldValue('BIKE_SPEED')) || 0;
  bikeState.spinSpeed = saved;
  const sl = document.getElementById('bikeSpeedSlider');
  if (sl) sl.value = saved;
  _updateBikeLabel();
  document.getElementById('bikeModelModal').style.display = 'flex';
  setTimeout(_initBike3D, 60);
}
function closeBikeModal() {
  _destroyBike3D();
  document.getElementById('bikeModelModal').style.display = 'none';
  bikeState.block = null;
}
function saveBikeModal() {
  if (bikeState.block) bikeState.block.setFieldValue(String(bikeState.spinSpeed), 'BIKE_SPEED');
  closeBikeModal();
}
function bikeSpeedUp() { bikeState.spinSpeed = Math.min(10, bikeState.spinSpeed + 1); _syncBikeSlider(); _updateBikeLabel(); }
function bikeSpeedDown() { bikeState.spinSpeed = Math.max(0, bikeState.spinSpeed - 1); _syncBikeSlider(); _updateBikeLabel(); }
function setBikeSpeedFromSlider(v) { bikeState.spinSpeed = +v; _updateBikeLabel(); }
function _syncBikeSlider() { const sl = document.getElementById('bikeSpeedSlider'); if (sl) sl.value = bikeState.spinSpeed; }
function _updateBikeLabel() { const el = document.getElementById('bikeSpeedValLabel'); if (el) el.textContent = bikeState.spinSpeed + ' / 10'; }

function _initBike3D() {
  if (bikeState.initialized) { _runBikeAnim(); return; }
  const canvas = document.getElementById('bikeCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = (canvas.parentElement ? canvas.parentElement.offsetWidth : 492) || 492;
  const H = 310;
  canvas.width = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 18, 50);

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 300);
  _updateBikeCamera(camera);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  // ── Balanced lighting — body won't blow out white ──
  // Soft ambient only — no harsh direct overexposure
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  // Key light from upper-left — moderate intensity
  const key = new THREE.DirectionalLight(0xfff0d0, 1.2);
  key.position.set(-6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  scene.add(key);

  // Soft fill from right
  const fill = new THREE.DirectionalLight(0x8ab4f8, 0.4);
  fill.position.set(8, 4, -6);
  scene.add(fill);

  // Subtle rim/back light
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(0, -4, -10);
  scene.add(rim);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0d1f35, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(new THREE.GridHelper(50, 25, 0x1a3a5c, 0x1a3a5c));

  bikeState.scene = scene;
  bikeState.camera = camera;
  bikeState.renderer = renderer;
  bikeState.wheelMeshes = [];
  bikeState.initialized = true;

  const loadMsg = document.getElementById('bikeLoadingMsg');
  if (typeof THREE.GLTFLoader === 'undefined') {
    if (loadMsg) loadMsg.textContent = 'GLTFLoader unavailable';
    _runBikeAnim(); return;
  }

  try {
    const blobUrl = 'assets/models/bike.glb';

    new THREE.GLTFLoader().load(blobUrl, function (gltf) {
      URL.revokeObjectURL(blobUrl);
      if (loadMsg) loadMsg.style.display = 'none';
      const model = gltf.scene;
      if (!model) { _runBikeAnim(); return; }

      // Scale & sit on ground
      const box = new THREE.Box3().setFromObject(model);
      const sz = box.getSize(new THREE.Vector3());
      const sc = 4.0 / Math.max(sz.x, sz.y, sz.z);
      model.scale.setScalar(sc);

      const box2 = new THREE.Box3().setFromObject(model);
      const cen = box2.getCenter(new THREE.Vector3());
      model.position.x -= cen.x;
      model.position.z -= cen.z;
      model.position.y -= box2.min.y;

      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(model);

      // ── Collect ONLY true wheel meshes (tight axle cluster) ──
      const wm = [];
      model.traverse(child => {
        if (child.isMesh &&
          (_FRONT_WHEEL_SET.has(child.name) || _REAR_WHEEL_SET.has(child.name))) {
          wm.push(child);
        }
      });
      bikeState.wheelMeshes = wm;
      _runBikeAnim();

    }, undefined, function (err) {
      console.error('[BikeGLB] load error:', err);
      if (loadMsg) loadMsg.textContent = 'Load error';
      _runBikeAnim();
    });
  } catch (e) {
    console.error('[BikeGLB] init error:', e);
    if (loadMsg) loadMsg.textContent = 'Error: ' + e.message;
    _runBikeAnim();
  }

  // Orbit camera drag
  canvas.addEventListener('pointerdown', e => {
    bikeState.isDragging = true;
    bikeState.prevX = e.clientX; bikeState.prevY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!bikeState.isDragging) return;
    bikeState.theta -= (e.clientX - bikeState.prevX) * 0.007;
    bikeState.phi = Math.max(0.12, Math.min(Math.PI / 2.2,
      bikeState.phi - (e.clientY - bikeState.prevY) * 0.005));
    bikeState.prevX = e.clientX; bikeState.prevY = e.clientY;
    _updateBikeCamera(bikeState.camera);
  });
  canvas.addEventListener('pointerup', () => { bikeState.isDragging = false; });
  canvas.addEventListener('pointerleave', () => { bikeState.isDragging = false; });
}

function _updateBikeCamera(cam) {
  if (!cam) return;
  const r = bikeState.radius, ph = bikeState.phi, th = bikeState.theta;
  cam.position.set(
    r * Math.sin(ph) * Math.sin(th),
    r * Math.cos(ph) + 0.5,
    r * Math.sin(ph) * Math.cos(th)
  );
  cam.lookAt(0, 0.5, 0);
}

function _runBikeAnim() {
  if (bikeState.animId) cancelAnimationFrame(bikeState.animId);
  function loop() {
    if (!bikeState.initialized || !bikeState.renderer) return;
    const rad = bikeState.spinSpeed * 0.015;
    if (rad > 0) {
      bikeState.wheelMeshes.forEach(m => { m.rotation.y += rad; });
    }
    bikeState.renderer.render(bikeState.scene, bikeState.camera);
    bikeState.animId = requestAnimationFrame(loop);
  }
  bikeState.animId = requestAnimationFrame(loop);
}

function _destroyBike3D() {
  if (bikeState.animId) { cancelAnimationFrame(bikeState.animId); bikeState.animId = null; }
  if (bikeState.renderer) { bikeState.renderer.dispose(); bikeState.renderer = null; }
  bikeState.scene = bikeState.camera = null;
  bikeState.wheelMeshes = []; bikeState.initialized = false;
}

// ── POSE_MODEL_TRAINED — inject pose blocks into toolbox ───────────────
function applyPoseClasses(classes) {
  if (!classes || classes.length < 1) return;
  window._poseTrainedClasses = classes;
  const opts = classes.map(c => [c, c]);

  // Define pose_detected block — checks if a pose is detected
  if (Blockly.Blocks['pose_detected']) delete Blockly.Blocks['pose_detected'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'pose_detected',
    message0: 'pose detected %1',
    args0: [{ type: 'field_dropdown', name: 'POSE', options: opts }],
    colour: '#0ea5e9', output: 'Boolean',
    tooltip: 'Returns true if this pose is detected.',
    extensions: ["defult_style"]
  }]);

  // Define pose_confidence block — confidence % for a pose
  if (Blockly.Blocks['pose_confidence']) delete Blockly.Blocks['pose_confidence'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'pose_confidence',
    message0: 'confidence of pose %1',
    args0: [{ type: 'field_dropdown', name: 'POSE', options: opts }],
    colour: '#0ea5e9', output: 'Number',
    tooltip: 'Returns 0–100 confidence score for this pose.',
    extensions: ["defult_style"]
  }]);

  // Define pose_classify block — run pose inference
  if (Blockly.Blocks['pose_classify']) delete Blockly.Blocks['pose_classify'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'pose_classify',
    message0: 'classify pose → result %1',
    args0: [{ type: 'field_dropdown', name: 'POSE', options: opts }],
    colour: '#0ea5e9', previousStatement: null, nextStatement: null,
    tooltip: 'Run pose classification on camera feed.',
    extensions: ["defult_style"]
  }]);

  // Patch existing workspace blocks
  if (typeof workspace !== 'undefined' && workspace) {
    workspace.getAllBlocks(false).forEach(function (block) {
      if (['pose_detected', 'pose_confidence', 'pose_classify'].includes(block.type)) {
        const field = block.getField('POSE');
        if (field) {
          field.menuGenerator_ = opts;
          const cur = field.getValue();
          if (!opts.some(o => o[1] === cur)) field.setValue(opts[0][1]);
          field.forceRerender();
        }
      }
    });
  }

  // Add/update A.I. Pose category in toolbox
  function doUpdatePose() {
    try {
      if (typeof workspace !== 'undefined' && workspace && window.toolboxConfig) {
        var poseContents = [
          { kind: 'block', type: 'pose_classify' },
          { kind: 'block', type: 'pose_detected' },
          { kind: 'block', type: 'pose_confidence' },
        ];
        var found = false;
        function findAndUpdatePose(items) {
          if (!items) return false;
          for (var i = 0; i < items.length; i++) {
            if (items[i].id === 'cat_ai_pose') {
              items[i].contents = poseContents; found = true; return true;
            }
            if (items[i].contents && findAndUpdatePose(items[i].contents)) return true;
          }
          return false;
        }
        findAndUpdatePose(window.toolboxConfig.contents);
        if (!found) {
          window.toolboxConfig.contents.push({
            kind: 'category', name: 'A.I. Pose', colour: '#0ea5e9',
            id: 'cat_ai_pose', contents: poseContents
          });
        }
        workspace.updateToolbox(window.toolboxConfig);

        // Open A.I. Pose category
        setTimeout(function () {
          try {
            var tb = workspace.getToolbox();
            var poseItem = tb.getToolboxItems().find(function (item) {
              return item.getName && item.getName() === 'A.I. Pose';
            });
            if (poseItem) tb.setSelectedItem(poseItem);
          } catch (e) { }
        }, 150);
      }
    } catch (e) {
      console.warn('[Pose Train] Toolbox update error:', e);
    }

    // Toast
    const toast = document.getElementById('liveModeToast');
    if (toast) {
      toast.textContent = '🧘 Pose blocks ready! Poses: ' + classes.join(', ');
      toast.style.display = 'block'; toast.style.opacity = '1';
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => { toast.style.display = 'none'; }, 500); }, 3500);
    }

    try { sessionStorage.setItem('curio_pose_trained', JSON.stringify(classes)); } catch (e) { }

  }

  var blocklyDiv = document.getElementById('blocklyDiv');
  if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
    doUpdatePose();
  } else {
    var pollVisible = setInterval(function () {
      if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
        clearInterval(pollVisible);
        doUpdatePose();
      }
    }, 100);
  }
}

