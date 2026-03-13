import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

// ─── Sky ─────────────────────────────────────────────────────────────────────
function SimpleSky() {
  return (
    <mesh scale={[800, 800, 800]}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshBasicMaterial color="#1a3a5c" side={THREE.BackSide} />
    </mesh>
  )
}

// ─── Stars ───────────────────────────────────────────────────────────────────
function StarField({ count = 2000 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 600 + Math.random() * 100
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])
  return (
    <points geometry={geo}>
      <pointsMaterial color="#d4c8a0" size={0.8} sizeAttenuation />
    </points>
  )
}

// ─── Orbit Controls ───────────────────────────────────────────────────────────
function OrbitController({ enabled }) {
  const { camera, gl } = useThree()
  const s = useRef({
    dragging: false, lastX: 0, lastY: 0,
    theta: 0.4, phi: 1.0, radius: 90,
    target: new THREE.Vector3(0, 8, 0),
  })

  useEffect(() => {
    if (!enabled) return
    const el = gl.domElement
    const onDown = e => { s.current.dragging = true; s.current.lastX = e.clientX; s.current.lastY = e.clientY }
    const onUp   = () => { s.current.dragging = false }
    const onMove = e => {
      if (!s.current.dragging) return
      s.current.theta -= (e.clientX - s.current.lastX) * 0.005
      s.current.phi = Math.max(0.12, Math.min(Math.PI / 2.05, s.current.phi + (e.clientY - s.current.lastY) * 0.005))
      s.current.lastX = e.clientX; s.current.lastY = e.clientY
    }
    const onWheel = e => {
      s.current.radius = Math.max(20, Math.min(400, s.current.radius + e.deltaY * 0.1))
    }
    el.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
      el.removeEventListener('wheel', onWheel)
    }
  }, [enabled, gl])

  useFrame(() => {
    if (!enabled) return
    const { theta, phi, radius, target } = s.current
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    )
    camera.lookAt(target)
  })
  return null
}

// ─── Aeroplane mesh ───────────────────────────────────────────────────────────
// All parts sized so the plane is ~5 units long vs 300-unit terrain = realistic scale
function Aeroplane({ planeRef }) {
  const metalMat   = <meshLambertMaterial color="#d0d8e0" />
  const darkMat    = <meshLambertMaterial color="#2a2a3a" />
  const glassMat   = <meshLambertMaterial color="#88aacc" transparent opacity={0.7} />
  const engineMat  = <meshLambertMaterial color="#888898" />
  const accentMat  = <meshLambertMaterial color="#c8902a" />

  return (
    <group ref={planeRef}>
      {/* Fuselage — tapered cylinder */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.18, 5.0, 12]} />
        {metalMat}
      </mesh>

      {/* Nose cone */}
      <mesh position={[0, 0, -2.7]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 0.8, 12]} />
        {metalMat}
      </mesh>

      {/* Cockpit glass bubble */}
      <mesh position={[0, 0.22, -1.0]}>
        <sphereGeometry args={[0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        {glassMat}
      </mesh>

      {/* Main wings — swept back */}
      {/* Left wing */}
      <mesh position={[-1.8, -0.02, 0.3]} rotation={[0, 0.18, -0.06]}>
        <boxGeometry args={[3.2, 0.08, 1.1]} />
        {metalMat}
      </mesh>
      {/* Right wing */}
      <mesh position={[1.8, -0.02, 0.3]} rotation={[0, -0.18, 0.06]}>
        <boxGeometry args={[3.2, 0.08, 1.1]} />
        {metalMat}
      </mesh>

      {/* Wing tip accents */}
      <mesh position={[-3.3, 0.0, 0.3]}>
        <boxGeometry args={[0.08, 0.3, 0.5]} />
        {accentMat}
      </mesh>
      <mesh position={[3.3, 0.0, 0.3]}>
        <boxGeometry args={[0.08, 0.3, 0.5]} />
        {accentMat}
      </mesh>

      {/* Horizontal stabilizers */}
      <mesh position={[-0.9, 0.0, 2.1]} rotation={[0, 0.1, 0]}>
        <boxGeometry args={[1.6, 0.06, 0.55]} />
        {metalMat}
      </mesh>
      <mesh position={[0.9, 0.0, 2.1]} rotation={[0, -0.1, 0]}>
        <boxGeometry args={[1.6, 0.06, 0.55]} />
        {metalMat}
      </mesh>

      {/* Vertical tail fin */}
      <mesh position={[0, 0.45, 2.0]}>
        <boxGeometry args={[0.07, 0.85, 0.7]} />
        {metalMat}
      </mesh>

      {/* Engine nacelles under wings */}
      <mesh position={[-1.3, -0.18, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.12, 0.9, 10]} />
        {engineMat}
      </mesh>
      <mesh position={[1.3, -0.18, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.12, 0.9, 10]} />
        {engineMat}
      </mesh>

      {/* Engine intake rings */}
      <mesh position={[-1.3, -0.18, -0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.025, 8, 16]} />
        {darkMat}
      </mesh>
      <mesh position={[1.3, -0.18, -0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.025, 8, 16]} />
        {darkMat}
      </mesh>

      {/* Afterburner glow */}
      <mesh position={[-1.3, -0.18, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.35, 8]} />
        <meshBasicMaterial color="#ff6020" transparent opacity={0.7} />
      </mesh>
      <mesh position={[1.3, -0.18, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.35, 8]} />
        <meshBasicMaterial color="#ff6020" transparent opacity={0.7} />
      </mesh>

      {/* Gold stripe */}
      <mesh position={[0, 0.05, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.285, 0.285, 0.08, 12]} />
        {accentMat}
      </mesh>
    </group>
  )
}

// ─── Wind sound ───────────────────────────────────────────────────────────────
function useWindSound(flyMode) {
  const audioCtx = useRef(null)
  const noiseNode = useRef(null)
  const gainNode = useRef(null)
  const filterNode = useRef(null)

  useEffect(() => {
    if (flyMode) {
      try {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
        const bufSize = audioCtx.current.sampleRate * 2
        const buf = audioCtx.current.createBuffer(1, bufSize, audioCtx.current.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

        noiseNode.current = audioCtx.current.createBufferSource()
        noiseNode.current.buffer = buf
        noiseNode.current.loop = true

        filterNode.current = audioCtx.current.createBiquadFilter()
        filterNode.current.type = 'bandpass'
        filterNode.current.frequency.value = 400
        filterNode.current.Q.value = 0.8

        gainNode.current = audioCtx.current.createGain()
        gainNode.current.gain.value = 0.0

        noiseNode.current.connect(filterNode.current)
        filterNode.current.connect(gainNode.current)
        gainNode.current.connect(audioCtx.current.destination)
        noiseNode.current.start()

        // Fade in
        gainNode.current.gain.linearRampToValueAtTime(0.18, audioCtx.current.currentTime + 1.5)
      } catch (e) {}
    } else {
      if (gainNode.current && audioCtx.current) {
        gainNode.current.gain.linearRampToValueAtTime(0, audioCtx.current.currentTime + 0.8)
        setTimeout(() => {
          try { noiseNode.current?.stop(); audioCtx.current?.close() } catch(e) {}
          audioCtx.current = null
        }, 900)
      }
    }
    return () => {
      try { noiseNode.current?.stop(); audioCtx.current?.close() } catch(e) {}
    }
  }, [flyMode])
}

// ─── Fly Controller with full aircraft controls ───────────────────────────────
function FlyController({ flyMode, planeRef }) {
  const { camera } = useThree()
  const keys = useRef({})
  const { setCameraPosition } = useStore()
  useWindSound(flyMode)

  // Flight state
  const flight = useRef({
    yaw:   0,          // rotation around Y (left/right heading)
    pitch: 0,          // nose up/down
    roll:  0,          // bank angle
    speed: 22,         // units/sec
    targetRoll: 0,
    targetPitch: -0.06,
  })

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

  // Spawn plane ahead of camera when fly mode starts
  useEffect(() => {
    if (flyMode && planeRef.current) {
      planeRef.current.position.set(0, 25, -30)
      flight.current.yaw = 0
      flight.current.pitch = -0.06
      flight.current.roll = 0
    }
  }, [flyMode])

  useFrame((_, delta) => {
    if (!flyMode || !planeRef.current) return

    const f = flight.current
    const turnRate  = 1.2   // rad/sec for yaw
    const pitchRate = 0.9
    const rollRate  = 3.0
    const maxPitch  = 0.55
    const maxRoll   = 0.72

    // ── Input → target roll & pitch ──────────────────────────────────────
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
      f.yaw += turnRate * delta
      f.targetRoll = maxRoll   // bank left
    } else if (keys.current['KeyD'] || keys.current['ArrowRight']) {
      f.yaw -= turnRate * delta
      f.targetRoll = -maxRoll  // bank right
    } else {
      f.targetRoll = 0
    }

    if (keys.current['KeyW'] || keys.current['ArrowUp']) {
      f.targetPitch = -maxPitch  // nose up
    } else if (keys.current['KeyS'] || keys.current['ArrowDown']) {
      f.targetPitch = maxPitch   // nose down
    } else {
      f.targetPitch = -0.06      // gentle level
    }

    // Speed control
    if (keys.current['KeyE']) f.speed = Math.min(f.speed + 12 * delta, 60)
    if (keys.current['KeyQ']) f.speed = Math.max(f.speed - 8 * delta, 8)

    // ── Smooth roll & pitch ───────────────────────────────────────────────
    f.roll  += (f.targetRoll  - f.roll)  * rollRate  * delta
    f.pitch += (f.targetPitch - f.pitch) * pitchRate * delta

    // ── Build quaternion from yaw/pitch/roll ──────────────────────────────
    const qYaw   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), f.yaw)
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), f.pitch)
    const qRoll  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), f.roll)
    const q = qYaw.clone().multiply(qPitch).multiply(qRoll)

    planeRef.current.quaternion.copy(q)

    // ── Move forward in heading direction ─────────────────────────────────
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(qYaw.clone().multiply(qPitch))
    planeRef.current.position.addScaledVector(forward, f.speed * delta)

    // Floor clamp
    planeRef.current.position.y = Math.max(planeRef.current.position.y, 3)

    // ── Camera follows behind & above plane ───────────────────────────────
    const behind = new THREE.Vector3(0, 0, 1).applyQuaternion(qYaw)
    const camTarget = planeRef.current.position.clone()
      .addScaledVector(behind, 14)
      .add(new THREE.Vector3(0, 5, 0))

    camera.position.lerp(camTarget, 6 * delta)
    camera.lookAt(planeRef.current.position.clone().add(new THREE.Vector3(0, 1, 0)))

    setCameraPosition({
      x: parseFloat(planeRef.current.position.x.toFixed(1)),
      y: parseFloat(planeRef.current.position.y.toFixed(1)),
      z: parseFloat(planeRef.current.position.z.toFixed(1)),
    })
  })

  return null
}

// ─── Terrain Mesh (300×300, expanded) ────────────────────────────────────────
function TerrainMesh({ terrainData }) {
  const meshRef = useRef()
  const { grid, width, height, min_elev, max_elev } = terrainData

  const geometry = useMemo(() => {
    const SIZE = 300  // expanded from 200
    const VSCALE = 38 // taller peaks
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, width - 1, height - 1)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colArray = new Float32Array(pos.count * 3)
    const range = max_elev - min_elev || 1

    for (let i = 0; i < pos.count; i++) {
      const elev = grid[i] ?? min_elev
      const n = (elev - min_elev) / range
      pos.setY(i, n * VSCALE)

      let r, g, b
      if      (n < 0.05) { r=0.15; g=0.32; b=0.20 }
      else if (n < 0.20) { r=0.25; g=0.45; b=0.20 }
      else if (n < 0.40) { r=0.50; g=0.52; b=0.23 }
      else if (n < 0.60) { r=0.60; g=0.50; b=0.30 }
      else if (n < 0.80) { r=0.52; g=0.40; b=0.26 }
      else               { r=0.92; g=0.92; b=0.96 }

      colArray[i*3]=r; colArray[i*3+1]=g; colArray[i*3+2]=b
    }

    pos.needsUpdate = true
    geo.setAttribute('color', new THREE.BufferAttribute(colArray, 3))
    geo.computeVertexNormals()
    return geo
  }, [terrainData])

  const baseGeometry = useMemo(() => {
    const SIZE = 300
    const FLOOR = -8
    const surfacePos = geometry.attributes.position

    const bottomVerts = new Float32Array([
      -SIZE/2, FLOOR, -SIZE/2,
       SIZE/2, FLOOR, -SIZE/2,
       SIZE/2, FLOOR,  SIZE/2,
      -SIZE/2, FLOOR,  SIZE/2,
    ])
    const bottomIdx = new Uint32Array([0,1,2, 0,2,3])
    const bottomGeo = new THREE.BufferGeometry()
    bottomGeo.setAttribute('position', new THREE.BufferAttribute(bottomVerts, 3))
    bottomGeo.setIndex(new THREE.BufferAttribute(bottomIdx, 1))
    bottomGeo.computeVertexNormals()

    const sideVerts = []
    const sideIdx = []
    const addWall = (edge) => {
      const base = sideVerts.length / 3
      for (let i = 0; i < edge.length; i++) {
        sideVerts.push(edge[i].x, edge[i].y, edge[i].z)
        sideVerts.push(edge[i].x, FLOOR, edge[i].z)
      }
      for (let i = 0; i < edge.length - 1; i++) {
        const t0=base+i*2, b0=base+i*2+1, t1=base+(i+1)*2, b1=base+(i+1)*2+1
        sideIdx.push(t0,b0,t1); sideIdx.push(b0,b1,t1)
      }
    }
    const getVert = (col, row) => {
      const idx = row * width + col
      return { x: surfacePos.getX(idx), y: surfacePos.getY(idx), z: surfacePos.getZ(idx) }
    }

    const north=[]; for(let c=0;c<width;c++) north.push(getVert(c,0)); addWall(north)
    const south=[]; for(let c=width-1;c>=0;c--) south.push(getVert(c,height-1)); addWall(south)
    const west=[];  for(let r=height-1;r>=0;r--) west.push(getVert(0,r)); addWall(west)
    const east=[];  for(let r=0;r<height;r++) east.push(getVert(width-1,r)); addWall(east)

    const sideGeo = new THREE.BufferGeometry()
    sideGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sideVerts), 3))
    sideGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(sideIdx), 1))
    sideGeo.computeVertexNormals()
    return { bottomGeo, sideGeo }
  }, [geometry, terrainData])

  return (
    <group ref={meshRef}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshLambertMaterial vertexColors side={THREE.FrontSide} />
      </mesh>
      <mesh geometry={baseGeometry.bottomGeo}>
        <meshLambertMaterial color="#2e2318" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={baseGeometry.sideGeo} castShadow>
        <meshLambertMaterial color="#2e2318" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function TerrainViewer({ terrainData, flyMode }) {
  const planeRef = useRef()

  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 40, 70], fov: 72, near: 0.1, far: 3000 }}
      shadows
      gl={{ antialias: true }}
    >
      <SimpleSky />
      <StarField />
      <ambientLight intensity={0.45} color="#d4c8a0" />
      <directionalLight position={[100, 80, 50]} intensity={1.5} color="#ffe8b0" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5} shadow-camera-far={500}
        shadow-camera-left={-200} shadow-camera-right={200}
        shadow-camera-top={200} shadow-camera-bottom={-200}
      />
      <directionalLight position={[-60, 30, -60]} intensity={0.35} color="#8090b0" />
      <TerrainMesh terrainData={terrainData} />
      {flyMode && <Aeroplane planeRef={planeRef} />}
      <FlyController flyMode={flyMode} planeRef={planeRef} />
      <OrbitController enabled={!flyMode} />
    </Canvas>
  )
}