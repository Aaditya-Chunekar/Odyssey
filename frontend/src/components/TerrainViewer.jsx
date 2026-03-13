import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'

// ─── Terrain mesh ──────────────────────────────────────────────────────────────
function TerrainMesh({ terrainData }) {
  const meshRef = useRef()
  const { grid, width, height, min_elev, max_elev } = terrainData

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 200, width - 1, height - 1)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colArray = new Float32Array(pos.count * 3)
    const range = max_elev - min_elev || 1

    for (let i = 0; i < pos.count; i++) {
      const elev = grid[i] ?? min_elev
      const n = (elev - min_elev) / range
      pos.setY(i, n * 28)

      let r, g, b
      if      (n < 0.05) { r=0.18; g=0.35; b=0.22 }
      else if (n < 0.20) { r=0.28; g=0.48; b=0.22 }
      else if (n < 0.40) { r=0.52; g=0.55; b=0.25 }
      else if (n < 0.60) { r=0.62; g=0.52; b=0.32 }
      else if (n < 0.80) { r=0.55; g=0.42; b=0.28 }
      else               { r=0.90; g=0.90; b=0.95 }

      colArray[i*3]=r; colArray[i*3+1]=g; colArray[i*3+2]=b
    }

    pos.needsUpdate = true
    geo.setAttribute('color', new THREE.BufferAttribute(colArray, 3))
    geo.computeVertexNormals()
    return geo
  }, [terrainData])

  // ── Solid base using ExtrudeGeometry from the terrain outline ────────────
  const baseGeometry = useMemo(() => {
    const range = max_elev - min_elev || 1
    const W = 200, H = 200
    const FLOOR = -6  // how deep the solid base goes below lowest point

    // We build a solid block using a BufferGeometry with:
    // 1. The terrain surface (top face) — copied from geo above
    // 2. A flat bottom face at y = FLOOR
    // 3. Side walls connecting the edges

    const surfacePos = geometry.attributes.position
    const surfaceCol = geometry.attributes.color
    const vCount = surfacePos.count

    // ── Bottom face (flat quad at FLOOR) ──
    const bottomVerts = new Float32Array([
      -W/2, FLOOR, -H/2,
       W/2, FLOOR, -H/2,
       W/2, FLOOR,  H/2,
      -W/2, FLOOR,  H/2,
    ])
    const bottomIdx = new Uint32Array([0,1,2, 0,2,3])
    const bottomGeo = new THREE.BufferGeometry()
    bottomGeo.setAttribute('position', new THREE.BufferAttribute(bottomVerts, 3))
    bottomGeo.setIndex(new THREE.BufferAttribute(bottomIdx, 1))
    bottomGeo.computeVertexNormals()

    // ── Side walls ──
    // We sample the 4 edges of the terrain and drop them to FLOOR
    const sideVerts = []
    const sideIdx = []

    const addWall = (edge) => {
      // edge: array of {x, y, z} surface points along one border
      const base = sideVerts.length / 3
      for (let i = 0; i < edge.length; i++) {
        const { x, y, z } = edge[i]
        sideVerts.push(x, y, z)          // top (surface height)
        sideVerts.push(x, FLOOR, z)      // bottom
      }
      for (let i = 0; i < edge.length - 1; i++) {
        const t0 = base + i * 2
        const b0 = base + i * 2 + 1
        const t1 = base + (i + 1) * 2
        const b1 = base + (i + 1) * 2 + 1
        sideIdx.push(t0, b0, t1)
        sideIdx.push(b0, b1, t1)
      }
    }

    // Extract 4 border edges from the terrain surface positions
    // PlaneGeometry vertices are row-major: row 0 = north edge (z = -H/2), row (height-1) = south
    const W_segs = width - 1
    const H_segs = height - 1

    const getVert = (col, row) => {
      const idx = row * width + col
      return {
        x: surfacePos.getX(idx),
        y: surfacePos.getY(idx),
        z: surfacePos.getZ(idx),
      }
    }

    // North edge (row 0)
    const north = []
    for (let c = 0; c < width; c++) north.push(getVert(c, 0))
    addWall(north)

    // South edge (row height-1)
    const south = []
    for (let c = width - 1; c >= 0; c--) south.push(getVert(c, height - 1))
    addWall(south)

    // West edge (col 0, top to bottom)
    const west = []
    for (let r = height - 1; r >= 0; r--) west.push(getVert(0, r))
    addWall(west)

    // East edge (col width-1, bottom to top)
    const east = []
    for (let r = 0; r < height; r++) east.push(getVert(width - 1, r))
    addWall(east)

    const sideGeo = new THREE.BufferGeometry()
    sideGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sideVerts), 3))
    sideGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(sideIdx), 1))
    sideGeo.computeVertexNormals()

    return { bottomGeo, sideGeo }
  }, [geometry, terrainData])

  const baseMat = (
    <meshLambertMaterial color="#3a2e1a" side={THREE.DoubleSide} />
  )

  return (
    <group ref={meshRef}>
      {/* Terrain surface */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshLambertMaterial vertexColors side={THREE.FrontSide} />
      </mesh>
      {/* Solid bottom cap */}
      <mesh geometry={baseGeometry.bottomGeo}>
        {baseMat}
      </mesh>
      {/* Side walls */}
      <mesh geometry={baseGeometry.sideGeo} castShadow>
        {baseMat}
      </mesh>
    </group>
  )
}

// ─── Fly camera controller ────────────────────────────────────────────────────
function FlyController({ flyMode }) {
  const { camera } = useThree()
  const keys = useRef({})
  const { setCameraPosition } = useStore()

  useEffect(() => {
    const down = e => { keys.current[e.code] = true }
    const up   = e => { keys.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useFrame((_, delta) => {
    if (!flyMode) return
    const speed = 30
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize()

    if (keys.current['KeyW'] || keys.current['ArrowUp'])    camera.position.addScaledVector(dir, speed * delta)
    if (keys.current['KeyS'] || keys.current['ArrowDown'])  camera.position.addScaledVector(dir, -speed * delta)
    if (keys.current['KeyA'] || keys.current['ArrowLeft'])  camera.position.addScaledVector(right, -speed * delta)
    if (keys.current['KeyD'] || keys.current['ArrowRight']) camera.position.addScaledVector(right, speed * delta)
    if (keys.current['KeyQ']) camera.position.y -= speed * delta
    if (keys.current['KeyE']) camera.position.y += speed * delta

    // Clamp above terrain roughly
    camera.position.y = Math.max(camera.position.y, 3)

    setCameraPosition({
      x: parseFloat(camera.position.x.toFixed(2)),
      y: parseFloat(camera.position.y.toFixed(2)),
      z: parseFloat(camera.position.z.toFixed(2)),
    })
  })

  return null
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ terrainData, flyMode }) {
  return (
    <>
      <Sky
        sunPosition={[100, 50, 100]}
        turbidity={6}
        rayleigh={2}
        mieCoefficient={0.003}
        mieDirectionalG={0.8}
        inclination={0.5}
        azimuth={0.25}
      />
      <Stars radius={300} depth={60} count={2000} factor={4} saturation={0} fade />
      <ambientLight intensity={0.4} color="#d4c8a0" />
      <directionalLight
        position={[80, 60, 40]}
        intensity={1.4}
        color="#ffe8b0"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-50, 20, -50]} intensity={0.3} color="#8090b0" />
      <TerrainMesh terrainData={terrainData} />
      <FlyController flyMode={flyMode} />
    </>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TerrainViewer({ terrainData, flyMode }) {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 30, 55], fov: 75, near: 0.5, far: 2000 }}
      shadows
      gl={{ antialias: true }}
    >
      <Scene terrainData={terrainData} flyMode={flyMode} />
      {!flyMode && (
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={10}
          maxDistance={300}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 5, 0]}
        />
      )}
    </Canvas>
  )
}
