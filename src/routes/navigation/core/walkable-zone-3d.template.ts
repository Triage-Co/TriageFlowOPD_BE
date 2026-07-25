/**
 * Client-side script template for 3D Walkable Zone calculation and rendering in Three.js.
 * This module generates the 2D polygon subtraction (Floor outline minus Rooms & enclosed non-door areas)
 * and controls the visual toggle state.
 */
export function getWalkableZoneScript(): string {
  return `
    // --- Walkable Zone Calculation & Render Helpers ---
    let walkableMesh = null;
    let isWalkableZoneActive = false;

    function buildWalkableZoneMesh(activeFloor) {
      if (!activeFloor || !activeFloor.outlineGeom || !activeFloor.outlineGeom.coordinates) {
        return null;
      }

      try {
        // 1. Create Outer Floor Polygon Shape
        const polyCoords = activeFloor.outlineGeom.coordinates[0];
        const shape = new THREE.Shape();
        polyCoords.forEach((coord, index) => {
          const pt = convertCoords(coord[0], coord[1]);
          if (index === 0) shape.moveTo(pt.x, pt.z);
          else shape.lineTo(pt.x, pt.z);
        });

        // 2. Subtract all Rooms (Outlines as Holes)
        if (activeFloor.rooms && activeFloor.rooms.length > 0) {
          activeFloor.rooms.forEach(room => {
            if (room.outlineGeom && room.outlineGeom.coordinates && room.outlineGeom.coordinates[0]) {
              const rCoords = room.outlineGeom.coordinates[0];
              if (rCoords.length < 3) return;

              const holePath = new THREE.Path();
              rCoords.forEach((coord, idx) => {
                const pt = convertCoords(coord[0], coord[1]);
                if (idx === 0) holePath.moveTo(pt.x, pt.z);
                else holePath.lineTo(pt.x, pt.z);
              });
              shape.holes.push(holePath);
            }
          });
        }

        // 3. Subtract enclosed non-door Areas (e.g. Garden or blocked regions without doors)
        if (activeFloor.areas && activeFloor.areas.length > 0) {
          activeFloor.areas.forEach(area => {
            // Check if area has no doors in boundaries
            const hasDoors = area.boundaries && area.boundaries.some(b => b.boundaryType === 'DOOR');
            if (!hasDoors && area.outlineGeom && area.outlineGeom.coordinates && area.outlineGeom.coordinates[0]) {
              const aCoords = area.outlineGeom.coordinates[0];
              if (aCoords.length >= 3) {
                const holePath = new THREE.Path();
                aCoords.forEach((coord, idx) => {
                  const pt = convertCoords(coord[0], coord[1]);
                  if (idx === 0) holePath.moveTo(pt.x, pt.z);
                  else holePath.lineTo(pt.x, pt.z);
                });
                shape.holes.push(holePath);
              }
            }
          });
        }

        // 4. Create 3D Extruded Geometry for Walkable Overlay
        const extrudeSettings = { depth: 0.05, bevelEnabled: false };
        const walkableGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const walkableMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,        // Vibrant Emerald Green (#10b981)
          emissive: 0x059669,     // Deep emerald glow
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.65,
          roughness: 0.3,
          metalness: 0.1,
          side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(walkableGeo, walkableMat);
        mesh.rotation.x = Math.PI / 2;
        mesh.scale.set(1, 1, -1);
        mesh.position.y = 0.04; // Positioned slightly above floor slab to avoid Z-fighting
        mesh.receiveShadow = true;
        mesh.visible = false;   // Hidden by default

        return mesh;
      } catch (err) {
        console.error("Lỗi tạo Walkable Zone mesh:", err);
        return null;
      }
    }

    function initWalkableZoneUI() {
      const btnToggleWalkable = document.getElementById('btn-toggle-walkable');
      if (!btnToggleWalkable) return;

      btnToggleWalkable.addEventListener('click', () => {
        isWalkableZoneActive = !isWalkableZoneActive;
        if (walkableMesh) {
          walkableMesh.visible = isWalkableZoneActive;
        }

        if (isWalkableZoneActive) {
          btnToggleWalkable.classList.add('active');
          btnToggleWalkable.style.background = '#10b981';
          btnToggleWalkable.style.color = '#ffffff';
          btnToggleWalkable.style.borderColor = '#059669';
          btnToggleWalkable.textContent = '🚶 Walkable Zone: Bật';
        } else {
          btnToggleWalkable.classList.remove('active');
          btnToggleWalkable.style.background = '';
          btnToggleWalkable.style.color = '';
          btnToggleWalkable.style.borderColor = '';
          btnToggleWalkable.textContent = '🚶 Walkable Zone';
        }
      });
    }
  `;
}
