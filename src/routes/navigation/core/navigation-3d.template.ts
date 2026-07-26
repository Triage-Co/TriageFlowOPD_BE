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
      background-color: #cbd5e1;
      color: #0f172a;
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
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      color: #0f172a;
    }

    .sidebar::-webkit-scrollbar {
      width: 6px;
    }
    .sidebar::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
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
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }
    .brand-title h1 {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .brand-title p {
      font-size: 11px;
      color: #64748b;
    }

    .building-info {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.04);
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
      color: #64748b;
    }

    /* Selected Details Box */
    .detail-card {
      background: rgba(59, 130, 246, 0.05);
      border: 1px solid rgba(59, 130, 246, 0.15);
      padding: 16px;
      border-radius: 12px;
      display: none;
    }
    .detail-card h3 {
      font-size: 14px;
      font-weight: 700;
      color: #1d4ed8;
      margin-bottom: 4px;
    }
    .detail-card p {
      font-size: 12px;
      color: #475569;
      margin-bottom: 8px;
    }
    .detail-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.1);
      color: #1d4ed8;
    }

    /* Pathfinding Navigation Box */
    .nav-section {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .nav-section-title {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .nav-input-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nav-input-group label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
    }
    .nav-input-group select {
      width: 100%;
      padding: 8px 10px;
      background: #ffffff;
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-radius: 8px;
      font-size: 12px;
      font-family: inherit;
      color: #0f172a;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .nav-input-group select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .nav-button-group {
      display: flex;
      gap: 8px;
    }
    .btn-primary {
      flex: 1;
      padding: 8px 14px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #ffffff;
      font-weight: 600;
      font-size: 12px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
      transition: all 0.2s;
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
    }
    .btn-primary:active {
      transform: translateY(0);
    }
    .btn-secondary {
      padding: 8px 14px;
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      font-size: 12px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .route-info-box {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 8px;
      padding: 10px;
      font-size: 12px;
      color: #065f46;
      display: none;
    }

    /* Detail Card Action Buttons */
    .detail-action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }
    .btn-action-primary {
      width: 100%;
      padding: 8px 12px;
      background: #ffffff;
      color: #3b82f6;
      font-weight: 600;
      font-size: 11px;
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }
    .btn-action-primary:hover {
      background: rgba(59, 130, 246, 0.05);
      border-color: #3b82f6;
    }

    /* Help overlay */
    .help-overlay {
      position: absolute;
      bottom: 24px;
      right: 24px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(8px);
      padding: 12px 18px;
      border-radius: 30px;
      font-size: 11px;
      color: #475569;
      display: flex;
      gap: 16px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
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
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(15, 23, 42, 0.12);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
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

      <!-- Navigation & Pathfinding UI Section -->
      <div class="nav-section">
        <div class="nav-section-title">🗺️ TÌM ĐƯỜNG ĐI</div>
        <div class="nav-input-group">
          <label for="route-start">Điểm xuất phát:</label>
          <select id="route-start">
            <option value="">-- Chọn phòng đi --</option>
          </select>
        </div>
        <div class="nav-input-group">
          <label for="route-target">Điểm đến:</label>
          <select id="route-target">
            <option value="">-- Chọn phòng đến --</option>
          </select>
        </div>
        <div class="nav-button-group">
          <button id="btn-find-route" class="btn-primary">Tìm Đường</button>
          <button id="btn-clear-route" class="btn-secondary">Xóa</button>
        </div>
        <div id="route-info" class="route-info-box"></div>
      </div>

      <!-- Debug Navigation Algorithm Section -->
      <div class="nav-section">
        <div class="nav-section-title">🛠️ DEBUG THUẬT TOÁN</div>
        <div class="nav-button-group" style="flex-direction: column; gap: 6px;">
          <button id="btn-debug-clear" class="btn-secondary" style="background: #fee2e2; color: #ef4444; border-color: #f87171;">Xóa Tất Cả Node</button>
          <button id="btn-debug-doors" class="btn-secondary">🚪 Sinh Node Cửa</button>
          <button id="btn-debug-corridors" class="btn-secondary">🛣️ Sinh Node Hành Lang</button>
          <button id="btn-debug-edges" class="btn-primary">🔗 Sinh Cạnh & Liên Kết</button>
        </div>
      </div>

      <!-- Step-by-step Geometry Visual Proof Section -->
      <div class="nav-section">
        <div class="nav-section-title">🔍 BẰNG CHỨNG HÌNH HỌC (MPRSS)</div>
        <div class="nav-button-group" style="flex-direction: column; gap: 6px;">
          <button id="btn-step1-pb" class="btn-secondary">🔴 Step 1: P_b (Đỉnh tường)</button>
          <button id="btn-step2-tin" class="btn-secondary">📐 Step 2: Delaunay TIN</button>
          <button id="btn-step3-zigzag" class="btn-secondary">⚡ Step 3: E_zigzag (Cạnh chéo)</button>
          <button id="btn-step4-pmid" class="btn-secondary">📍 Step 4: P_Mid (Trung điểm)</button>
        </div>
      </div>

      <div class="detail-card" id="detail-card">
        <h3 id="detail-title">Tên phòng</h3>
        <p id="detail-code">Mã phòng</p>
        <p id="detail-desc">Mô tả chi tiết phòng khám</p>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <span class="detail-badge" id="detail-zone">Khu khám</span>
        </div>
        <div class="detail-action-buttons">
          <button id="btn-set-start" class="btn-action-primary">📍 Đặt làm điểm xuất phát</button>
          <button id="btn-set-target" class="btn-action-primary">🏁 Đặt làm điểm đến</button>
        </div>
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

    function distToSegment(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
      let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    const AREA_COLORS = {
      'OPH': 0xef476f,   // Mắt: Pink
      'SUR': 0x1c6ef3,   // Ngoại: Blue
      'ORTH': 0xe85d04,  // CTCH: Orange
      'Default': 0x64748b
    };

    const NODE_COLORS = {
      'ROOM_ENTRANCE': 0xf59e0b,
      'CORRIDOR': 0x6366f1,
      'JUNCTION': 0x6366f1,
      'ELEVATOR': 0x10b981,
      'STAIRS': 0x14b8a6,
      'ESCALATOR': 0x06b6d4,
      'EXIT': 0xef4444,
      'Default': 0xf59e0b
    };

    // Initialize UI info
    const bName = document.getElementById('b-name');
    const bAddress = document.getElementById('b-address');
    const detailCard = document.getElementById('detail-card');
    const detailTitle = document.getElementById('detail-title');
    const detailCode = document.getElementById('detail-code');
    const detailDesc = document.getElementById('detail-desc');
    const detailZone = document.getElementById('detail-zone');

    bName.textContent = MAP_DATA.building.name;
    bAddress.textContent = MAP_DATA.building.addressLabel || 'Khoa Khám Bệnh';
    
    const roomsMap = new Map(); // Store room 3D objects for reference

    // Scene Setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcbd5e1);
    scene.fog = new THREE.FogExp2(0xcbd5e1, 0.005);

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
    controls.target.set(60, 0, -40);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.25);
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

    // Grid Floor / Base Guide (Subtle light grid)
    const gridHelper = new THREE.GridHelper(200, 50, 0xcbdee9, 0xe2e8f0);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // --- Build 3D Elements from data ---
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    const activeFloor = MAP_DATA.floors[0];
    
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
            color: 0xffffff, 
            transparent: true,
            opacity: 0.9,
            roughness: 0.5,
            metalness: 0.05
          });
          const floorMesh = new THREE.Mesh(floorGeo, floorMat);
          floorMesh.rotation.x = Math.PI / 2;
          floorMesh.scale.set(1, 1, -1);
          floorMesh.position.y = -0.5;
          floorMesh.receiveShadow = true;
          mapGroup.add(floorMesh);
        }
      } catch (err) {
        console.error("Lỗi vẽ floor outline:", err);
      }

      // 1b. Draw Area boundaries (ĐÃ ĐỒNG BỘ Y NHƯ ROOM WALLS)
      if (activeFloor.areas) {
        activeFloor.areas.forEach(area => {
          if (area.boundaries) {
            area.boundaries.forEach(boundary => {
              try {
                if (boundary.lineGeom && boundary.lineGeom.coordinates) {
                  const coords = boundary.lineGeom.coordinates;
                  const p1 = convertCoords(coords[0][0], coords[0][1]);
                  const p2 = convertCoords(coords[1][0], coords[1][1]);
                  
                  const dx = p2.x - p1.x;
                  const dz = p2.z - p1.z;
                  const distance = Math.sqrt(dx*dx + dz*dz);
                  if (distance < 0.05) return; // skip zero-length segments
                  const angle = Math.atan2(dz, dx);

                  if (boundary.boundaryType === 'DOOR') {
                    // Cửa Area chuẩn hóa kích thước giống cửa Room
                    const doorGeo = new THREE.BoxGeometry(distance, 2.0, 0.2);
                    const doorMat = new THREE.MeshStandardMaterial({
                      color: 0x38bdf8,
                      roughness: 0.3,
                      metalness: 0.2
                    });
                    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
                    doorMesh.position.set((p1.x + p2.x)/2, 1.0, (p1.z + p2.z)/2);
                    doorMesh.rotation.y = -angle;
                    mapGroup.add(doorMesh);
                  } else {
                    // Tường Area chuẩn hóa 100% giống tường Room: cao 3.0m, dày 0.15m, màu 0xe2e8f0
                    const wallGeo = new THREE.BoxGeometry(distance, 3.0, 0.15);
                    const wallMat = new THREE.MeshStandardMaterial({
                      color: 0xe2e8f0,
                      roughness: 0.4,
                      metalness: 0.1
                    });
                    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                    wallMesh.position.set((p1.x + p2.x)/2, 1.5, (p1.z + p2.z)/2);
                    wallMesh.rotation.y = -angle;
                    mapGroup.add(wallMesh);

                    const edges = new THREE.EdgesGeometry(wallGeo);
                    const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
                      color: 0x94a3b8,
                      linewidth: 1.5,
                      transparent: true,
                      opacity: 0.2
                    }));
                    wallMesh.add(wireframe);
                  }
                }
              } catch (err) {
                console.error("Lỗi vẽ area boundary:", err);
              }
            });
          }
        });
      }

      // 1c. Draw Standalone Boundaries (ĐÃ ĐỒNG BỘ Y NHƯ ROOM WALLS)
      if (activeFloor.standaloneBoundaries) {
        activeFloor.standaloneBoundaries.forEach(boundary => {
          try {
            if (boundary.lineGeom && boundary.lineGeom.coordinates) {
              const coords = boundary.lineGeom.coordinates;
              const p1 = convertCoords(coords[0][0], coords[0][1]);
              const p2 = convertCoords(coords[1][0], coords[1][1]);
              
              const dx = p2.x - p1.x;
              const dz = p2.z - p1.z;
              const distance = Math.sqrt(dx*dx + dz*dz);
              if (distance < 0.05) return; // skip zero-length segments
              const angle = Math.atan2(dz, dx);

              if (boundary.boundaryType === 'DOOR') {
                // Cửa bao ngoài/vách ngăn chuẩn hóa kích thước giống cửa Room
                const doorGeo = new THREE.BoxGeometry(distance, 2.0, 0.2);
                const doorMat = new THREE.MeshStandardMaterial({
                  color: 0x38bdf8,
                  roughness: 0.3,
                  metalness: 0.2
                });
                const doorMesh = new THREE.Mesh(doorGeo, doorMat);
                doorMesh.position.set((p1.x + p2.x)/2, 1.0, (p1.z + p2.z)/2);
                doorMesh.rotation.y = -angle;
                mapGroup.add(doorMesh);
              } else {
                // Tất cả Tường bao ngoài & Vách ngăn chuẩn hóa 100% giống tường Room
                const wallGeo = new THREE.BoxGeometry(distance, 3.0, 0.15);
                const wallMat = new THREE.MeshStandardMaterial({
                  color: 0xe2e8f0,
                  roughness: 0.4,
                  metalness: 0.1
                });
                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                wallMesh.position.set((p1.x + p2.x)/2, 1.5, (p1.z + p2.z)/2);
                wallMesh.rotation.y = -angle;
                mapGroup.add(wallMesh);

                const edges = new THREE.EdgesGeometry(wallGeo);
                const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
                  color: 0x94a3b8,
                  linewidth: 1.5,
                  transparent: true,
                  opacity: 0.2
                }));
                wallMesh.add(wireframe);
              }
            }
          } catch (err) {
            console.error("Lỗi vẽ standalone boundary:", err);
          }
        });
      }

      // 2. Build Rooms (With uniform premium blue/teal theme)
      if (activeFloor.rooms) {
        activeFloor.rooms.forEach(room => {
          try {
            const area = activeFloor.areas?.find(a => a.id === room.areaId);
            const areaLabel = area ? area.areaLabel : 'Khu Vực Khác';
            const areaCode = area ? area.areaCode : 'Default';
            const areaColor = AREA_COLORS[areaCode] || AREA_COLORS.Default;

            const roomColor = 0x3b82f6; // Uniform blue for all rooms

            if (room.outlineGeom && room.outlineGeom.coordinates) {
              const coords = room.outlineGeom.coordinates[0];
              const shape = new THREE.Shape();
              coords.forEach((coord, idx) => {
                const pt = convertCoords(coord[0], coord[1]);
                if (idx === 0) shape.moveTo(pt.x, pt.z);
                else shape.lineTo(pt.x, pt.z);
              });

              const floorExtrudeSettings = { depth: 0.02, bevelEnabled: false };
              const roomGeo = new THREE.ExtrudeGeometry(shape, floorExtrudeSettings);
              const roomMat = new THREE.MeshStandardMaterial({
                color: roomColor,
                transparent: true,
                opacity: 0.0, // Invisible by default
                roughness: 0.8,
                metalness: 0.1,
                side: THREE.DoubleSide
              });
              const roomMesh = new THREE.Mesh(roomGeo, roomMat);
              roomMesh.rotation.x = Math.PI / 2;
              roomMesh.scale.set(1, 1, -1);
              roomMesh.position.y = 0.01; // Prevent depth fighting with floor slab
              
              roomMesh.userData = {
                id: room.id,
                code: room.roomCode,
                label: room.roomLabel,
                areaLabel: areaLabel,
                areaColor: areaColor
              };

              mapGroup.add(roomMesh);
              roomsMap.set(room.id, roomMesh);

              // 2b. Draw Room Boundaries (Walls & Doors)
              if (room.boundaries) {
                room.boundaries.forEach(boundary => {
                  if (boundary.lineGeom && boundary.lineGeom.coordinates) {
                    try {
                      const bCoords = boundary.lineGeom.coordinates;
                      const bp1 = convertCoords(bCoords[0][0], bCoords[0][1]);
                      const bp2 = convertCoords(bCoords[1][0], bCoords[1][1]);
                      
                      const bdx = bp2.x - bp1.x;
                      const bdz = bp2.z - bp1.z;
                      const bdist = Math.sqrt(bdx*bdx + bdz*bdz);
                      const bangle = Math.atan2(bdz, bdx);

                      if (boundary.boundaryType === 'DOOR') {
                        // Render precise 3D door box collinear to RoomBoundary segment (thickness 0.2m)
                        const doorGeo = new THREE.BoxGeometry(bdist, 2.0, 0.2);
                        const doorMat = new THREE.MeshStandardMaterial({
                          color: 0x38bdf8,
                          roughness: 0.3,
                          metalness: 0.2
                        });
                        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
                        doorMesh.position.set((bp1.x + bp2.x)/2, 1.0, (bp1.z + bp2.z)/2);
                        doorMesh.rotation.y = -bangle;
                        mapGroup.add(doorMesh);
                      } else {
                        // Render room wall segment (thickness 0.15m, height 3.0m)
                        const wallGeo = new THREE.BoxGeometry(bdist, 3.0, 0.15);
                        const wallMat = new THREE.MeshStandardMaterial({
                          color: 0xe2e8f0, // gray/white wall color
                          roughness: 0.4,
                          metalness: 0.1
                        });
                        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                        wallMesh.position.set((bp1.x + bp2.x)/2, 1.5, (bp1.z + bp2.z)/2);
                        wallMesh.rotation.y = -bangle;
                        mapGroup.add(wallMesh);

                        // Subtle edge wireframe
                        const edges = new THREE.EdgesGeometry(wallGeo);
                        const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
                          color: 0x94a3b8,
                          linewidth: 1.5,
                          transparent: true,
                          opacity: 0.2
                        }));
                        wallMesh.add(wireframe);
                      }
                    } catch (doorErr) {
                      console.error("Lỗi vẽ room boundary:", doorErr);
                    }
                  }
                });
              }

              // Add HTML label
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

      // 3. Draw Navigation Nodes as small circular dots
      try {
        if (activeFloor.nodes && activeFloor.nodes.length > 0) {
          activeFloor.nodes.forEach(node => {
            if (!node.coordsGeom || !node.coordsGeom.coordinates) return;

            const pt = convertCoords(node.coordsGeom.coordinates[0], node.coordsGeom.coordinates[1]);
            const nodeColor = NODE_COLORS[node.type] || NODE_COLORS.Default;

            // Flat disc on the floor + small sphere for visibility from any angle
            const dotGeo = new THREE.CircleGeometry(0.35, 16);
            const dotMat = new THREE.MeshStandardMaterial({
              color: nodeColor,
              emissive: nodeColor,
              emissiveIntensity: 0.35,
              roughness: 0.4,
              metalness: 0.2,
              side: THREE.DoubleSide
            });
            const dotMesh = new THREE.Mesh(dotGeo, dotMat);
            dotMesh.rotation.x = -Math.PI / 2;
            dotMesh.position.set(pt.x, 0.08, pt.z);
            dotMesh.receiveShadow = false;

            const nodeGeo = new THREE.SphereGeometry(0.18, 12, 12);
            const nodeMat = new THREE.MeshStandardMaterial({
              color: nodeColor,
              emissive: nodeColor,
              emissiveIntensity: 0.45,
              roughness: 0.3,
              metalness: 0.4
            });
            const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
            nodeMesh.position.set(pt.x, 0.22, pt.z);
            nodeMesh.castShadow = true;

            nodeMesh.userData = {
              id: node.id,
              type: 'NODE',
              nodeType: node.type
            };
            dotMesh.userData = nodeMesh.userData;

            mapGroup.add(dotMesh);
            mapGroup.add(nodeMesh);
          });
        }
      } catch (e) {
        console.error("Lỗi vẽ nodes:", e);
      }

      // 4. Placed Features (Reception desks from mapData / DB)
      try {
        if (activeFloor.placedFeatures) {
          activeFloor.placedFeatures.forEach(feat => {
            if (feat.geometryGeom && feat.geometryGeom.coordinates) {
              const pt = convertCoords(feat.geometryGeom.coordinates[0], feat.geometryGeom.coordinates[1]);
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
        }
      } catch (e) {
        console.error("Lỗi vẽ features:", e);
      }
    }

    // --- HTML overlay text labels ---
    const labelContainer = document.getElementById('label-container');
    const labelElements = [];

    function createRoomLabel(code, label, x, z, roomId) {
      const div = document.createElement('div');
      div.className = 'room-label';
      div.textContent = code;
      div.dataset.roomId = roomId;
      labelContainer.appendChild(div);
      labelElements.push({ element: div, pos: new THREE.Vector3(x, 1.6, z), roomId });
    }

    function updateLabels() {
      const tempV = new THREE.Vector3();
      labelElements.forEach(item => {
        tempV.copy(item.pos);
        tempV.project(camera);

        if (tempV.z > 1) {
          item.element.style.display = 'none';
          return;
        }

        const x = (tempV.x *  .5 + .5) * window.innerWidth;
        const y = (tempV.y * -.5 + .5) * window.innerHeight;

        item.element.style.display = 'block';
        item.element.style.left = \`\${x}px\`;
        item.element.style.top = \`\${y}px\`;
        
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
      if (event.target.tagName !== 'CANVAS') return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(mapGroup.children);

      const roomIntersect = intersects.find(intersect => intersect.object.userData && intersect.object.userData.code);

      if (roomIntersect) {
        const mesh = roomIntersect.object;
        if (hoveredMesh !== mesh && mesh !== selectedMesh) {
          if (hoveredMesh && hoveredMesh !== selectedMesh) {
            hoveredMesh.material.opacity = 0.0;
          }
          hoveredMesh = mesh;
          hoveredMesh.material.opacity = 0.15;
        }
      } else {
        if (hoveredMesh && hoveredMesh !== selectedMesh) {
          hoveredMesh.material.opacity = 0.0;
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

    let selectedRoomIdForActions = null; // Track selected room for Action buttons

    function selectRoom(mesh) {
      if (selectedMesh) {
        selectedMesh.material.opacity = 0.0;
      }
      selectedMesh = mesh;
      selectedMesh.material.opacity = 0.3;
      selectedRoomIdForActions = mesh.userData.id;
      
      detailTitle.textContent = mesh.userData.label;
      detailCode.textContent = 'Mã phòng: ' + mesh.userData.code;
      detailDesc.textContent = 'Phòng khám thuộc ' + mesh.userData.areaLabel + '.';
      detailZone.textContent = mesh.userData.areaLabel;
      const colorHex = '#' + mesh.userData.areaColor.toString(16).padStart(6, '0');
      detailZone.style.backgroundColor = colorHex;
      detailZone.style.color = '#ffffff';
      detailCard.style.display = 'block';

      // Animate camera target towards room center
      const box = new THREE.Box3().setFromObject(mesh);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      const startTarget = controls.target.clone();
      const endTarget = center.clone();
      const startCamPos = camera.position.clone();
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
        selectedMesh.material.opacity = 0.0;
        selectedMesh = null;
      }
      selectedRoomIdForActions = null;
      detailCard.style.display = 'none';
    }

    // --- Pathfinding Integration ---
    const selectStart = document.getElementById('route-start');
    const selectTarget = document.getElementById('route-target');
    const btnFindRoute = document.getElementById('btn-find-route');
    const btnClearRoute = document.getElementById('btn-clear-route');
    const btnSetStart = document.getElementById('btn-set-start');
    const btnSetTarget = document.getElementById('btn-set-target');
    const routeInfoBox = document.getElementById('route-info');

    // Populate selects with rooms sorted alphabetically by roomCode
    if (activeFloor && activeFloor.rooms) {
      const sortedRooms = [...activeFloor.rooms].sort((a, b) => a.roomCode.localeCompare(b.roomCode));
      sortedRooms.forEach(room => {
        const label = room.roomLabel.includes('Phòng trống') ? \`\${room.roomCode} - Phòng trống\` : \`\${room.roomCode} - \${room.roomLabel}\`;
        
        const optStart = document.createElement('option');
        optStart.value = room.id;
        optStart.textContent = label;
        selectStart.appendChild(optStart);

        const optTarget = document.createElement('option');
        optTarget.value = room.id;
        optTarget.textContent = label;
        selectTarget.appendChild(optTarget);
      });
    }

    // Detail card set points listeners
    btnSetStart.addEventListener('click', () => {
      if (selectedRoomIdForActions) {
        selectStart.value = selectedRoomIdForActions;
        if (selectTarget.value) {
          calculateRoute();
        }
      }
    });

    btnSetTarget.addEventListener('click', () => {
      if (selectedRoomIdForActions) {
        selectTarget.value = selectedRoomIdForActions;
        if (selectStart.value) {
          calculateRoute();
        }
      }
    });

    btnFindRoute.addEventListener('click', calculateRoute);
    btnClearRoute.addEventListener('click', clearRoute);

    let activePathMesh = null;

    async function calculateRoute() {
      const startId = selectStart.value;
      const targetId = selectTarget.value;

      if (!startId || !targetId) {
        alert('Vui lòng chọn đầy đủ điểm xuất phát và điểm đến!');
        return;
      }
      if (startId === targetId) {
        alert('Điểm xuất phát và điểm đến không được trùng nhau!');
        return;
      }

      routeInfoBox.innerHTML = '⚡ <i>Đang tính toán đường đi tối ưu...</i>';
      routeInfoBox.style.display = 'block';

      try {
        const res = await fetch(\`/api/navigation/route?startType=ROOM&startId=\${startId}&targetType=ROOM&targetId=\${targetId}\`);
        const payload = await res.json();
        
        if (payload.status === 'success' && payload.data && payload.data.path && payload.data.path.length > 0) {
          const routeData = payload.data;
          routeInfoBox.innerHTML = \`🟢 <b>Tìm đường thành công!</b><br>📏 Quãng đường: <b>\${routeData.totalDistance.toFixed(1)} mét</b>\`;
          draw3DPath(routeData.path);
        } else {
          routeInfoBox.innerHTML = '❌ <b>Không tìm thấy đường đi!</b><br>Đồ thị liên kết có thể chưa được sinh hoàn thiện.';
          clear3DPath();
        }
      } catch (err) {
        console.error('Lỗi tính đường đi:', err);
        routeInfoBox.innerHTML = '❌ <b>Lỗi kết nối!</b> Không thể gọi API tìm đường.';
        clear3DPath();
      }
    }

    function draw3DPath(pathNodes) {
      clear3DPath();

      if (!pathNodes || pathNodes.length < 2) return;

      // 1. Convert node coordinates to 3D vectors
      const points = pathNodes.map(node => {
        const pt = convertCoords(node.coords[0], node.coords[1]);
        // Elevate slightly (0.4m) so it sits floating nicely above the floor slab
        return new THREE.Vector3(pt.x, 0.4, pt.z);
      });

      // 2. Build 3D Tube geometry for neon path effect
      try {
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, 0.18, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4, // Cyan Neon
          emissive: 0x0891b2,
          emissiveIntensity: 0.6,
          roughness: 0.1,
          metalness: 0.8,
          transparent: true,
          opacity: 0.85
        });

        activePathMesh = new THREE.Mesh(tubeGeo, tubeMat);
        mapGroup.add(activePathMesh);
      } catch (err) {
        console.error("Lỗi vẽ 3D Path Tube:", err);
      }

      // 3. Highlight Start and Target rooms visually
      const startNode = pathNodes[0];
      const targetNode = pathNodes[pathNodes.length - 1];

      roomsMap.forEach((mesh) => {
        const id = mesh.userData.id;
        mesh.material.color.setHex(0x3b82f6); // Reset color
        mesh.material.opacity = 0.0;

        if (id === startNode.metadata?.roomId) {
          mesh.material.color.setHex(0x10b981); // Start is Green
          mesh.material.opacity = 0.3;
        } else if (id === targetNode.metadata?.roomId) {
          mesh.material.color.setHex(0xef476f); // Target is Red
          mesh.material.opacity = 0.3;
        }
      });
    }

    function clear3DPath() {
      if (activePathMesh) {
        mapGroup.remove(activePathMesh);
        activePathMesh.geometry.dispose();
        activePathMesh.material.dispose();
        activePathMesh = null;
      }
      roomsMap.forEach((mesh) => {
        mesh.material.color.setHex(0x3b82f6);
        mesh.material.opacity = 0.0;
      });
    }

    function clearRoute() {
      selectStart.value = '';
      selectTarget.value = '';
      routeInfoBox.style.display = 'none';
      clear3DPath();
    }

<<<<<<< Updated upstream
=======
    // Toggle Nodes visibility
    const btnToggleNodes = document.getElementById('btn-toggle-nodes');
    let isNodesVisible = true;
    if (btnToggleNodes) {
      btnToggleNodes.addEventListener('click', () => {
        isNodesVisible = !isNodesVisible;
        nodesGroup.visible = isNodesVisible;
        
        if (isNodesVisible) {
          btnToggleNodes.classList.add('active');
          btnToggleNodes.style.background = '#6366f1';
          btnToggleNodes.style.color = '#ffffff';
          btnToggleNodes.style.borderColor = '#4f46e5';
          btnToggleNodes.textContent = '📍 Nodes: Hiện';
        } else {
          btnToggleNodes.classList.remove('active');
          btnToggleNodes.style.background = '';
          btnToggleNodes.style.color = '';
          btnToggleNodes.style.borderColor = '';
          btnToggleNodes.textContent = '📍 Nodes: Ẩn';
        }
      });
    }

    // --- Debug Algorithm Triggers ---
    async function triggerGraphAlgorithm(endpoint, buttonId, loadingText) {
      const btn = document.getElementById(buttonId);
      if (!btn) return;
      const originalText = btn.textContent;
      const originalBg = btn.style.background;
      btn.textContent = loadingText || 'Đang xử lý...';
      btn.disabled = true;
      btn.style.background = '#94a3b8';
      btn.style.color = '#ffffff';

      try {
        const res = await fetch(\`/api/graph/\${activeFloor.id}/\${endpoint}\`, { method: endpoint === 'nodes' ? 'DELETE' : 'POST' });
        const payload = await res.json();
        if (payload.status === 'success') {
          btn.textContent = 'Thành công! Đang tải lại...';
          btn.style.background = '#10b981';
          setTimeout(() => window.location.reload(), 1000);
        } else {
          alert('Lỗi: ' + (payload.message || 'Không xác định'));
          btn.textContent = originalText;
          btn.style.background = originalBg;
          btn.disabled = false;
        }
      } catch (err) {
        alert('Lỗi kết nối API!');
        console.error(err);
        btn.textContent = originalText;
        btn.style.background = originalBg;
        btn.disabled = false;
      }
    }

    const btnDebugClear = document.getElementById('btn-debug-clear');
    if (btnDebugClear) {
      btnDebugClear.addEventListener('click', () => {
        if(confirm('Bạn có chắc chắn muốn xóa TẤT CẢ node và cạnh trên tầng này?')) {
          triggerGraphAlgorithm('nodes', 'btn-debug-clear', 'Đang xóa...');
        }
      });
    }
    const btnDebugDoors = document.getElementById('btn-debug-doors');
    if (btnDebugDoors) btnDebugDoors.addEventListener('click', () => triggerGraphAlgorithm('generate/doors', 'btn-debug-doors'));
    const btnDebugCorridors = document.getElementById('btn-debug-corridors');
    if (btnDebugCorridors) btnDebugCorridors.addEventListener('click', () => triggerGraphAlgorithm('generate/corridors', 'btn-debug-corridors'));
    const btnDebugEdges = document.getElementById('btn-debug-edges');
    if (btnDebugEdges) btnDebugEdges.addEventListener('click', () => triggerGraphAlgorithm('generate/edges', 'btn-debug-edges', 'Đang tạo Graph...'));

    // --- Step-by-Step Geometry Debug Layers (MPRSS) ---
    const debugPbGroup = new THREE.Group();
    const debugTinGroup = new THREE.Group();
    const debugZigzagGroup = new THREE.Group();
    const debugPmidGroup = new THREE.Group();

    debugPbGroup.visible = false;
    debugTinGroup.visible = false;
    debugZigzagGroup.visible = false;
    debugPmidGroup.visible = false;

    mapGroup.add(debugPbGroup);
    mapGroup.add(debugTinGroup);
    mapGroup.add(debugZigzagGroup);
    mapGroup.add(debugPmidGroup);

    let isDebugStepsLoaded = false;
    let debugStepsData = null;

    async function loadDebugStepsData() {
      if (isDebugStepsLoaded) return true;
      try {
        const res = await fetch(\`/api/graph/\${activeFloor.id}/debug-steps\`);
        const payload = await res.json();
        if (payload.status === 'success' && payload.data) {
          debugStepsData = payload.data;
          renderDebugStepLayers();
          isDebugStepsLoaded = true;
          return true;
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu debug steps:', err);
      }
      return false;
    }

    function renderDebugStepLayers() {
      if (!debugStepsData) return;

      // 1. Step 1: P_b (Red Dots at wall corners)
      if (debugStepsData.pbPoints) {
        const dotGeo = new THREE.SphereGeometry(0.25, 12, 12);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.5 });
        debugStepsData.pbPoints.forEach(coord => {
          const pt = convertCoords(coord[0], coord[1]);
          const mesh = new THREE.Mesh(dotGeo, dotMat);
          mesh.position.set(pt.x, 0.15, pt.z);
          debugPbGroup.add(mesh);
        });
      }

      // 2. Step 2: Delaunay TIN (Thin Gray Lines)
      if (debugStepsData.tinEdges) {
        const lineMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 });
        debugStepsData.tinEdges.forEach(([p1, p2]) => {
          const pt1 = convertCoords(p1[0], p1[1]);
          const pt2 = convertCoords(p2[0], p2[1]);
          const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(pt1.x, 0.12, pt1.z),
            new THREE.Vector3(pt2.x, 0.12, pt2.z)
          ]);
          const line = new THREE.Line(geometry, lineMat);
          debugTinGroup.add(line);
        });
      }

      // 3. Step 3: E_zigzag (Glowing Cyan Lines)
      if (debugStepsData.zigzagEdges) {
        const lineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 });
        debugStepsData.zigzagEdges.forEach(([p1, p2]) => {
          const pt1 = convertCoords(p1[0], p1[1]);
          const pt2 = convertCoords(p2[0], p2[1]);
          const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(pt1.x, 0.2, pt1.z),
            new THREE.Vector3(pt2.x, 0.2, pt2.z)
          ]);
          const line = new THREE.Line(geometry, lineMat);
          debugZigzagGroup.add(line);
        });
      }

      // 4. Step 4: P_Mid (Orange Spheres)
      if (debugStepsData.pmidPoints) {
        const dotGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6 });
        debugStepsData.pmidPoints.forEach(coord => {
          const pt = convertCoords(coord[0], coord[1]);
          const mesh = new THREE.Mesh(dotGeo, dotMat);
          mesh.position.set(pt.x, 0.25, pt.z);
          debugPmidGroup.add(mesh);
        });
      }
    }

    function setupStepToggle(btnId, group, activeColor, textLabel) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      let active = false;
      btn.addEventListener('click', async () => {
        if (!isDebugStepsLoaded) {
          btn.textContent = 'Đang tải dữ liệu...';
          const ok = await loadDebugStepsData();
          if (!ok) {
            alert('Không thể tải dữ liệu hình học debug!');
            btn.textContent = textLabel;
            return;
          }
        }
        active = !active;
        group.visible = active;
        if (active) {
          btn.style.background = activeColor;
          btn.style.color = '#ffffff';
          btn.style.borderColor = activeColor;
          btn.textContent = textLabel + ' (Hiện)';
        } else {
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
          btn.textContent = textLabel;
        }
      });
    }

    setupStepToggle('btn-step1-pb', debugPbGroup, '#ef4444', '🔴 Step 1: P_b (Đỉnh tường)');
    setupStepToggle('btn-step2-tin', debugTinGroup, '#64748b', '📐 Step 2: Delaunay TIN');
    setupStepToggle('btn-step3-zigzag', debugZigzagGroup, '#06b6d4', '⚡ Step 3: E_zigzag (Cạnh chéo)');
    setupStepToggle('btn-step4-pmid', debugPmidGroup, '#f59e0b', '📍 Step 4: P_Mid (Trung điểm)');

>>>>>>> Stashed changes
    window.addEventListener('resize', onWindowResize);

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    let pulseTime = 0;

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      updateLabels();

      // Pulsing effect for the active path mesh
      if (activePathMesh) {
        pulseTime += 0.05;
        activePathMesh.material.emissiveIntensity = 0.5 + Math.sin(pulseTime) * 0.35;
      }

      renderer.render(scene, camera);
    }
    
    animate();
  </script>
</body>
</html>`;
}