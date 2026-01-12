const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Relay Server Running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const clients = new Set();
const unityClients = new Set();
const webClients = new Set();

wss.on('connection', (ws, req) => {
  console.log('New connection from:', req.socket.remoteAddress);
  
  // Default to web client
  let clientType = 'web';
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Identify client type
      if (data.type === 'identify') {
        clientType = data.client;
        
        if (clientType === 'unity') {
          unityClients.add(ws);
          console.log('Unity client connected. Total Unity clients:', unityClients.size);
          
          // Notify web clients that Unity is connected
          broadcastToWeb({ type: 'unity_status', connected: true });
        } else {
          webClients.add(ws);
          console.log('Web client connected. Total web clients:', webClients.size);
          
          // Notify web client if Unity is connected
          if (unityClients.size > 0) {
            ws.send(JSON.stringify({ type: 'unity_status', connected: true }));
          }
        }
        
        clients.add(ws);
        return;
      }
      
      // Forward transcription data
      if (data.text) {
        console.log(`Transcription [${data.isFinal ? 'FINAL' : 'INTERIM'}]:`, data.text);
        
        // Send to all Unity clients
        broadcastToUnity(data);
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    
    if (unityClients.has(ws)) {
      unityClients.delete(ws);
      console.log('Unity client disconnected. Total Unity clients:', unityClients.size);
      
      // Notify web clients if no Unity clients left
      if (unityClients.size === 0) {
        broadcastToWeb({ type: 'unity_status', connected: false });
      }
    }
    
    if (webClients.has(ws)) {
      webClients.delete(ws);
      console.log('Web client disconnected. Total web clients:', webClients.size);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function broadcastToUnity(data) {
  unityClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function broadcastToWeb(data) {
  webClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

server.listen(PORT, () => {
  console.log(`WebSocket Relay Server running on port ${PORT}`);
  console.log(`ws://localhost:${PORT}`);
});
