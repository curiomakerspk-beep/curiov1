// =====================================================================
// THREE.JS 3D MODEL VIEWER — Modal Logic
// =====================================================================
var current3DBlock = null;
var threeScene, threeCamera, threeRenderer, threeMesh, threeAnimId;
var selectedModel = 'cube';
var spinSpeed = 30;
var modelColor = '#7c3aed';

function open3DModal(block) {
  current3DBlock = block;
  selectedModel = block.getFieldValue('MODEL_TYPE') || 'cube';
  spinSpeed = parseInt(block.getFieldValue('SPIN_SPEED') || '30');
  modelColor = block.getFieldValue('MODEL_COLOR') || '#7c3aed';

  document.getElementById('threeSpinSpeed').value = spinSpeed;
  document.getElementById('threeSpeedLabel').textContent = spinSpeed;
  document.getElementById('threeColorPick').value = modelColor;
  document.getElementById('threeColorHex').textContent = modelColor;

  document.querySelectorAll('.three-model-btn').forEach(function (b) {
    b.classList.toggle('active', b.textContent.toLowerCase() === selectedModel);
  });

  document.getElementById('threeDModal').style.display = 'flex';
  setTimeout(function () { init3DScene(); load3DModel(selectedModel); }, 50);
}

function close3DModal() {
  document.getElementById('threeDModal').style.display = 'none';
  current3DBlock = null;
  if (threeAnimId) cancelAnimationFrame(threeAnimId);
  if (threeRenderer) {
    threeRenderer.dispose();
    var container = document.getElementById('threeCanvas');
    container.innerHTML = '';
    threeRenderer = null;
  }
}

function save3DSelection() {
  if (!current3DBlock) { close3DModal(); return; }
  current3DBlock.setFieldValue(selectedModel, 'MODEL_TYPE');
  current3DBlock.setFieldValue(spinSpeed.toString(), 'SPIN_SPEED');
  current3DBlock.setFieldValue(modelColor, 'MODEL_COLOR');
  var label = current3DBlock.getField('MODEL_LABEL');
  if (label) label.setValue(selectedModel.charAt(0).toUpperCase() + selectedModel.slice(1));
  close3DModal();
}

function select3DModel(model) {
  selectedModel = model;
  document.querySelectorAll('.three-model-btn').forEach(function (b) {
    b.classList.toggle('active', b.textContent.toLowerCase() === model);
  });
  load3DModel(model);
}

function update3DSpeed(val) {
  spinSpeed = parseInt(val);
  document.getElementById('threeSpeedLabel').textContent = val;
}

function update3DColor(val) {
  modelColor = val;
  document.getElementById('threeColorHex').textContent = val;
  if (threeMesh) {
    if (threeMesh._isGroup) {
      threeMesh.children.forEach(function (child) {
        if (child.material && child.material.color) child.material.color.set(val);
      });
    } else {
      threeMesh.material.color.set(val);
    }
  }
}

function init3DScene() {
  var container = document.getElementById('threeCanvas');
  container.innerHTML = '';

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x1a2235);

  threeCamera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
  threeCamera.position.set(0, 1.5, 4);
  threeCamera.lookAt(0, 0.5, 0);

  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(container.clientWidth, container.clientHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(threeRenderer.domElement);

  // Lighting
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 5, 5);
  threeScene.add(dir);
  var point = new THREE.PointLight(0x7c3aed, 0.6, 10);
  point.position.set(-3, 2, 1);
  threeScene.add(point);

  // Grid
  threeScene.add(new THREE.GridHelper(6, 12, 0x243049, 0x1a2235));

  // Simple orbit via pointer drag (no external OrbitControls needed)
  var isDrag = false, prevX = 0, prevY = 0;
  var rotX = 0.3, rotY = 0;
  container.addEventListener('pointerdown', function (e) {
    isDrag = true; prevX = e.clientX; prevY = e.clientY;
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', function (e) {
    if (!isDrag) return;
    rotY += (e.clientX - prevX) * 0.01;
    rotX += (e.clientY - prevY) * 0.01;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));
    prevX = e.clientX; prevY = e.clientY;
    threeCamera.position.x = 4 * Math.sin(rotY) * Math.cos(rotX);
    threeCamera.position.y = 4 * Math.sin(rotX) + 1;
    threeCamera.position.z = 4 * Math.cos(rotY) * Math.cos(rotX);
    threeCamera.lookAt(0, 0.5, 0);
  });
  container.addEventListener('pointerup', function () { isDrag = false; });
}

function load3DModel(type) {
  if (threeMesh) {
    threeScene.remove(threeMesh);
    if (threeMesh._isGroup) {
      threeMesh.children.forEach(function (c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    } else {
      threeMesh.geometry.dispose();
      threeMesh.material.dispose();
    }
  }
  if (threeAnimId) cancelAnimationFrame(threeAnimId);

  var mat = new THREE.MeshStandardMaterial({
    color: modelColor,
    metalness: 0.3,
    roughness: 0.4
  });

  var geo;
  switch (type) {
    case 'sphere':
      geo = new THREE.SphereGeometry(1, 32, 32); break;
    case 'cylinder':
      geo = new THREE.CylinderGeometry(0.7, 0.7, 1.6, 32); break;
    case 'cone':
      geo = new THREE.ConeGeometry(0.8, 1.6, 32); break;
    case 'torus':
      geo = new THREE.TorusGeometry(0.8, 0.3, 16, 48); break;
    case 'robot':
      var group = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.6), mat);
      var headMat = mat.clone();
      headMat.color.set('#a855f7');
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), headMat);
      head.position.y = 1;
      var eyeMat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x00f5ff, emissiveIntensity: 0.8 });
      var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), eyeMat);
      eyeL.position.set(-0.15, 1.05, 0.26);
      var eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), eyeMat.clone());
      eyeR.position.set(0.15, 1.05, 0.26);
      var armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), mat.clone());
      armL.position.set(-0.65, 0, 0);
      var armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), mat.clone());
      armR.position.set(0.65, 0, 0);
      group.add(body, head, eyeL, eyeR, armL, armR);
      group.position.y = 0.7;
      threeScene.add(group);
      threeMesh = group;
      threeMesh._isGroup = true;
      animate3D();
      return;
    default:
      geo = new THREE.BoxGeometry(1.2, 1.2, 1.2); break;
  }

  threeMesh = new THREE.Mesh(geo, mat);
  threeMesh.position.y = 1;
  threeScene.add(threeMesh);
  animate3D();
}

function animate3D() {
  threeAnimId = requestAnimationFrame(animate3D);
  if (threeMesh) {
    var speed = spinSpeed * 0.0003;
    threeMesh.rotation.y += speed;
    if (!threeMesh._isGroup) threeMesh.rotation.x += speed * 0.3;
  }
  if (threeRenderer && threeScene && threeCamera) {
    threeRenderer.render(threeScene, threeCamera);
  }
}

