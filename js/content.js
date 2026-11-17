/* =====================================================================
   PORTFOLIO CONTENT
   ---------------------------------------------------------------------
   Everything shown inside the buildings lives here. Edit text, add media
   or links without touching the 3D code.

   media item types:
     { type: 'video',   src, poster, caption }        local mp4
     { type: 'youtube', id, poster, caption }         YouTube video id
     { type: 'image',   src, caption }
   ===================================================================== */
window.PORTFOLIO = {
  person: {
    name: 'Seyed Tofigh Hosseini Moghaddam',
    shortName: 'Tofigh Hosseini',
    headline: 'Mechatronics Engineer · Flight Control · Embedded Software · Autonomous Systems',
    email: 'tofigh.main@gmail.com',
    github: 'https://github.com/Tofigh-Tevfik',
    cv: 'assets/docs/Tofigh_Hosseini_Moghaddam_CV.pdf'
  },

  zones: [
    /* ------------------------------------------------------------- */
    {
      id: 'hq',
      building: 'tower',
      name: 'Control Tower',
      category: 'About',
      accent: '#f5b942',
      pos: [0, 0],
      title: 'Seyed Tofigh Hosseini Moghaddam',
      kicker: 'About me',
      subtitle: 'Mechatronics engineer who turns control and autonomy concepts into real-time software for resource-constrained systems.',
      summary: [
        'I work across the whole chain of guidance, navigation and control: mathematical modelling, simulation, real-time implementation, embedded feasibility, sensor processing, experimental verification and technical reporting.',
        'My recent work puts Model Predictive Control and Differential-Flatness-Based Control directly inside PX4 firmware and flies them on a real quadrotor. I also have paid R&D experience in railway-vehicle mechanical design and subsystem integration.',
        'Based in Kayseri, Türkiye, and relocating to Toronto, ON.'
      ],
      skills: [
        { group: 'Flight control & autonomy', items: ['PX4', 'MPC', 'CMPC', 'DFBC', 'Rate-level INDI', 'PID', 'LQR', 'Quadrotor dynamics', 'Trajectory generation & tracking'] },
        { group: 'Embedded & real-time software', items: ['C/C++', 'Fixed-size numerics', 'PX4 modules / uORB', 'ESP32', 'Bare-metal & RTOS', 'CMake', 'Git'] },
        { group: 'Robotics & sensing', items: ['ROS / ROS 2', 'Gazebo', 'SITL / HITL', 'EKF', 'Madgwick / Mahony', 'I2C · UART · UDP', 'ZeroMQ', 'Linux'] },
        { group: 'Modelling & design', items: ['MATLAB / Simulink', 'Simscape', 'Python', 'SolidWorks', 'CATIA', 'Siemens NX'] }
      ],
      facts: [
        ['Languages', 'Persian (native) · Turkish (fluent) · English (advanced)'],
        ['Education', 'M.Sc. & B.Sc. Mechatronics Engineering, Erciyes University'],
        ['Honours', 'Ranked 1st in the Faculty of Engineering, 2023']
      ],
      media: [
        { type: 'image', src: 'assets/img/about/profile.jpg', caption: 'Seyed Tofigh Hosseini Moghaddam' }
      ],
      links: [
        { label: 'Email me', url: 'mailto:tofigh.main@gmail.com', kind: 'mail' },
        { label: 'GitHub', url: 'https://github.com/Tofigh-Tevfik', kind: 'github' },
        { label: 'Download CV (PDF)', url: 'assets/docs/Tofigh_Hosseini_Moghaddam_CV.pdf', kind: 'download' }
      ],
      note: 'P.S. The snow-capped volcano on the horizon is Mount Erciyes, the mountain above Kayseri, where most of this work was done.'
    },

    /* ------------------------------------------------------------- */
    {
      id: 'px4',
      building: 'hangar',
      name: 'Flight Test Hangar',
      category: 'Research',
      accent: '#38bdf8',
      pos: [0, -135],
      title: 'Real-Time Onboard MPC & DFBC on PX4',
      kicker: 'Research · 2025 – 2026 · First author',
      subtitle: 'Can advanced trajectory-tracking controllers run directly inside PX4 firmware on a resource-constrained flight controller, with no companion computer?',
      summary: [
        'Many advanced UAV control studies rely on an offboard or companion computer. In this project I moved Model Predictive Control and Differential-Flatness-Based Control into the PX4 flight stack itself, keeping real-time scheduling and the flight controller’s hardware limits intact, and then flew them.'
      ],
      points: [
        'Designed and implemented onboard MPC and DFBC trajectory-tracking modules in PX4 C++ firmware, and integrated a trajectory reader and a uORB-based horizon-reference interface.',
        'Customised an embedded MPC solver with fixed-size matrix operations, warm starts and bounded iterations so it fits the flight controller.',
        'Built a three-stage verification pipeline: SITL studies of disturbance, noise and model uncertainty; HITL analysis of CPU, RAM and loop time; then physical flight on an F450 / CubeOrange quadrotor.',
        'Evaluated MPC, convolution-weighted MPC (CMPC) variants, DFBC and a rate-level INDI augmentation.'
      ],
      chart: {
        title: 'Real-flight tracking error: same-time 3D RMSE (lower is better)',
        unit: 'm',
        groups: [
          { label: 'Lemniscate @ 5.2 m/s', bars: [['Tested PX4 default', 0.877], ['DFBC', 0.491], ['MPC', 0.410]], callout: 'MPC: 53.2% lower' },
          { label: 'Lemniscate @ 8.2 m/s', bars: [['Tested PX4 default', 2.063], ['DFBC', 0.775], ['MPC', 0.713]], callout: 'MPC: 65.4% lower' }
        ],
        note: 'F450 / CubeOrange, 5 Oct 2026, one physical run per configuration, so these are not averages. The 8.2 m/s reference needed about 66° tilt while the tested PX4 default was limited to about 45°, so the fast case is not an equal-constraint comparison. MPC ran onboard at about 69% CPU, versus 46–48% for the other configurations.'
      },
      media: [
        { type: 'video', src: 'assets/video/drone-flight.mp4', poster: 'assets/img/posters/drone-flight.jpg', caption: 'Physical flight test of the custom PX4 controllers' },
        { type: 'youtube', id: 'xHurFEICEpk', poster: 'assets/img/posters/px4-paper.jpg', caption: 'Video demonstration accompanying the manuscript' },
        { type: 'image', src: 'assets/img/px4/f450-drone.jpg', caption: 'The F450 test vehicle with a CubeOrange flight controller' },
        { type: 'image', src: 'assets/img/px4/px4-architecture.jpg', caption: 'Custom modules inside the PX4 architecture: trajectory_reader → custom_pos_control → rate control' },
        { type: 'image', src: 'assets/img/px4/flight-topdown.jpg', caption: 'Real-flight trajectory comparison on the physical quadrotor' },
        { type: 'image', src: 'assets/img/px4/lemniscate-tubes.jpg', caption: 'Lemniscate tracking tubes and error over time (manuscript figure)' },
        { type: 'image', src: 'assets/img/px4/mpc-structure.jpg', caption: 'MPC control structure integrated into the PX4 pipeline' },
        { type: 'image', src: 'assets/img/px4/dfbc-structure.jpg', caption: 'DFBC structure for feedforward-oriented trajectory tracking' },
        { type: 'image', src: 'assets/img/px4/hitl-resources.jpg', caption: 'HITL resource profile: CPU, RAM and loop time' },
        { type: 'image', src: 'assets/img/px4/noise-boxplot.jpg', caption: 'Noise-sensitivity analysis across controllers' }
      ],
      publication: {
        title: 'Real-Time Implementation of Model Predictive and Differential Flatness-Based Control under Hardware Constraints in PX4 Flight Controllers',
        authors: 'S. T. Hosseini Moghaddam, E. Arslan, M. Erşen',
        status: 'Submitted manuscript, 2026'
      },
      tags: ['PX4', 'C++', 'uORB', 'MPC', 'DFBC', 'INDI', 'SITL', 'HITL', 'Real flight'],
      links: [
        { label: 'Watch the demo on YouTube', url: 'https://youtu.be/xHurFEICEpk', kind: 'youtube' }
      ],
      note: 'The source code will be published after the paper.'
    },

    /* ------------------------------------------------------------- */
    {
      id: 'cmpc',
      building: 'researchTower',
      name: 'CMPC Research Tower',
      category: 'Research',
      accent: '#a78bfa',
      pos: [-100, -100],
      title: 'Convolutional Weighting-Enhanced MPC',
      kicker: 'M.Sc. thesis research · 2023 – 2025',
      thumb: 'assets/img/posters/cmpc.jpg',
      subtitle: 'An MPC that sees what’s coming. Convolution over the reference trajectory adapts the cost-function weights before the hard part of the path arrives.',
      summary: [
        'In classical MPC the cost weights are fixed or tuned by hand. When a trajectory’s curvature or aggressiveness changes, fixed weights make the controller too conservative in some segments and not responsive enough in others.',
        'CMPC convolves the reference trajectory to extract local reference-change features. These features adapt the MPC weighting over the prediction horizon, so the controller reacts to upcoming changes earlier and finds a better balance between tracking performance and control effort.'
      ],
      points: [
        'Implemented CMPC variants in MATLAB for linear, nonlinear and adaptive MPC structures.',
        'Compared CMPC with fixed-weight MPC baselines and LQR-like reference controllers.',
        'Studied tracking performance, energy behaviour, noise sensitivity and loop-time behaviour.',
        'M.Sc. thesis: Convolutional Model Predictive Control for Rotary-Wing UAVs.'
      ],
      media: [
        { type: 'video', src: 'assets/video/cmpc.mp4', poster: 'assets/img/posters/cmpc.jpg', caption: 'Real-time CMPC simulation: convolution signal, difficulty and horizon weights' },
        { type: 'image', src: 'assets/img/cmpc/conv-operation.jpg', caption: 'The convolution operation that extracts local reference variation' },
        { type: 'image', src: 'assets/img/cmpc/adaptive-diagram.jpg', caption: 'Adaptive CMPC architecture and cost-weight adaptation' },
        { type: 'image', src: 'assets/img/cmpc/adaptive-results.jpg', caption: 'Performance comparison across controller variants' },
        { type: 'image', src: 'assets/img/cmpc/trajectories.jpg', caption: 'Reference trajectories used to test tracking behaviour' },
        { type: 'image', src: 'assets/img/cmpc/simulation.jpg', caption: 'Simulation snapshot' },
        { type: 'image', src: 'assets/img/cmpc/quadrotor-model.jpg', caption: 'Quadrotor model and frames' }
      ],
      publication: {
        title: 'Convolutional Weighting-Enhanced MPC: A Comprehensive Mathematical Framework for Energy-Efficient Quadrotor Reference Tracking',
        authors: 'E. Arslan, S. T. Hosseini Moghaddam, M. Suveren',
        status: 'Co-authored journal manuscript'
      },
      tags: ['MATLAB', 'Linear MPC', 'Nonlinear MPC', 'Adaptive MPC', 'LQR', 'Energy efficiency']
    },

    /* ------------------------------------------------------------- */
    {
      id: 'minsnap',
      building: 'arena',
      name: 'Aerobatics Arena',
      category: 'Projects',
      accent: '#fb7185',
      pos: [105, -100],
      title: 'Aggressive Quadrotor Maneuvers',
      kicker: 'Project · 2023 · Minimum snap + differential flatness',
      thumb: 'assets/img/posters/minsnap.jpg',
      subtitle: 'Smooth, high-acceleration trajectories through waypoints, tracked by a nonlinear controller built on differential flatness.',
      summary: [
        'I built a quadrotor simulation that can fly aggressive maneuvers, using Gazebo integrated with ROS nodes. A minimum-snap planner generates the trajectories by optimising the fourth derivative of position (snap) across piecewise polynomials, which suits high-acceleration flight.',
        'To track them I used differential flatness, which maps the planned flat outputs to full quadrotor states and inputs. A nonlinear controller then follows the plan within the vehicle’s dynamic limits.'
      ],
      points: [
        'Minimum-snap piecewise-polynomial planner (Hessian/QP formulation) in MATLAB and Python.',
        'Differential-flatness-based nonlinear tracking controller.',
        'ROS + Gazebo simulation, plus MATLAB animation of several 3D test trajectories.'
      ],
      game: 'Try it yourself: fly through every ring in the arena to finish the course.',
      media: [
        { type: 'video', src: 'assets/video/minsnap.mp4', poster: 'assets/img/posters/minsnap.jpg', caption: 'Aggressive trajectories tracked in simulation' },
        { type: 'youtube', id: 'H3kuU0CeNwU', caption: 'Quadrotor simulation video on YouTube' },
        { type: 'image', src: 'assets/img/minsnap/trajectory-2.jpg', caption: 'Minimum-snap trajectory and tracking result' },
        { type: 'image', src: 'assets/img/minsnap/trajectory-4.jpg', caption: 'Minimum-snap trajectory and tracking result' },
        { type: 'image', src: 'assets/img/minsnap/trajectory-6.jpg', caption: 'Minimum-snap trajectory and tracking result' },
        { type: 'image', src: 'assets/img/minsnap/frames.jpg', caption: 'World, flat and body frames used in the flatness mapping' }
      ],
      tags: ['ROS', 'Gazebo', 'Minimum snap', 'Differential flatness', 'Nonlinear control', 'MATLAB', 'Python'],
      links: [
        { label: 'GitHub: quadrotor_sim', url: 'https://github.com/Tofigh-Tevfik/quadrotor_sim', kind: 'github' },
        { label: 'YouTube video', url: 'https://youtu.be/H3kuU0CeNwU', kind: 'youtube' }
      ]
    },

    /* ------------------------------------------------------------- */
    {
      id: 'imu',
      building: 'sensorLab',
      name: 'Sensor Fusion Lab',
      category: 'Projects',
      accent: '#34d399',
      pos: [-140, -5],
      title: 'IMU Orientation Estimation on ESP32',
      kicker: 'Embedded project · 2025',
      subtitle: 'Five orientation filters running in real time on a microcontroller, compared side by side.',
      summary: [
        'Raw accelerometer and gyroscope data are noisy and drift. Flight control and robotics need a reliable orientation estimate, and on a microcontroller it has to be computed within tight compute and timing limits.',
        'This project implements and compares five sensor-fusion filters on an ESP32 reading a 6-axis IMU over I2C, and streams the estimates to a host PC over UDP for live visualisation.'
      ],
      points: [
        'Implemented low-pass, complementary, Madgwick, Mahony and Extended Kalman filters in C/C++ for real-time execution.',
        'Quaternion orientation representation to avoid singularities, with gyroscope-bias handling.',
        'Frequency-domain (FFT) analysis of raw IMU data for filter tuning.',
        'Compared stability, response speed, drift, noise sensitivity and computational cost.'
      ],
      media: [
        { type: 'youtube', id: 'vNDOOl13mXI', poster: 'assets/img/posters/imu.jpg', caption: 'Live comparison: unfiltered vs. EKF orientation' },
        { type: 'image', src: 'assets/img/imu/board.jpg', caption: 'ESP32 + IMU test board' },
        { type: 'image', src: 'assets/img/imu/circuit.jpg', caption: 'Hardware connection diagram' },
        { type: 'image', src: 'assets/img/imu/raw.jpg', caption: 'Raw IMU measurements' },
        { type: 'image', src: 'assets/img/imu/fft.jpg', caption: 'FFT of the IMU signal, used for filter tuning' }
      ],
      tags: ['ESP32', 'C/C++', 'I2C', 'UDP', 'EKF', 'Madgwick', 'Mahony', 'Quaternions'],
      links: [
        { label: 'GitHub: imu_sensor_fusion', url: 'https://github.com/Tofigh-Tevfik/imu_sensor_fusion', kind: 'github' },
        { label: 'YouTube video', url: 'https://youtu.be/vNDOOl13mXI', kind: 'youtube' }
      ]
    },

    /* ------------------------------------------------------------- */
    {
      id: 'lidar',
      building: 'lidarStation',
      name: 'LiDAR Station',
      category: 'Projects',
      accent: '#f43f5e',
      pos: [140, 0],
      title: 'Real-Time YDLidar X4 Acquisition & Visualisation',
      kicker: 'Embedded / Linux project · 2025',
      thumb: 'assets/img/posters/lidar.jpg',
      subtitle: 'A low-level C++ driver for a 2D LiDAR: raw serial bytes in, a live point cloud out.',
      summary: [
        'This is a modular C++ interface for the YDLidar X4 on Linux. It configures a non-standard serial port, parses the sensor’s raw packets into scans and publishes them over a message bus to a real-time 2D visualiser.'
      ],
      points: [
        'Configured non-standard 128000 baud serial communication with Linux/POSIX APIs.',
        'Parsed raw packets into structured scans (angle, distance, timestamp), with checksum validation, boundary checks and error handling.',
        'Published scan data through ZeroMQ PUB/SUB and rendered a real-time 2D point cloud with SFML.'
      ],
      media: [
        { type: 'youtube', id: 'TBC5uqdGn5M', poster: 'assets/img/posters/lidar.jpg', caption: 'Live scanning demo' },
        { type: 'image', src: 'assets/img/lidar/packet-structure.jpg', caption: 'YDLidar packet structure used to parse scan measurements' }
      ],
      tags: ['C++', 'Linux', 'POSIX serial', 'ZeroMQ', 'SFML', 'Packet parsing'],
      links: [
        { label: 'GitHub: ydlidar_x4_project', url: 'https://github.com/Tofigh-Tevfik/ydlidar_x4_project', kind: 'github' },
        { label: 'YouTube video', url: 'https://youtu.be/TBC5uqdGn5M', kind: 'youtube' }
      ]
    },

    /* ------------------------------------------------------------- */
    {
      id: 'cleaner',
      building: 'house',
      name: 'Smart House',
      category: 'Projects',
      accent: '#22d3ee',
      pos: [-105, 100],
      title: 'ROS Vacuum-Cleaner Robot & Coverage Planning',
      kicker: 'Mobile robotics project · 2023',
      subtitle: 'Mapping, localisation and a coverage planner that cleans the whole floor while avoiding obstacles.',
      summary: [
        'A ROS/Gazebo workflow for a mobile cleaning robot covering mapped indoor environments. The robot builds a map, localises itself in it and follows a coverage path generated from a weighted grid of the occupancy map.'
      ],
      points: [
        'Built a ROS/Gazebo simulation workflow for a mobile cleaning robot.',
        'Worked with SLAM, AMCL localisation and occupancy grids, and studied A* and RRT path planning.',
        'Developed a weighted-grid coverage planner that respects static map constraints and avoids obstacles.'
      ],
      media: [
        { type: 'youtube', id: 'XLfpaYYfUjw', poster: 'assets/img/cleaner/house-gazebo.jpg', caption: 'Coverage run in simulation' },
        { type: 'image', src: 'assets/img/cleaner/house-gazebo.jpg', caption: 'Gazebo house environment' },
        { type: 'image', src: 'assets/img/cleaner/tracked-path.jpg', caption: 'Path followed during the coverage task' },
        { type: 'image', src: 'assets/img/cleaner/grid-weights.jpg', caption: 'Grid weighting over the occupancy map' },
        { type: 'image', src: 'assets/img/cleaner/grid-coverage.jpg', caption: 'Resulting coverage path' },
        { type: 'image', src: 'assets/img/cleaner/cafe-gazebo.jpg', caption: 'Café world used for testing' }
      ],
      tags: ['ROS', 'Gazebo', 'SLAM', 'AMCL', 'Occupancy grid', 'Coverage planning'],
      links: [
        { label: 'GitHub: cleaner_bot', url: 'https://github.com/Tofigh-Tevfik/cleaner_bot', kind: 'github' },
        { label: 'YouTube video', url: 'https://youtu.be/XLfpaYYfUjw', kind: 'youtube' }
      ]
    },

    /* ------------------------------------------------------------- */
    {
      id: 'agri',
      building: 'farm',
      name: 'Agri-UAV Farm',
      category: 'Projects',
      accent: '#a3e635',
      pos: [110, 105],
      title: 'Guidance & Path Following for Agricultural UAVs',
      kicker: 'Project · 2023 – 2024',
      thumb: 'assets/img/posters/pure-pursuit.jpg',
      subtitle: 'Cover the whole field, stay inside the boundary and turn corners cleanly.',
      summary: [
        'Agricultural spraying UAVs have to cover a field uniformly without leaving its boundary. Poor trajectory tracking leaves gaps, crosses boundaries and sprays unevenly. This project connects the guidance layer from mission to path to trackable commands, and measures how controller behaviour affects mission quality.'
      ],
      points: [
        'Developed coverage path planning (back-and-forth and spiral patterns) for field-like areas, integrated with a quadrotor simulation.',
        'Built a cascaded PID position/attitude control structure for trajectory tracking in ROS/Gazebo.',
        'Added a Pure Pursuit guidance layer through PX4 offboard control to improve corner behaviour, reduce boundary deviation and smooth the velocity profile.'
      ],
      media: [
        { type: 'youtube', id: 'sFl1axQiSyM', poster: 'assets/img/posters/pure-pursuit.jpg', caption: 'Pure Pursuit path following in PX4 offboard mode' },
        { type: 'youtube', id: 'zHb4ed1TO-0', poster: 'assets/img/agri/back-and-forth.jpg', caption: 'Coverage path planning demo' },
        { type: 'image', src: 'assets/img/agri/back-and-forth.jpg', caption: 'Back-and-forth coverage pattern' },
        { type: 'image', src: 'assets/img/agri/spiral.jpg', caption: 'Spiral coverage pattern' },
        { type: 'image', src: 'assets/img/agri/pure-pursuit-result.jpg', caption: 'Pure Pursuit path-following result' },
        { type: 'image', src: 'assets/img/agri/position-control-result.jpg', caption: 'Position-control tracking result, for comparison' },
        { type: 'image', src: 'assets/img/agri/pure-pursuit-geometry.jpg', caption: 'Pure Pursuit look-ahead geometry' },
        { type: 'image', src: 'assets/img/agri/simulation-structure.jpg', caption: 'ROS 2 / PX4 simulation structure' },
        { type: 'image', src: 'assets/img/agri/coverage-early.jpg', caption: 'Early coverage-planning result' }
      ],
      publication: {
        title: 'Path Tracking for Agricultural Spraying UAVs: A Pure Pursuit Control Approach',
        authors: 'E. Arslan, S. T. Hosseini Moghaddam',
        status: 'Co-authored paper'
      },
      tags: ['PX4 offboard', 'ROS 2', 'Gazebo', 'Pure Pursuit', 'PID', 'Coverage planning'],
      links: [
        { label: 'Pure Pursuit video', url: 'https://youtu.be/sFl1axQiSyM', kind: 'youtube' },
        { label: 'Coverage-planning video', url: 'https://youtu.be/zHb4ed1TO-0', kind: 'youtube' }
      ]
    },

    /* ------------------------------------------------------------- */
    {
      id: 'kaaf',
      building: 'depot',
      name: 'Rail Depot',
      category: 'Experience',
      accent: '#fb923c',
      pos: [0, 150],
      title: 'KAAF Railway Vehicles: Mechanical Design Engineer, R&D',
      kicker: 'Industry · 2024 – 2025 · Kayseri, Türkiye',
      subtitle: 'Driver-cab design and subsystem integration for a battery-powered shunting locomotive.',
      summary: [
        'Paid industrial R&D role on a battery-powered shunting locomotive. It isn’t a GNC algorithm project, but it is where I learned to work under real product constraints: design responsibility, manufacturability, subsystem interfaces, documentation and coordination with mechanical, electrical and manufacturing teams.'
      ],
      points: [
        'Supported mechanical design and subsystem integration for the locomotive, including driver-cabin packaging and design iterations focused on manufacturability.',
        'Produced placement studies for HVAC, wiper/water-spray and driver-desk systems.',
        'Contributed to pneumatic freight-wagon brake-management and locomotive hydraulic-brake studies.',
        'Supported ladder-logic PLC work for a sand-filling vehicle, plus technical documentation and cross-functional R&D coordination.'
      ],
      media: [
        { type: 'image', src: 'assets/img/kaaf/locomotive.jpg', caption: 'The battery-powered shunting locomotive' },
        { type: 'image', src: 'assets/img/kaaf/cabin-cad.jpg', caption: 'Driver-cabin CAD work' },
        { type: 'image', src: 'assets/img/kaaf/cabin-build.jpg', caption: 'Cabin during manufacturing and integration' },
        { type: 'image', src: 'assets/img/kaaf/cabin-inside.jpg', caption: 'Completed cabin interior' },
        { type: 'image', src: 'assets/img/kaaf/cabin-entrance.jpg', caption: 'Cabin entrance' }
      ],
      tags: ['Mechanical design', 'Subsystem integration', 'CATIA', 'HVAC packaging', 'Brake systems', 'PLC']
    },

    /* ------------------------------------------------------------- */
    {
      id: 'cosim',
      building: 'simLab',
      name: 'Co-Simulation Lab',
      category: 'Research',
      accent: '#facc15',
      pos: [70, 28],
      title: 'ROS-Gazebo × MATLAB/Simulink Co-Simulation',
      kicker: 'Conference paper · ISAS 2023 · Co-author',
      thumb: 'assets/img/posters/cosim.jpg',
      subtitle: 'A cart-pole testbed linking Gazebo physics with MATLAB/Simulink control, built as a base for design optimisation.',
      summary: [
        'Co-simulation joins several simulation environments so that they run together. This paper presents an integrated ROS-Gazebo ↔ MATLAB/Simulink framework, using the cart-pole (a classic control benchmark) as the test system.',
        'The cart-pole is modelled and simulated as both a linear and a nonlinear system in MATLAB, and an LQR controller is applied in MATLAB and in Gazebo. The paper shows that the three simulations give different results and discusses why. It also shows how the framework plugs into optimisation loops, for example for reinforcement-learning-based design optimisation.'
      ],
      points: [
        'Cart-pole dynamics: linear and nonlinear MATLAB models.',
        'LQR control applied across MATLAB-linear, MATLAB-nonlinear and ROS-Gazebo.',
        'ROS ↔ MATLAB/Simulink co-simulation pipeline with parallel simulation instances for design optimisation.'
      ],
      media: [
        { type: 'video', src: 'assets/video/cosim.mp4', poster: 'assets/img/posters/cosim.jpg', caption: 'Co-simulation in action' },
        { type: 'image', src: 'assets/img/cosim/framework.jpg', caption: 'The co-simulation framework' },
        { type: 'image', src: 'assets/img/cosim/cart-pole.jpg', caption: 'Cart-pole configuration' },
        { type: 'image', src: 'assets/img/cosim/parallel.jpg', caption: 'Parallel computation for design optimisation' }
      ],
      publication: {
        title: 'ROS Gazebo and MATLAB/Simulink Co-simulation for Cart-Pole System: A Framework for Design Optimization',
        authors: 'E. Arslan, M. Suveren, S. T. Hosseini Moghaddam',
        status: 'ISAS 2023 conference paper'
      },
      tags: ['ROS', 'Gazebo', 'MATLAB/Simulink', 'LQR', 'Co-simulation', 'Design optimisation']
    },

    /* ------------------------------------------------------------- */
    {
      id: 'edu',
      building: 'university',
      name: 'Erciyes University',
      category: 'Education',
      accent: '#60a5fa',
      pos: [-69, -30],
      title: 'Education & Honours',
      kicker: '2019 – 2025 · Kayseri, Türkiye',
      subtitle: 'B.Sc. and M.Sc. in Mechatronics Engineering, graduating first in the Faculty of Engineering.',
      thumb: 'assets/img/edu/top-graduate-2023.jpg',
      timeline: [
        { when: '2023 – 2025', what: 'M.Sc., Mechatronics Engineering (with thesis)', detail: 'GPA 3.94 / 4.00 · Thesis: Convolutional Model Predictive Control for Rotary-Wing UAVs · Degree awarded 8 July 2025' },
        { when: '2019 – 2023', what: 'B.Sc., Mechatronics Engineering', detail: 'GPA 3.88 / 4.00 · Graduated August 2023' },
        { when: '2023', what: 'Top-ranking graduate of the Faculty of Engineering', detail: 'Certificate of Achievement, 2022–2023 academic year' },
        { when: '2023', what: 'Top-ranking graduate of the Mechatronics Engineering Department', detail: 'Certificate of Achievement, 2022–2023 academic year' }
      ],
      media: [
        { type: 'image', hero: true, photo: true, src: 'assets/img/edu/top-graduate-2023.jpg', caption: 'Graduation ceremony 2023: receiving the award as the top-ranking graduate of the Faculty of Engineering' },
        { type: 'image', src: 'assets/img/edu/faculty-first-en.jpg', caption: 'Certificate of Achievement: top-ranking graduate of the Faculty of Engineering (2022–2023)' },
        { type: 'image', src: 'assets/img/edu/department-first-en.jpg', caption: 'Certificate of Achievement: top-ranking graduate of the Mechatronics Engineering Department (2022–2023)' },
        { type: 'image', src: 'assets/img/edu/bsc-diploma.jpg', caption: 'B.Sc. diploma: Mechatronics Engineering, Erciyes University (2023)' },
        { type: 'image', src: 'assets/img/edu/msc-diploma.jpg', caption: 'M.Sc. diploma (with thesis): Mechatronics Engineering, Erciyes University (2025)' }
      ],
      tags: ['Mechatronics', 'Control theory', 'Robotics', 'Embedded systems']
    },

    /* ------------------------------------------------------------- */
    {
      id: 'library',
      building: 'library',
      name: 'Library',
      category: 'Publications',
      accent: '#e879f9',
      pos: [70, -28],
      title: 'Research & Publications',
      kicker: 'Papers, manuscripts and technical reports',
      subtitle: 'Each entry links to the building where the project lives.',
      publications: [
        { title: 'Real-Time Implementation of Model Predictive and Differential Flatness-Based Control under Hardware Constraints in PX4 Flight Controllers', authors: 'S. T. Hosseini Moghaddam, E. Arslan, M. Erşen', status: 'Submitted manuscript (first author), 2026', zone: 'px4' },
        { title: 'Convolutional Weighting-Enhanced MPC: A Comprehensive Mathematical Framework for Energy-Efficient Quadrotor Reference Tracking', authors: 'E. Arslan, S. T. Hosseini Moghaddam, M. Suveren', status: 'Co-authored journal manuscript', zone: 'cmpc' },
        { title: 'ROS Gazebo and MATLAB/Simulink Co-simulation for Cart-Pole System: A Framework for Design Optimization', authors: 'E. Arslan, M. Suveren, S. T. Hosseini Moghaddam', status: 'ISAS 2023 conference paper', zone: 'cosim' },
        { title: 'Path Tracking for Agricultural Spraying UAVs: A Pure Pursuit Control Approach', authors: 'E. Arslan, S. T. Hosseini Moghaddam', status: 'Co-authored paper', zone: 'agri' },
        { title: 'Convolutional Model Predictive Control for Rotary-Wing UAVs', authors: 'S. T. Hosseini Moghaddam', status: 'M.Sc. thesis, Erciyes University, 2025', zone: 'cmpc' }
      ],
      reports: [
        { title: 'Aggressive Quadrotor Maneuvers: Minimum-Snap Trajectory Generation and Nonlinear Control', zone: 'minsnap' },
        { title: 'Orientation Estimation Filters for a 6-Axis IMU on ESP32', zone: 'imu' },
        { title: 'Real-Time Data Acquisition and Visualization with YDLidar X4', zone: 'lidar' },
        { title: 'ROS-Based Vacuum Cleaner Robot and Coverage Path Planning', zone: 'cleaner' },
        { title: 'A Neural-Network Approach to the Forward Kinematics of Cable-Driven Parallel Robots (graduate coursework)' }
      ],
      media: [],
      tags: []
    },

    /* ------------------------------------------------------------- */
    {
      id: 'team',
      building: 'workshop',
      name: 'Robotics Workshop',
      category: 'Teams',
      accent: '#f97316',
      pos: [-70, 27],
      title: 'Competition Teams & Mentoring',
      kicker: 'Teknofest UAV team · FIRST Robotics mentor',
      subtitle: 'Where the drone obsession started: building and wiring multirotors with a student team, then passing it on.',
      timeline: [
        { when: 'B.Sc. years', what: 'Teknofest Rotary-Wing UAV Team: ERU Project LAB', detail: 'Mechanical design, mission-mechanism development and CAD; first hands-on work with the PX4 autopilot architecture, flight-controller integration and simulation testing.' },
        { when: '2022 – 2023', what: 'Robotics Mentor: Kayseri Robotics FIRST Robotics Competition (FRC) team', detail: 'Mentored high-school students in mechanical design, robot software, differential-drivetrain kinematics and DC-motor position control, and supported the CAD design of the competition robot.' }
      ],
      media: [
        { type: 'image', src: 'assets/img/team/teknofest-field.jpg', caption: 'Field assembly of the Teknofest multirotor' },
        { type: 'image', src: 'assets/img/team/teknofest-lab.jpg', caption: 'Building and wiring in the lab' },
        { type: 'image', src: 'assets/img/team/teknofest-cad.jpg', caption: 'Drone CAD for the Teknofest team' },
        { type: 'image', src: 'assets/img/team/teknofest-mechanism.jpg', caption: 'Mission-mechanism design' }
      ],
      tags: ['Teknofest', 'PX4', 'CAD', 'FRC', 'Mentoring']
    }
  ]
};
