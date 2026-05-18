import type { Node, Edge } from '@xyflow/react';

// Column x positions
export const COLUMNS = [
  { id: 'device',   label: 'Device',          x: 80  },
  { id: 'gateway',  label: 'Gateway',          x: 310 },
  { id: 'api',      label: 'Cloud API',        x: 540 },
  { id: 'data',     label: 'Data / Storage',   x: 770 },
  { id: 'external', label: 'External Services',x: 1000 },
] as const;

// Base nodes
export const BASE_NODES: Node[] = [
  // Device column
  { id: 'sensor',    type: 'archNode', position: { x: 80,  y: 120 }, data: { label: 'Sensor Node',    column: 'device',   desc: 'Temperature, humidity, motion sensors' } },
  { id: 'camera',    type: 'archNode', position: { x: 80,  y: 230 }, data: { label: 'Camera Node',    column: 'device',   desc: 'RTSP/H264 stream source' } },
  { id: 'switch',    type: 'archNode', position: { x: 80,  y: 340 }, data: { label: 'Smart Switch',   column: 'device',   desc: 'Relay-controlled actuator' } },

  // Gateway column
  { id: 'mqtt',      type: 'archNode', position: { x: 310, y: 120 }, data: { label: 'MQTT Broker',    column: 'gateway',  desc: 'Eclipse Mosquitto, QoS 1/2' } },
  { id: 'edge',      type: 'archNode', position: { x: 310, y: 255 }, data: { label: 'Edge Controller',column: 'gateway',  desc: 'Local rule engine + OTA manager' } },

  // API column
  { id: 'rest',      type: 'archNode', position: { x: 540, y: 120 }, data: { label: 'REST API',       column: 'api',      desc: 'FastAPI, JWT-authenticated endpoints' } },
  { id: 'ws',        type: 'archNode', position: { x: 540, y: 230 }, data: { label: 'WebSocket Server',column: 'api',     desc: 'Real-time push to clients' } },
  { id: 'auth',      type: 'archNode', position: { x: 540, y: 340 }, data: { label: 'Auth Service',   column: 'api',      desc: 'OAuth2 / JWT issuer' } },

  // Data column
  { id: 'tsdb',      type: 'archNode', position: { x: 770, y: 120 }, data: { label: 'Time-series DB', column: 'data',     desc: 'InfluxDB - sensor telemetry' } },
  { id: 'userdb',    type: 'archNode', position: { x: 770, y: 230 }, data: { label: 'User DB',        column: 'data',     desc: 'PostgreSQL — accounts & config' } },
  { id: 'media',     type: 'archNode', position: { x: 770, y: 340 }, data: { label: 'Media Storage',  column: 'data',     desc: 'S3-compatible object storage' } },

  // External column
  { id: 'push',      type: 'archNode', position: { x: 1000, y: 120 }, data: { label: 'Push Notification',column: 'external', desc: 'FCM / APNs alert delivery' } },
  { id: 'dashboard', type: 'archNode', position: { x: 1000, y: 230 }, data: { label: 'Web Dashboard', column: 'external', desc: 'React SPA — live monitoring UI' } },
  { id: 'mobile',    type: 'archNode', position: { x: 1000, y: 340 }, data: { label: 'Mobile App',    column: 'external', desc: 'React Native iOS/Android' } },
];

// Base edges (all connections)
export const BASE_EDGES: Edge[] = [
  { id: 'e-sensor-mqtt',      source: 'sensor',    target: 'mqtt',      animated: false },
  { id: 'e-camera-edge',      source: 'camera',    target: 'edge',      animated: false },
  { id: 'e-switch-mqtt',      source: 'switch',    target: 'mqtt',      animated: false },
  { id: 'e-mqtt-rest',        source: 'mqtt',      target: 'rest',      animated: false },
  { id: 'e-mqtt-edge',        source: 'mqtt',      target: 'edge',      animated: false },
  { id: 'e-edge-rest',        source: 'edge',      target: 'rest',      animated: false },
  { id: 'e-edge-media',       source: 'edge',      target: 'media',     animated: false },
  { id: 'e-rest-tsdb',        source: 'rest',      target: 'tsdb',      animated: false },
  { id: 'e-rest-userdb',      source: 'rest',      target: 'userdb',    animated: false },
  { id: 'e-rest-ws',          source: 'rest',      target: 'ws',        animated: false },
  { id: 'e-rest-push',        source: 'rest',      target: 'push',      animated: false },
  { id: 'e-auth-userdb',      source: 'auth',      target: 'userdb',    animated: false },
  { id: 'e-ws-dashboard',     source: 'ws',        target: 'dashboard', animated: false },
  { id: 'e-ws-mobile',        source: 'ws',        target: 'mobile',    animated: false },
  { id: 'e-rest-dashboard',   source: 'rest',      target: 'dashboard', animated: false },
  { id: 'e-rest-mobile',      source: 'rest',      target: 'mobile',    animated: false },
  { id: 'e-mobile-auth',      source: 'mobile',    target: 'auth',      animated: false },
  { id: 'e-dashboard-auth',   source: 'dashboard', target: 'auth',      animated: false },
];

// Flow definitions
export interface FlowDef {
  id: string;
  label: string;
  description: string;
  steps: string[];       // node IDs in order
  edgeIds: string[];     // edge IDs in this flow
  color: string;
}

export const FLOWS: FlowDef[] = [
  {
    id: 'sensor-telemetry',
    label: 'Sensor -> telemetry storage',
    description: 'Sensor node publishes telemetry over MQTT. The broker forwards to the REST API which writes to InfluxDB. WebSocket server pushes live readings to the dashboard.',
    steps: ['sensor', 'mqtt', 'rest', 'tsdb'],
    edgeIds: ['e-sensor-mqtt', 'e-mqtt-rest', 'e-rest-tsdb'],
    color: '#38bdf8',
  },
  {
    id: 'camera-stream',
    label: 'Camera -> live view',
    description: 'Camera node sends H264 stream to the edge controller. Edge transcodes and stores clips in media storage. WebSocket server notifies mobile app.',
    steps: ['camera', 'edge', 'media'],
    edgeIds: ['e-camera-edge', 'e-edge-media'],
    color: '#a78bfa',
  },
  {
    id: 'remote-control',
    label: 'Remote control command',
    description: 'Mobile app sends a command via REST API. REST relays through MQTT broker to the smart switch actuator.',
    steps: ['mobile', 'rest', 'mqtt', 'switch'],
    edgeIds: ['e-rest-mobile', 'e-mqtt-rest', 'e-switch-mqtt'],
    color: '#34d399',
  },
  {
    id: 'user-auth',
    label: 'User authentication',
    description: 'Mobile or dashboard app calls Auth Service with credentials. Auth validates against User DB and issues a JWT token back to the client.',
    steps: ['mobile', 'auth', 'userdb'],
    edgeIds: ['e-mobile-auth', 'e-auth-userdb'],
    color: '#fb923c',
  },
  {
    id: 'alert-push',
    label: 'Sensor alert -> push notification',
    description: 'Sensor detects anomaly. MQTT forwards to REST API. REST evaluates rule, writes to InfluxDB and triggers FCM/APNs push to mobile.',
    steps: ['sensor', 'mqtt', 'rest', 'tsdb', 'push'],
    edgeIds: ['e-sensor-mqtt', 'e-mqtt-rest', 'e-rest-tsdb', 'e-rest-push'],
    color: '#f472b6',
  },
  {
    id: 'realtime-dashboard',
    label: 'Real-time dashboard update',
    description: 'Sensor readings flow from MQTT -> REST -> WebSocket server and are pushed to the web dashboard for live charting.',
    steps: ['sensor', 'mqtt', 'rest', 'ws', 'dashboard'],
    edgeIds: ['e-sensor-mqtt', 'e-mqtt-rest', 'e-rest-ws', 'e-ws-dashboard'],
    color: '#facc15',
  },
];
