import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import {
  RoundedBox,
  Html,
  OrbitControls,
  PerspectiveCamera,
  shaderMaterial,
  useCursor,
} from '@react-three/drei';
import * as THREE from 'three';

/* =========================
   JSON 拓撲配置
========================= */
const TOPOLOGY_CONFIG = {
  devices: [
    {
      id: 'dg',
      label: 'Diesel Gen',
      position: [-3, 0, -1],
      color: '#ff9500',
      dataPath: 'diesel.status.started',
      subLabelPath: 'diesel.status.frequency',
      subLabelFormat: (v) => `${v || 60} Hz`,
    },
    {
      id: 'ess',
      label: 'ETICA ESS',
      position: [-1, 0, 0.5],
      color: '#00ff88',
      dataPath: 'ess.current',
      onlineCheck: (data) => data?.ess?.current !== 0,
      subLabelPath: 'ess.soc',
      subLabelFormat: (v) => `${v || 0}% SOC`,
    },
    {
      id: 'pcs',
      label: 'GCM',
      position: [1, 0, 0.5],
      color: '#00d4ff',
      dataPath: 'ess.pcs.current',
      onlineCheck: (data) => data?.ess?.pcs?.current !== 0,
      subLabelPath: 'ess.pcs.frequency',
      subLabelFormat: (v) => `${v || 60} Hz`,
    },
    {
      id: 'pn14',
      label: 'PN14',
      position: [3, 0, -1],
      color: '#a855f7',
      dataPath: 'pn14.connected',
      subLabelPath: 'pn14.windSpeed',
      subLabelFormat: (v) => `${v || 0} m/s`,
    },
  ],
  connections: [
    { from: 'dg', to: 'ess', color: '#ff9500' },
    { from: 'ess', to: 'pcs', color: '#00ff88' },
    { from: 'pcs', to: 'pn14', color: '#00d4ff' },
  ],
  // 異常警報條件
  alarms: {
    dg: (data) => data?.diesel?.status?.started && data?.diesel?.status?.frequency < 59,
    ess: (data) => {
      const status = data?.ess?.status;
      return status && !['Charging', 'Discharging', 'Ready'].some(s => status.includes(s));
    },
    pcs: (data) => {
      const freq = data?.ess?.pcs?.frequency;
      return freq && (freq < 59.77 || freq > 60.23);
    },
    pn14: (data) => data?.pn14?.connected === false,
  },
};

// 從路徑取得嵌套資料
const getNestedValue = (obj, path) => {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

/* =========================
   能量流動 Shader
========================= */
const FlowMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#00d4ff'),
  },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
      float flow = sin((vUv.x * 10.0) - uTime * 4.0);
      float alpha = smoothstep(0.2, 1.0, flow);
      gl_FragColor = vec4(uColor, alpha);
    }
  `
);
extend({ FlowMaterial });

/* =========================
   發光管線
========================= */
const GlowingPipe = ({ start, end, active, color }) => {
  const materialRef = useRef();

  useFrame((_, delta) => {
    if (active && materialRef.current) {
      materialRef.current.uTime += delta;
    }
  });

  const curve = useMemo(() => {
    const midY = Math.max(start[1], end[1]) + 0.4;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3(start[0], midY, start[2]),
      new THREE.Vector3(end[0], midY, end[2]),
      new THREE.Vector3(...end),
    ]);
  }, [start, end]);

  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 80, 0.05, 8, false),
    [curve]
  );

  return (
    <mesh geometry={geometry}>
      <flowMaterial
        ref={materialRef}
        uColor={new THREE.Color(active ? color : '#333')}
        transparent
      />
    </mesh>
  );
};

/* =========================
   設備節點
========================= */
const DeviceNode = ({ position, label, subLabel, online, color, hasAlarm }) => {
  const ref = useRef();
  const haloRef = useRef();
  const alarmRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);

  useCursor(hovered);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      if (hovered) ref.current.rotation.y += 0.01;
    }
    if (online && haloRef.current) {
      haloRef.current.scale.setScalar(
        1 + Math.sin(state.clock.elapsedTime * 3) * 0.05
      );
    }
    // 異常警報閃爍動畫
    if (hasAlarm && alarmRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 8) * 0.5 + 0.5;
      alarmRef.current.material.opacity = pulse * 0.6;
      alarmRef.current.scale.setScalar(1 + pulse * 0.3);
    }
  });

  return (
    <group position={position}>
      {/* 底座 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.6, 0.7, 0.1, 32]} />
        <meshStandardMaterial color="#0a0a1a" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Halo */}
      {online && (
        <mesh
          ref={haloRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.14, 0]}
        >
          <ringGeometry args={[0.7, 0.95, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} />
        </mesh>
      )}

      {/* 異常警報光環 */}
      {hasAlarm && (
        <mesh
          ref={alarmRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.12, 0]}
        >
          <ringGeometry args={[0.8, 1.1, 64]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0.5} />
        </mesh>
      )}

      {/* 主機 */}
      <group ref={ref}>
        <RoundedBox
          args={[0.8, 0.6, 0.4]}
          radius={0.05}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={() => setOpen(!open)}
        >
          <meshStandardMaterial
            color={online ? '#1a1a2e' : '#333'}
            emissive={online ? color : '#000'}
            emissiveIntensity={0.4}
            metalness={0.6}
            roughness={0.3}
          />
        </RoundedBox>

        {/* 狀態燈 */}
        <mesh position={[0.3, 0.2, 0.22]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color={online ? '#00ff88' : '#ff4444'} />
        </mesh>
      </group>

      {/* 標籤 */}
      <Html position={[0, -0.55, 0]} center>
        <div
          style={{
            padding: '6px 12px',
            background: 'rgba(5,15,30,0.9)',
            border: `1px solid ${color}`,
            borderRadius: 8,
            color: '#fff',
            fontSize: 12,
            textAlign: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onClick={() => setOpen(!open)}
        >
          <b>{label}</b>
          <div style={{ color }}>{subLabel}</div>
        </div>
      </Html>

      {/* HUD */}
      {open && (
        <Html position={[0, 1.2, 0]} center zIndexRange={[100, 0]}>
          {/* 透明遮罩 - 點擊關閉 */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: -1,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              background: 'linear-gradient(180deg,#0a1a2f,#020617)',
              border: `1px solid ${color}`,
              boxShadow: `0 0 30px ${color}55`,
              padding: 12,
              borderRadius: 12,
              color: '#e0f7ff',
              fontFamily: 'monospace',
              minWidth: 160,
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <b>{label}</b>
            <div>Status: {online ? 'ONLINE' : 'OFFLINE'}</div>
            <div>{subLabel}</div>
          </div>
        </Html>
      )}
    </group>
  );
};

/* =========================
   主場景
========================= */
const Scene = ({ realTimeData }) => {
  // 從 JSON 配置計算設備狀態
  const deviceStates = useMemo(() => {
    const states = {};
    TOPOLOGY_CONFIG.devices.forEach((device) => {
      // 計算 online 狀態
      if (device.onlineCheck) {
        states[device.id] = { online: device.onlineCheck(realTimeData) };
      } else {
        const value = getNestedValue(realTimeData, device.dataPath);
        states[device.id] = { online: Boolean(value) };
      }
      // 計算 subLabel
      const subValue = getNestedValue(realTimeData, device.subLabelPath);
      states[device.id].subLabel = device.subLabelFormat
        ? device.subLabelFormat(subValue)
        : subValue;
      // 計算異常狀態
      const alarmCheck = TOPOLOGY_CONFIG.alarms[device.id];
      states[device.id].hasAlarm = alarmCheck ? alarmCheck(realTimeData) : false;
    });
    return states;
  }, [realTimeData]);

  // 建立位置映射
  const positions = useMemo(() => {
    const pos = {};
    TOPOLOGY_CONFIG.devices.forEach((d) => {
      pos[d.id] = d.position;
    });
    return pos;
  }, []);

  return (
    <>
      <color attach="background" args={['#050816']} />
      <fog attach="fog" args={['#050816', 8, 20]} />

      <PerspectiveCamera makeDefault position={[0, 6, -8]} />
      <OrbitControls maxPolarAngle={Math.PI / 2.2} />

      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, 10, -10]} intensity={0.6} color="#00d4ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0a0a15" metalness={0.9} roughness={0.15} />
      </mesh>

      <gridHelper args={[30, 40, '#00d4ff', '#003344']} />

      {/* AiSails Logo - 平躺在網格上 */}
      <Html
        position={[0, -0.28, 4]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        transform
        sprite={false}
      >
        <img
          src="/images/aisails-logo.png"
          alt="AiSails"
          style={{
            width: '300px',
            height: 'auto',
            opacity: 0.7,
            filter: 'drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.5))',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      </Html>

      {/* 從 JSON 配置渲染連線 */}
      {TOPOLOGY_CONFIG.connections.map((conn) => (
        <GlowingPipe
          key={`${conn.from}-${conn.to}`}
          start={positions[conn.from]}
          end={positions[conn.to]}
          active={deviceStates[conn.from]?.online && deviceStates[conn.to]?.online}
          color={conn.color}
        />
      ))}

      {/* 從 JSON 配置渲染設備節點 */}
      {TOPOLOGY_CONFIG.devices.map((device) => (
        <DeviceNode
          key={device.id}
          position={device.position}
          label={device.label}
          subLabel={deviceStates[device.id]?.subLabel}
          online={deviceStates[device.id]?.online}
          color={device.color}
          hasAlarm={deviceStates[device.id]?.hasAlarm}
        />
      ))}
    </>
  );
};

/* =========================
   Export
========================= */
export default function SystemTopology3D({ realTimeData }) {
  return (
    <div style={{ height: 420 }}>
      <Canvas>
        <Scene realTimeData={realTimeData} />
      </Canvas>
    </div>
  );
}
