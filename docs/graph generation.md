# Navigation Graph Generation Pipeline: Node & Edge Derivation from Floor Features

This document specifies the deterministic pipeline for transforming static 2D geometric representations (`floor_feature`) into a dynamic, queryable indoor navigation graph consisting of routing nodes (`nav_node`) and directional edges (`nav_edge`). 

---

## 1. System Architecture & Entity Mapping

The pipeline maintains a strict decoupling between the **Visualization Layer** (UI/Canvas 2D rendering) and the **Navigation Graph Layer** (Logic/Pathfinding).

### Entity Mappings
| Source Entity (`floor_feature`) | Target Entity (`nav_node`) | Target Entity (`nav_edge`) |
| :--- | :--- | :--- |
| `space` (Polygon) | `node_type = room` (Centroid) | `edge_type = walk` (Internal) |
| `door` (LineString/Point) | `node_type = door` (Midpoint) | `edge_type = door_pass` |
| `connector` (Point/Polygon) | `node_type = stair | elevator` | `edge_type = stair | elevator` |
| *Negative Space* (Corridor) | `node_type = corridor_point | junction` | `edge_type = walk` (Trunk) |

---

## 2. Step-by-Step Generation Algorithmic Pipeline

### Step 1: Discrete Node Extraction (`nav_node`)
Extract isolated topological vertices from physical boundary features.

1. **Space Centroid Resolution:**
   For every `space` where `is_walkable = true`:
   $$\text{Centroid } (X_c, Y_c) = \left( \frac{1}{6A} \sum_{i=0}^{n-1} (x_i + x_{i+1})(x_i y_{i+1} - x_{i+1} y_i), \frac{1}{6A} \sum_{i=0}^{n-1} (y_i + y_{i+1})(x_i y_{i+1} - x_{i+1} y_i) \right)$$
   * If the calculated centroid falls outside a non-convex polygon, fallback to the **Pole of Inaccessibility** algorithm.
   * Persist as `nav_node` with `node_type = room` and link via `feature_id`.

2. **Door Midpoint Resolution:**
   For every `door` object intersecting a `space_boundary`:
   * Compute the geometric midpoint $(X_m, Y_m)$ of the door's bounding threshold.
   * Persist as `nav_node` with `node_type = door`.

3. **Vertical Connector Synchronization:**
   For every multi-level `connector` (Stairs, Elevators):
   * Generate anchoring nodes at local coordinate indices $(x, y, z)$.
   * Assign `node_type = stair_entry`, `stair_exit`, or `elevator_point`.

---

### Step 2: Negative Space Corridor Processing
Corridors lack explicit polygon boundaries and must be calculated as topological "negative spaces".

#### Approach A: Medial Axis Transform / Voronoi Diagram (Automated Pipeline)
1. **Walkable Area Extraction:**
   Perform a 2D constructive solid geometry (CSG) Boolean difference operation:
   $$\text{Walkable\_Zone} = \text{Floor\_Bounding\_Box} \setminus \bigcup (\text{All\_Static\_Space\_Polygons})$$
2. **Skeletonization:**
   Apply a **Voronoi Diagram** generation algorithm over the vertices of $\text{Walkable\_Zone}$. Filter out peripheral branches, retaining only edges that maintain maximum equidistant clearance from opposing `space_boundary` structures (the Centerline).
3. **Graph Sampling:**
   * **Intersections:** Generate `nav_node` (`node_type = junction`) at all coordinate nodes where 3 or more Voronoi edges intersect.
   * **Linear Sampling:** Along linear centerline vectors, sample points at fixed intervals $\Delta d$ (e.g., every 3.0 meters) to generate `nav_node` (`node_type = corridor_point`).

#### Approach B: Manual Node Interception (Fallback CMS Pipeline)
* Capture raw coordinate pairs $(x, y)$ emitted by mouse pointer drop-events on the administration Canvas.
* Commit sequential arrays directly as `node_type = corridor_point`.

---

### Step 3: Edge Topology Interconnection (`nav_edge`)
Weave structural relationships between instantiated nodes.

1. **Intra-Space Linkage (Room $\rightarrow$ Door):**
   * Query relational fields `space_a_id` and `space_b_id` bound to a `door` record.
   * Construct `nav_edge` connecting $\text{Centroid}(\text{Space}_A) \rightarrow \text{Midpoint}(\text{Door})$ with `edge_type = walk`.

2. **Cross-Threshold Linkage (Door $\rightarrow$ Room / Corridor):**
   * If a door opens to another defined room, connect $\text{Midpoint}(\text{Door}) \rightarrow \text{Centroid}(\text{Space}_B)$ via `edge_type = door_pass`.

3. **Corridor Connectivity Integration (Raycasting):**
   * For each `node_type = door` bordering a corridor negative space, project a normal vector (raycast) into the corridor polygon.
   * Intercept the closest corridor center-line vector or the nearest `corridor_point`.
   * Synthesize an anchor `nav_edge` bridging the `door` node to the corridor graph trunk.

4. **Vertical Graph Stitching (Inter-Floor):**
   * Query the global `connector` registry group IDs.
   * Connect `elevator_point` at $\text{Floor}_n$ to `elevator_point` at $\text{Floor}_{n+1}$ using vertical edges tagged as `edge_type = elevator`.

---

### Step 4: Cost Function Calculation & Weight Optimization
Every edge must receive static computational costs prior to cache ingestion for $A^*$ pathfinding execution.

1. **Euclidean Distance Extraction:**
   Calculate pixel-space Euclidean distance between Node Start ($N_s$) and Node End ($N_e$):
   $$Distance_{\text{pixel}} = \sqrt{(x_e - x_s)^2 + (y_e - y_s)^2}$$

2. **Metric Standardization:**
   Convert pixel spatial measurements to real-world SI units using the localized floor matrix configuration value ($scaleFactor$):
   $$Distance_{\text{real}} = Distance_{\text{pixel}} \times scaleFactor$$

3. **Heuristic Penalty Allocation:**
   Define final travel cost value factoring structural modifiers ($\omega$):
   $$\text{Cost} = Distance_{\text{real}} + \omega_{\text{modifier}}$$
   * For standard flat surfaces (`edge_type = walk`): $\omega_{\text{modifier}} = 0$
   * For vertical stairs (`edge_type = stair`): $\omega_{\text{modifier}} = \text{Penalty}_{\text{stair}}$ (accounts for physical exhaustion metrics).
   * For elevators (`edge_type = elevator`): $\omega_{\text{modifier}} = \text{Penalty}_{\text{wait\_time}}$ (accounts for average mechanical delay).

4. **Database Storage Schema Mapping:**
   Write computed attributes directly into `distance` and `cost` columns in the `nav_edge` database instance.

---

## 3. Runtime Compilation
Upon lifecycle completion or an administrative `SAVE` hook payload trigger:
1. The NestJS backend reads the updated `nav_node` and `nav_edge` relational datasets.
2. The dataset compiles directly into an **In-Memory Adjacency List** residing on RAM.
3. The live graph state is immediately exposed to the execution engine for microsecond-latency $A^*$ queries.