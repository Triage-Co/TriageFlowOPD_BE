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

    const CLINIC_COLORS = {
      'OPH': 0xef476f,   // Mắt: Pink
      'SUR': 0x1c6ef3,   // Ngoại: Blue
      'ORTH': 0xe85d04,  // CTCH: Orange
      'Default': 0x64748b
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
      } catch (e) {
        console.error("Lỗi vẽ Floor Slab:", e);
      }

      // 1b. Draw Clinic Boundaries (Colored partitions)
      if (activeFloor.clinics) {
        activeFloor.clinics.forEach(clinic => {
          const color = CLINIC_COLORS[clinic.clinicCode] || CLINIC_COLORS.Default;
          if (clinic.boundaries) {
            clinic.boundaries.forEach(boundary => {
              try {
                if (boundary.lineGeom && boundary.lineGeom.coordinates) {
                  const coords = boundary.lineGeom.coordinates;
                  const p1 = convertCoords(coords[0][0], coords[0][1]);
                  const p2 = convertCoords(coords[1][0], coords[1][1]);
                  
                  const dx = p2.x - p1.x;
                  const dz = p2.z - p1.z;
                  const distance = Math.sqrt(dx*dx + dz*dz);
                  const angle = Math.atan2(dz, dx);

                  const wallGeo = new THREE.BoxGeometry(distance, 3.2, 0.15);
                  const wallMat = new THREE.MeshStandardMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.25,
                    roughness: 0.2,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                  });
                  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                  
                  wallMesh.position.set((p1.x + p2.x)/2, 1.6, (p1.z + p2.z)/2);
                  wallMesh.rotation.y = -angle;
                  mapGroup.add(wallMesh);

                  const edges = new THREE.EdgesGeometry(wallGeo);
                  const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
                    color: color,
                    linewidth: 3,
                    transparent: true,
                    opacity: 0.9
                  }));
                  wallMesh.add(wireframe);
                }
              } catch (err) {
                console.error("Lỗi vẽ clinic boundary:", err);
              }
            });
          }
        });
      }

      // Helper to check closest clinic boundary segment (for clinic-level doors)
      function findClosestClinicBoundary(pt) {
        let minClinicDist = Infinity;
        let closestSeg = null;
        if (activeFloor.clinics) {
          activeFloor.clinics.forEach(c => {
            if (c.boundaries) {
              c.boundaries.forEach(b => {
                if (b.lineGeom && b.lineGeom.coordinates) {
                  const p1 = convertCoords(b.lineGeom.coordinates[0][0], b.lineGeom.coordinates[0][1]);
                  const p2 = convertCoords(b.lineGeom.coordinates[1][0], b.lineGeom.coordinates[1][1]);
                  const dist = distToSegment(pt.x, pt.z, p1.x, p1.z, p2.x, p2.z);
                  if (dist < minClinicDist) {
                    minClinicDist = dist;
                    closestSeg = { p1, p2 };
                  }
                }
              });
            }
          });
        }
        return { closestSeg, dist: minClinicDist };
      }

      // 2. Build Rooms (With uniform premium blue/teal theme)
      if (activeFloor.rooms) {
        activeFloor.rooms.forEach(room => {
          try {
            const clinic = activeFloor.clinics?.find(c => c.id === room.clinicId);
            const clinicLabel = clinic ? clinic.clinicLabel : 'Khu Vực Khác';
            const clinicCode = clinic ? clinic.clinicCode : 'Default';
            const clinicColor = CLINIC_COLORS[clinicCode] || CLINIC_COLORS.Default;

            const roomColor = 0x3b82f6; // Uniform blue for all rooms

            if (room.outlineGeom && room.outlineGeom.coordinates) {
              const coords = room.outlineGeom.coordinates[0];
              const shape = new THREE.Shape();
              coords.forEach((coord, idx) => {
                const pt = convertCoords(coord[0], coord[1]);
                if (idx === 0) shape.moveTo(pt.x, pt.z);
                else shape.lineTo(pt.x, pt.z);
              });

              const wallHeight = room.heightMeters || 3.0;
              const extrudeSettings = { depth: wallHeight, bevelEnabled: false };
              const roomGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
              const roomMat = new THREE.MeshStandardMaterial({
                color: roomColor,
                transparent: true,
                opacity: 0.8,
                roughness: 0.2,
                metalness: 0.1,
                side: THREE.DoubleSide
              });
              const roomMesh = new THREE.Mesh(roomGeo, roomMat);
              roomMesh.rotation.x = Math.PI / 2;
              roomMesh.scale.set(1, 1, -1);
              roomMesh.castShadow = true;
              roomMesh.receiveShadow = true;

              // Room wireframe helper (inherits roomMesh rotation/scale automatically)
              const edges = new THREE.EdgesGeometry(roomGeo);
              const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
                color: 0x2563eb, 
                linewidth: 1.5, 
                transparent: true, 
                opacity: 0.65 
              }));
              roomMesh.add(line);

              roomMesh.userData = {
                id: room.id,
                code: room.roomCode,
                label: room.roomLabel,
                clinicLabel: clinicLabel,
                clinicColor: clinicColor
              };

              mapGroup.add(roomMesh);
              roomsMap.set(room.id, roomMesh);

              // 2b. Draw Room Boundaries and identify DOOR segments
              if (room.boundaries) {
                room.boundaries.forEach(boundary => {
                  if (boundary.boundaryType === 'DOOR' && boundary.lineGeom && boundary.lineGeom.coordinates) {
                    try {
                      const bCoords = boundary.lineGeom.coordinates;
                      const bp1 = convertCoords(bCoords[0][0], bCoords[0][1]);
                      const bp2 = convertCoords(bCoords[1][0], bCoords[1][1]);
                      
                      const bdx = bp2.x - bp1.x;
                      const bdz = bp2.z - bp1.z;
                      const bdist = Math.sqrt(bdx*bdx + bdz*bdz);
                      const bangle = Math.atan2(bdz, bdx);

                      // Render precise 3D door box collinear to RoomBoundary segment
                      const doorGeo = new THREE.BoxGeometry(bdist, 2.0, 0.1);
                      const doorMat = new THREE.MeshStandardMaterial({
                        color: 0x38bdf8,
                        transparent: true,
                        opacity: 0.85,
                        roughness: 0.3,
                        metalness: 0.1
                      });
                      const doorMesh = new THREE.Mesh(doorGeo, doorMat);
                      doorMesh.position.set((bp1.x + bp2.x)/2, 1.0, (bp1.z + bp2.z)/2);
                      doorMesh.rotation.y = -bangle;
                      mapGroup.add(doorMesh);
                    } catch (doorErr) {
                      console.error("Lỗi vẽ room door:", doorErr);
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

      // 3. Draw Clinic-level doors (where roomAId is null)
      if (activeFloor.doors) {
        activeFloor.doors.forEach(door => {
          try {
            if (door.roomAId === null && door.positionGeom && door.positionGeom.coordinates) {
              const pt = convertCoords(door.positionGeom.coordinates[0], door.positionGeom.coordinates[1]);
              let angle = 0;
              let width = 1.5; // Clinic doors are door2 by default, so they are wider (1.5m)
              
              const { closestSeg, dist } = findClosestClinicBoundary(pt);
              if (closestSeg && dist < 2.0) {
                const dx = closestSeg.p2.x - closestSeg.p1.x;
                const dz = closestSeg.p2.z - closestSeg.p1.z;
                angle = Math.atan2(dz, dx);
              }
              
              const doorGeo = new THREE.BoxGeometry(width, 2.0, 0.1);
              const doorMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.85,
                roughness: 0.3,
                metalness: 0.1
              });
              const doorMesh = new THREE.Mesh(doorGeo, doorMat);
              doorMesh.position.set(pt.x, 1.0, pt.z);
              doorMesh.rotation.y = -angle;
              mapGroup.add(doorMesh);
            }
          } catch (e) {
            console.error("Lỗi vẽ clinic door:", e);
          }
        });
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
            hoveredMesh.material.opacity = 0.12;
          }
          hoveredMesh = mesh;
          hoveredMesh.material.opacity = 0.35;
        }
      } else {
        if (hoveredMesh && hoveredMesh !== selectedMesh) {
          hoveredMesh.material.opacity = 0.12;
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
        selectedMesh.material.opacity = 0.12;
      }
      selectedMesh = mesh;
      selectedMesh.material.opacity = 0.45;
      
      detailTitle.textContent = mesh.userData.label;
      detailCode.textContent = 'Mã phòng: ' + mesh.userData.code;
      detailDesc.textContent = 'Phòng khám thuộc ' + mesh.userData.clinicLabel + '.';
      detailZone.textContent = mesh.userData.clinicLabel;
      const colorHex = '#' + mesh.userData.clinicColor.toString(16).padStart(6, '0');
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
        selectedMesh.material.opacity = 0.12;
        selectedMesh = null;
      }
      detailCard.style.display = 'none';
    }

    window.addEventListener('resize', onWindowResize);

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      updateLabels();
      renderer.render(scene, camera);
    }
    
    animate();
  </script>
</body>
</html>`;
}
