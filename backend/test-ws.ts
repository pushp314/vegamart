import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8081/api/v1/vendors/stream-roaming');

ws.on('open', () => {
  console.log('Connected to stream-roaming');
  ws.close();
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err);
});

ws.on('close', (code, reason) => {
  console.log('WebSocket closed:', code, reason.toString());
});
