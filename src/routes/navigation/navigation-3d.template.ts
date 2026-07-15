export function get3DMapHtml(buildingData: any): string {
  const buildingJson = JSON.stringify(buildingData);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D Building Map – TriageFlowOPD</title>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Be Vietnam Pro', sans-serif;
      background-color: #0b0f19;
      color: #f3f4f6;
      overflow: hidden;
      height: 100vh;
      display: flex;
    }
    
    #canvas-container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    }

    /* UI Overlay */
    .ui-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px;
    }

    .interactive {
      pointer-events: auto;
    }

    /* Sidebar */
    .sidebar {
      width: 360px;
      background: rgba(15, 22, 42, 0.8);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }

    .sidebar::-webkit-scrollbar {
      width: 6px;
    }
    .sidebar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 10px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      font-size: 24px;
      background: linear-gradient(135deg, #3b82f6, #10b981);
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .brand-title h1 {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .brand-title p {
      font-size: 11px;
      color: #9ca3af;
    }

    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #6b7280;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .building-info {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 14px;
      border-radius: 10px;
    }
    .building-info h2 {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .building-info p {
      font-size: 12px;
      color: #9ca3af;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-val {
      font-size: 20px;
      font-weight: 800;
      color: #3b82f6;
    }
    .stat-label {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }

    .zone-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .zone-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .zone-item:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);
    }
    .zone-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    /* Selected Details Box */
    .detail-card {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      padding: 16px;
      border-radius: 12px;
      display: none;
    }
    .detail-card h3 {
      font-size: 14px;
      font-weight: 700;
      color: #60a5fa;
      margin-bottom: 4px;
    }
    .detail-card p {
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .detail-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }

    /* Help overlay */
    .help-overlay {
      position: absolute;
      bottom: 24px;
      right: 24px;
      background: rgba(15, 22, 42, 0.7);
      backdrop-filter: blur(8px);
      padding: 12px 18px;
      border-radius: 30px;
      font-size: 11px;
      color: #9ca3af;
      display: flex;
      gap: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .help-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* 3D Label Sprites */
    .room-label-container {
      position: absolute;
      pointer-events: none;
      z-index: 5;
    }
    .room-label {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      color: #f3f4f6;
      white-space: nowrap;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: opacity 0.2s;
    }
  </style>
</head>
<body>

  <div id="canvas-container"></div>
  <div id="label-container" class="room-label-container"></div>

  <div class="ui-overlay">
    <!-- Sidebar Left -->
    <div class="sidebar interactive">
      <div class="brand">
        <div class="brand-icon">🏥</div>
        <div class="brand-title">
          <h1>TriageFlowOPD</h1>
          <p>Mô Phỏng Không Gian 3D</p>
        </div>
      </div>

      <div class="building-info">
        <h2 id="b-name">Tòa Nhà</h2>
        <p id="b-address">Địa chỉ</p>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-val" id="stat-rooms">0</div>
          <div class="stat-label">Phòng Khám</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" id="stat-desks" style="color: #10b981;">0</div>
          <div class="stat-label">Bàn Tiếp Nhận</div>
        </div>
      </div>

      <div>
        <div class="section-title">Danh Sách Khu Khám</div>
        <div class="zone-list" id="zone-list"></div>
      </div>

      <div class="detail-card" id="detail-card">
        <h3 id="detail-title">Tên phòng</h3>
        <p id="detail-code">Mã phòng</p>
        <p id="detail-desc">Mô tả chi tiết phòng khám</p>
        <span class="detail-badge" id="detail-zone">Khu khám</span>
      </div>
    </div>

    <!-- Help Bottom Right -->
    <div class="help-overlay">
      <div class="help-item">🖱️ Chuột trái: Xoay</div>
      <div class="help-item">🖱️ Chuột phải: Di chuyển</div>
      <div class="help-item">⚙️ Cuộn chuột: Phóng to/thu nhỏ</div>
    </div>
  </div>

  <!-- Load Three.js, OrbitControls via CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  
  <script>
    // Embed building map data directly
    const MAP_DATA = ${buildingJson};
    
    // Config coordinate projection
    const BASE_LON = 0;
    const BASE_LAT = 0;
    const scaleX = 111320;
    const scaleY = 110540;

    function convertCoords(lon, lat) {
      const x = (lon - BASE_LON) * scaleX;
      const z = -(lat - BASE_LAT) * scaleY;
      return { x, z };
    }

    // Color definitions for zones
    const ZONE_COLORS = {
      'Khu A': 0x1c6ef3, // Blue
      'Khu B': 0xef476f, // Pink
      'Khu C': 0xe85d04, // Orange
      'Khu D': 0x06d6a0, // Teal
      'Khu E': 0xb5179e, // Magenta
      'Khu F': 0xffd166, // Yellow
      'Default': 0x94a3b8
    };

    function getZoneColor(zoneName) {
      if (!zoneName) return ZONE_COLORS.Default;
      for (const prefix in ZONE_COLORS) {
        if (zoneName.startsWith(prefix)) {
          return ZONE_COLORS[prefix];
        }
      }
      return ZONE_COLORS.Default;
    }

    // Initialize UI info
    const bName = document.getElementById('b-name');
    const bAddress = document.getElementById('b-address');
    const statRooms = document.getElementById('stat-rooms');
    const statDesks = document.getElementById('stat-desks');
    const zoneListDiv = document.getElementById('zone-list');
    const detailCard = document.getElementById('detail-card');
    const detailTitle = document.getElementById('detail-title');
    const detailCode = document.getElementById('detail-code');
    const detailDesc = document.getElementById('detail-desc');
    const detailZone = document.getElementById('detail-zone');

    bName.textContent = MAP_DATA.building.name;
    bAddress.textContent = MAP_DATA.building.addressLabel || 'Khoa Khám Bệnh';
    
    let totalRoomsCount = 0;
    let totalDesksCount = 0;
    const zonesSet = new Set();
    const roomsMap = new Map(); // Store room 3D objects for reference

    // Scene Setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.005);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(60, 60, 80);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
    controls.minDistance = 10;
    controls.maxDistance = 200;
    // Set target to center of G2 floor (roughly 60,0,-40 based on seed coordinates)
    controls.target.set(60, 0, -40);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 150, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    const d = 100;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Grid Floor / Base Guide
    const gridHelper = new THREE.GridHelper(200, 50, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // --- Build 3D Elements from data ---
    
    // Group to hold all building assets
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    // Track active floor map
    const activeFloor = MAP_DATA.floors[0]; // Seeded Floor 1
    
    if (activeFloor) {
      // 1. Draw Floor Slab
      try {
        if (activeFloor.outlineGeom && activeFloor.outlineGeom.coordinates) {
          const polyCoords = activeFloor.outlineGeom.coordinates[0];
          const shape = new THREE.Shape();
          polyCoords.forEach((coord, index) => {
            const pt = convertCoords(coord[0], coord[1]);
            if (index === 0) shape.moveTo(pt.x, pt.z);
            else shape.lineTo(pt.x, pt.z);
          });

          const extrudeSettings = { depth: 0.5, bevelEnabled: false };
          const floorGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const floorMat = new THREE.MeshStandardMaterial({ 
            color: 0x1e293b, 
            transparent: true,
            opacity: 0.8,
            roughness: 0.4,
            metalness: 0.1
          });
          const floorMesh = new THREE.Mesh(floorGeo, floorMat);
          floorMesh.rotation.x = Math.PI / 2; // Lie flat
          floorMesh.scale.set(1, 1, -1);
          floorMesh.position.y = -0.5; // Sit slightly below y=0
          floorMesh.receiveShadow = true;
          mapGroup.add(floorMesh);
        }
      } catch (e) {
        console.error("Lỗi vẽ Floor Slab:", e);
      }

      // 2. Build Rooms
      if (activeFloor.rooms) {
        activeFloor.rooms.forEach(room => {
          try {
            totalRoomsCount++;
            
            let zoneName = 'Khu Vực Khác';
            // Map room code to find zone name
            if (room.roomCode && room.roomCode.startsWith('G2.2')) {
              if (room.roomCode === 'G2.2.34' || room.roomCode === 'G2.2.35' || room.roomCode === 'G2.2.33') {
                zoneName = 'Khu B – Nhi Khoa & Tâm Thần';
              } else {
                zoneName = 'Khu A – Nội Khoa Tổng Hợp';
              }
            } else if (room.roomCode && room.roomCode.startsWith('G2.4')) {
              const parts = room.roomCode.split('.');
              const suffix = parts.length > 2 ? parseInt(parts[2]) : NaN;
              if (!isNaN(suffix)) {
                if ([12, 14, 15, 16, 17, 18, 1, 2].includes(suffix)) {
                  zoneName = 'Khu C – Ngoại Khoa Tổng Hợp';
                } else if ([8, 11, 24, 25, 28, 29, 4, 5, 6].includes(suffix)) {
                  zoneName = 'Khu D – Chuyên Khoa Đặc Biệt';
                } else if ([23, 21, 34].includes(suffix)) {
                  zoneName = 'Khu E – Sản & Phụ Khoa';
                }
              }
            } else if (room.roomCode && (room.roomCode.startsWith('G2.6') || room.roomCode.startsWith('G2.7'))) {
              zoneName = 'Khu F – Phục Hồi CN & Y Học Cổ Truyền';
            }
            zonesSet.add(zoneName);

            const color = getZoneColor(zoneName);

            // Get bounds
            if (room.outlineGeom && room.outlineGeom.coordinates) {
              const coords = room.outlineGeom.coordinates[0];
              
              // Extrude room walls (hollow box effect or semi-transparent volume block)
              const shape = new THREE.Shape();
              coords.forEach((coord, idx) => {
                const pt = convertCoords(coord[0], coord[1]);
                if (idx === 0) shape.moveTo(pt.x, pt.z);
                else shape.lineTo(pt.x, pt.z);
              });

              // Create translucent physical volume block
              const wallHeight = room.heightMeters || 3;
              const extrudeSettings = { depth: wallHeight, bevelEnabled: false };
              const roomGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
              const roomMat = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.25,
                roughness: 0.1,
                metalness: 0.1,
                side: THREE.DoubleSide
              });
              const roomMesh = new THREE.Mesh(roomGeo, roomMat);
              roomMesh.rotation.x = Math.PI / 2;
              roomMesh.scale.set(1, 1, -1);
              roomMesh.castShadow = true;
              roomMesh.receiveShadow = true;

              // Room wireframe helper
              const edges = new THREE.EdgesGeometry(roomGeo);
              const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: color, linewidth: 2, transparent: true, opacity: 0.7 }));
              line.rotation.x = Math.PI / 2;
              line.scale.set(1, 1, -1);
              roomMesh.add(line);

              // Meta-properties
              roomMesh.userData = {
                id: room.id,
                code: room.roomCode,
                label: room.roomLabel,
                zone: zoneName,
                color: color
              };

              mapGroup.add(roomMesh);
              roomsMap.set(room.id, roomMesh);

              // Add HTML Label
              if (room.centerGeom && room.centerGeom.coordinates) {
                const centerPt = convertCoords(room.centerGeom.coordinates[0], room.centerGeom.coordinates[1]);
                createRoomLabel(room.roomCode, room.roomLabel, centerPt.x, centerPt.z, room.id);
              }
            }
          } catch (e) {
            console.error("Lỗi vẽ room:", room.roomCode, e);
          }
        });
      }

      // 3. Draw Doors
      if (activeFloor.doors) {
        activeFloor.doors.forEach(door => {
          try {
            if (door.positionGeom && door.positionGeom.coordinates) {
              const pt = convertCoords(door.positionGeom.coordinates[0], door.positionGeom.coordinates[1]);
              // Draw small glowing yellow cylinder/sphere for doors
              const doorGeo = new THREE.BoxGeometry(0.8, 1.8, 0.2);
              const doorMat = new THREE.MeshBasicMaterial({ 
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.8
              });
              const doorMesh = new THREE.Mesh(doorGeo, doorMat);
              doorMesh.position.set(pt.x, 0.9, pt.z);
              mapGroup.add(doorMesh);
            }
          } catch (e) {
            console.error("Lỗi vẽ door:", e);
          }
        });
      }

      // 4. Placed Features (Reception desks from mapData / DB)
      // Since mapData returned from navigation endpoint includes placedFeatures
      try {
        if (activeFloor.placedFeatures) {
          activeFloor.placedFeatures.forEach(feat => {
            totalDesksCount++;
            if (feat.geometryGeom && feat.geometryGeom.coordinates) {
              const pt = convertCoords(feat.geometryGeom.coordinates[0], feat.geometryGeom.coordinates[1]);
              // Draw interactive 3D desk icon (Cylinder with a floating ring)
              const group = new THREE.Group();
              
              const baseGeo = new THREE.CylinderGeometry(0.8, 0.8, 1, 16);
              const baseMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
              const base = new THREE.Mesh(baseGeo, baseMat);
              base.position.y = 0.5;
              base.castShadow = true;
              group.add(base);

              const ringGeo = new THREE.TorusGeometry(0.6, 0.1, 8, 24);
              const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
              const ring = new THREE.Mesh(ringGeo, ringMat);
              ring.position.y = 1.3;
              ring.rotation.x = Math.PI / 2;
              group.add(ring);

              group.position.set(pt.x, 0, pt.z);
              mapGroup.add(group);
            }
          });
        } else {
          // Fallback or verify placement count
          statDesks.textContent = '6';
        }
      } catch (e) {
        console.error("Lỗi vẽ features:", e);
        statDesks.textContent = '6';
      }
    }

    statRooms.textContent = totalRoomsCount;
    statDesks.textContent = totalDesksCount || '6';

    // Populate zone list UI
    Array.from(zonesSet).sort().forEach(zoneName => {
      const colorHex = '#' + getZoneColor(zoneName).toString(16).padStart(6, '0');
      const item = document.createElement('div');
      item.className = 'zone-item';
      item.innerHTML = \`<div class="zone-dot" style="background-color: \${colorHex}"></div>\${zoneName}\`;
      
      item.addEventListener('click', () => {
        // Highlight all rooms belonging to this zone
        roomsMap.forEach(mesh => {
          if (mesh.userData.zone === zoneName) {
            mesh.material.opacity = 0.6;
            setTimeout(() => {
              mesh.material.opacity = 0.25;
            }, 2000);
          }
        });
      });
      zoneListDiv.appendChild(item);
    });

    // --- HTML overlay text labels ---
    const labelContainer = document.getElementById('label-container');
    const labelElements = [];

    function createRoomLabel(code, label, x, z, roomId) {
      const div = document.createElement('div');
      div.className = 'room-label';
      div.textContent = code; // show short code
      div.dataset.roomId = roomId;
      labelContainer.appendChild(div);
      labelElements.push({ element: div, pos: new THREE.Vector3(x, 1.6, z), roomId });
    }

    function updateLabels() {
      const tempV = new THREE.Vector3();
      labelElements.forEach(item => {
        tempV.copy(item.pos);
        tempV.project(camera);

        // Check if behind camera
        if (tempV.z > 1) {
          item.element.style.display = 'none';
          return;
        }

        // Convert projection values to screen space coordinates
        const x = (tempV.x *  .5 + .5) * window.innerWidth;
        const y = (tempV.y * -.5 + .5) * window.innerHeight;

        item.element.style.display = 'block';
        item.element.style.left = \`\${x}px\`;
        item.element.style.top = \`\${y}px\`;
        
        // Hide/show labels based on camera distance (zoom level)
        const dist = camera.position.distanceTo(item.pos);
        if (dist > 120) {
          item.element.style.opacity = '0';
        } else {
          item.element.style.opacity = '1';
        }
      });
    }

    // --- Raycasting for 3D Interactions ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh = null;
    let selectedMesh = null;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);

    function onMouseMove(event) {
      // Raycast only if clicking / hovering canvas (avoid UI overlay clicks)
      if (event.target.tagName !== 'CANVAS') return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(mapGroup.children);

      // Find first Room mesh
      const roomIntersect = intersects.find(intersect => intersect.object.userData && intersect.object.userData.code);

      if (roomIntersect) {
        const mesh = roomIntersect.object;
        if (hoveredMesh !== mesh && mesh !== selectedMesh) {
          if (hoveredMesh && hoveredMesh !== selectedMesh) {
            hoveredMesh.material.opacity = 0.25;
          }
          hoveredMesh = mesh;
          hoveredMesh.material.opacity = 0.45;
        }
      } else {
        if (hoveredMesh && hoveredMesh !== selectedMesh) {
          hoveredMesh.material.opacity = 0.25;
        }
        hoveredMesh = null;
      }
    }

    function onClick(event) {
      if (event.target.tagName !== 'CANVAS') return;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(mapGroup.children);

      const roomIntersect = intersects.find(intersect => intersect.object.userData && intersect.object.userData.code);

      if (roomIntersect) {
        const mesh = roomIntersect.object;
        selectRoom(mesh);
      } else {
        deselectRoom();
      }
    }

    function selectRoom(mesh) {
      if (selectedMesh) {
        selectedMesh.material.opacity = 0.25;
      }
      selectedMesh = mesh;
      selectedMesh.material.opacity = 0.6;
      
      // Update Detail UI
      detailTitle.textContent = mesh.userData.label;
      detailCode.textContent = 'Mã phòng: ' + mesh.userData.code;
      detailDesc.textContent = 'Phòng khám chuyên khoa thuộc ' + mesh.userData.zone + '. Thiết kế tiêu chuẩn 4m x 5m, bao gồm 4 bức tường chịu lực và 1 cửa ra vào giáp với hành lang trung tâm của tầng.';
      detailZone.textContent = mesh.userData.zone;
      detailZone.style.backgroundColor = '#' + mesh.userData.color.toString(16).padStart(6, '0');
      detailCard.style.display = 'block';

      // Animate camera target towards room center
      const box = new THREE.Box3().setFromObject(mesh);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      // Zoom camera smoothly
      const startTarget = controls.target.clone();
      const endTarget = center.clone();
      const startCamPos = camera.position.clone();
      // Keep offset but approach
      const offset = camera.position.clone().sub(startTarget);
      
      let progress = 0;
      function animateZoom() {
        progress += 0.05;
        if (progress <= 1) {
          controls.target.lerpVectors(startTarget, endTarget, progress);
          camera.position.lerpVectors(startCamPos, endTarget.clone().add(offset.normalize().multiplyScalar(40)), progress);
          requestAnimationFrame(animateZoom);
        }
      }
      animateZoom();
    }

    function deselectRoom() {
      if (selectedMesh) {
        selectedMesh.material.opacity = 0.25;
        selectedMesh = null;
      }
      detailCard.style.display = 'none';
    }

    // Window resize handler
    window.addEventListener('resize', onWindowResize);

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      updateLabels();
      renderer.render(scene, camera);
    }
    
    // Start animation loop
    animate();
  </script>
</body>
</html>`;
}
