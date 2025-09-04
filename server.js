  const express = require('express');
  const cors = require('cors');
  const axios = require('axios');

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static('public'));

  // ngrok Tunnel Configuration - Update this with your ngrok URL
  const WSL2_TUNNEL_URL = process.env.WSL2_TUNNEL_URL || 'https://48b8d9718028.ngrok-free.app/';
  const WSL2_BASE_URL = WSL2_TUNNEL_URL;

  console.log(`🔗 Connecting to ROS2 Bridge via ngrok tunnel at: ${WSL2_BASE_URL}`);

  // Joint configuration
  const JOINT_CONFIG = {
    'joint1': {
      topic: '/joint1_cmd',
      type: 'std_msgs/Float64'
    },
    'joint2': {
      topic: '/joint2_cmd', 
      type: 'std_msgs/Float64'
    },
    'joint3': {
      topic: '/joint3_cmd',
      type: 'std_msgs/Float64'
    },
    'joint4': {
      topic: '/joint4_cmd',
      type: 'std_msgs/Float64'
    },
    'joint5': {
      topic: '/joint5_cmd',
      type: 'std_msgs/Float64'
    },
    'left_finger': {
      topic: '/left_finger_cmd',
      type: 'std_msgs/Float64'
    },
    'right_finger': {
      topic: '/right_finger_cmd',
      type: 'std_msgs/Float64'
    }
  };

  // Health check
  app.get('/api/health', async (req, res) => {
    try {
      // Check WSL2 bridge connection
      const wsl2Response = await axios.get(`${WSL2_BASE_URL}/health`, { timeout: 5000 });
      
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        wsl2_connected: true,
        wsl2_status: wsl2Response.data,
        wsl2_url: WSL2_BASE_URL
      });
    } catch (error) {
      console.error('WSL2 connection failed:', error.message);
      res.json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        wsl2_connected: false,
        wsl2_url: WSL2_BASE_URL,
        error: error.message
      });
    }
  });

  // Get available joints
  app.get('/api/joints', (req, res) => {
    const joints = Object.keys(JOINT_CONFIG).map(jointName => ({
      name: jointName,
      topic: JOINT_CONFIG[jointName].topic,
      type: JOINT_CONFIG[jointName].type
    }));
    
    res.json({ joints });
  });

  // Move single joint
  app.post('/api/joint/:jointName/move', async (req, res) => {
    const { jointName } = req.params;
    const { position } = req.body;
    
    if (!JOINT_CONFIG[jointName]) {
      return res.status(404).json({ 
        error: 'Joint not found', 
        available_joints: Object.keys(JOINT_CONFIG) 
      });
    }
    
    if (typeof position !== 'number') {
      return res.status(400).json({ 
        error: 'Position must be a number' 
      });
    }
    
    try {
      // Forward request to WSL2 ROS2 bridge
      const response = await axios.post(`${WSL2_BASE_URL}/joint/move`, {
        joint_name: jointName,
        topic: JOINT_CONFIG[jointName].topic,
        position: position
      }, { timeout: 10000 });
      
      console.log(`✅ Sent ${jointName}=${position} to WSL2`);
      
      res.json({ 
        success: true,
        joint: jointName,
        position: position,
        timestamp: new Date().toISOString(),
        wsl2_response: response.data
      });
      
    } catch (error) {
      console.error(`❌ Error moving joint ${jointName}:`, error.message);
      res.status(500).json({ 
        error: 'Failed to communicate with WSL2 ROS2 bridge',
        details: error.message,
        wsl2_url: WSL2_BASE_URL
      });
    }
  });

  // Move multiple joints
  app.post('/api/joints/move', async (req, res) => {
    const { joints } = req.body;
    
    if (!joints || typeof joints !== 'object') {
      return res.status(400).json({ 
        error: 'joints object is required' 
      });
    }
    
    try {
      // Prepare joints data for WSL2
      const jointsData = Object.entries(joints).map(([jointName, position]) => ({
        joint_name: jointName,
        topic: JOINT_CONFIG[jointName]?.topic,
        position: position
      }));
      
      // Forward to WSL2 ROS2 bridge
      const response = await axios.post(`${WSL2_BASE_URL}/joints/move`, {
        joints: jointsData
      }, { timeout: 10000 });
      
      console.log(`✅ Sent multi-joint command to WSL2:`, joints);
      
      res.json({
        success: true,
        joints: joints,
        timestamp: new Date().toISOString(),
        wsl2_response: response.data
      });
      
    } catch (error) {
      console.error('❌ Error moving multiple joints:', error.message);
      res.status(500).json({ 
        error: 'Failed to communicate with WSL2 ROS2 bridge',
        details: error.message,
        wsl2_url: WSL2_BASE_URL
      });
    }
  });

  // Predefined poses
  const PREDEFINED_POSES = {
    'home': {
      joint1: 0.0,
      joint2: 0.0,
      joint3: 0.0,
      joint4: 0.0,
      joint5: 0.0,
      left_finger: 0.0,
      right_finger: 0.0
    },
    'pose1': {
      joint1: 1.5708,  // 90 degrees
      joint2: 0.7854,  // 45 degrees
      joint3: -0.7854, // -45 degrees
      joint4: 0.3927,  // 22.5 degrees
      joint5: -0.3927, // -22.5 degrees
      left_finger: 0.0,
      right_finger: 0.0
    },
    'pose2': {
      joint1: -1.5708, // -90 degrees
      joint2: 1.5708,  // 90 degrees
      joint3: 0.0,
      joint4: -0.7854, // -45 degrees
      joint5: 0.7854,  // 45 degrees
      left_finger: 0.15,
      right_finger: 0.15
    },
    'pose3': {
      joint1: 0.0,
      joint2: -1.5708, // -90 degrees
      joint3: 1.5708,  // 90 degrees
      joint4: 1.5708,  // 90 degrees
      joint5: 0.0,
      left_finger: 0.0,
      right_finger: 0.0
    },
    'stretch': {
      joint1: 0.0,
      joint2: 0.0,
      joint3: 0.0,
      joint4: 0.0,
      joint5: 1.5708,  // 90 degrees (stretched out)
      left_finger: 0.15,
      right_finger: 0.15
    },
    'curl': {
      joint1: 0.0,
      joint2: 0.0,
      joint3: 0.0,
      joint4: -1.5708, // -90 degrees
      joint5: -1.5708, // -90 degrees (curled up)
      left_finger: 0.0,
      right_finger: 0.0
    },
    'pickup': {
      joint1: 0.56,
      joint2: 0.65,
      joint3: 0.17,
      joint4: -0.40,
      joint5: 1.22,
      left_finger: 0.15,
      right_finger: 0.15
    },
    'grip_open': {
      left_finger: 0.15,
      right_finger: 0.15
    },
    'grip_close': {
      left_finger: 0.0,
      right_finger: 0.0
    }
  };

  // Execute predefined pose
  app.post('/api/pose/:poseName', async (req, res) => {
    const { poseName } = req.params;
    
    if (!PREDEFINED_POSES[poseName]) {
      return res.status(404).json({
        error: 'Pose not found',
        available_poses: Object.keys(PREDEFINED_POSES)
      });
    }
    
    // Forward to multi-joint move
    req.body = { joints: PREDEFINED_POSES[poseName] };
    req.url = '/api/joints/move';
    req.method = 'POST';
    
    return app._router.handle(req, res);
  });

  // Get available poses
  app.get('/api/poses', (req, res) => {
    const poses = Object.keys(PREDEFINED_POSES).map(poseName => ({
      name: poseName,
      joints: PREDEFINED_POSES[poseName]
    }));
    
    res.json({ poses });
  });

  // WSL2 IP detection endpoint
  app.get('/api/wsl2/detect', async (req, res) => {
    const possibleIPs = [
      '172.20.226.22',   // Common WSL2 IP
      '172.18.0.1',     // Another common range
      '192.168.1.1',    // Local network
      'localhost'       // Fallback
    ];
    
    const results = [];
    
    for (const ip of possibleIPs) {
      try {
        const testUrl = `http://${ip}:8080/health`;
        const response = await axios.get(testUrl, { timeout: 2000 });
        results.push({
          ip: ip,
          status: 'reachable',
          response: response.data
        });
      } catch (error) {
        results.push({
          ip: ip,
          status: 'unreachable',
          error: error.message
        });
      }
    }
    
    res.json({
      current_wsl2_ip: WSL2_IP,
      test_results: results,
      instructions: "Update WSL2_IP environment variable with working IP"
    });
  });

  // Error handling
  app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ 
      error: 'Endpoint not found',
      available_endpoints: [
        'GET /api/health',
        'GET /api/joints', 
        'POST /api/joint/:jointName/move',
        'POST /api/joints/move',
        'GET /api/poses',
        'POST /api/pose/:poseName',
        'GET /api/wsl2/detect'
      ]
    });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`\n🚀 ROS2 Joint Controller API running on http://localhost:${PORT}`);
    console.log(`🔗 Connecting to ROS2 Bridge via ngrok tunnel at: ${WSL2_BASE_URL}`);
    console.log('\n📋 Available endpoints:');
    console.log(`  GET  http://localhost:${PORT}/api/health`);
    console.log(`  GET  http://localhost:${PORT}/api/joints`);
    console.log(`  POST http://localhost:${PORT}/api/joint/:jointName/move`);
    console.log(`  POST http://localhost:${PORT}/api/joints/move`);
    console.log(`  GET  http://localhost:${PORT}/api/poses`);
    console.log(`  POST http://localhost:${PORT}/api/pose/:poseName`);
    console.log(`  GET  http://localhost:${PORT}/api/wsl2/detect`);
    console.log(`\n📖 Visit http://localhost:${PORT} for the web interface`);
    console.log(`\n💡 To get your ngrok URL, run in WSL2: ngrok http 8080`);
    console.log(`💡 Then set: export WSL2_TUNNEL_URL=https://your-ngrok-url.ngrok-free.app`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Windows server shutting down...');
    process.exit(0);
  });
