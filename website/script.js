const video = document.getElementById('webcam');
const outputCanvas = document.getElementById('output');
const ctx = outputCanvas.getContext('2d');
const rightHandGestureElement = document.getElementById('rightHandGesture');
const leftHandGestureElement = document.getElementById('leftHandGesture');

// Initialize WebSocket connection
const socket = io("https://19c4-202-8-116-114.ngrok-free.app"); // Replace with your Raspberry Pi's IP

// ✅ Start Camera with Permission Handling
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        console.log("Camera started successfully");
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Failed to access webcam. Please check camera permissions and try again.");
    }
}


// ✅ Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults((results) => {
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.drawImage(results.image, 0, 0, outputCanvas.width, outputCanvas.height);

    let rightHandGesture = "None";
    let leftHandGesture = "None";

    if (results.multiHandLandmarks) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label; // "Left" or "Right"

            drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });

            if (handedness === "Left") {
                leftHandGesture = detectLeftHandGesture(landmarks);
            } else {
                rightHandGesture = detectRightHandGesture(landmarks);
            }
        }
    }

    rightHandGestureElement.textContent = `Right Hand: ${rightHandGesture}`;
    leftHandGestureElement.textContent = `Left Hand: ${leftHandGesture}`;

    // Send gesture data to the server via WebSocket
    socket.emit('update_gesture', {
        right_hand: rightHandGesture,
        left_hand: leftHandGesture
    });
});

// Listen for servo updates from the server
socket.on('servo_update', (angles) => {
    console.log("Servo Angles Updated:", angles);
});

// Listen for errors from the server
socket.on('error', (error) => {
    console.error("Server Error:", error.message);
});

// ✅ Detect Left Hand Gestures (Motor Control)
function detectLeftHandGesture(landmarks) {
    const fingers = [8, 12, 16, 20]; // Index, Middle, Ring, Little
    let extendedFingers = [];

    for (let i = 0; i < fingers.length; i++) {
        if (landmarks[fingers[i]].y < landmarks[fingers[i] - 2].y) {
            extendedFingers.push(fingers[i]);
        }
    }

    let littleExtended = extendedFingers.includes(20);
    let ringExtended = extendedFingers.includes(16);
    let indexExtended = extendedFingers.includes(8);

    if (extendedFingers.length === 0) return "Fist (Do Nothing)";
    if (extendedFingers.length === 1 && indexExtended) return "Motor 1";
    if (extendedFingers.length === 2 && extendedFingers.includes(12)) return "Motor 2";
    if (extendedFingers.length === 3 && extendedFingers.includes(16)) return "Motor 3";
    if (extendedFingers.length === 4 && extendedFingers.includes(20)) return "Motor 4";
    if (littleExtended && ringExtended) return "Motor 5"; // Little + Ring
    if (littleExtended && extendedFingers.length === 1) return "Motor 6"; // Only Little Finger

    return "Unknown Gesture";
}

// ✅ Detect Right Hand Gestures (Direction Control)
function detectRightHandGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    return distance < 0.1 ? "Rotate Clockwise" : "Rotate Anticlockwise";
}

// ✅ Start Everything After Page Loads
window.onload = async () => {
    await startCamera(); // Ensure the camera starts before processing
    console.log("Initializing MediaPipe Hands...");

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 720,
        height: 540
    });
    camera.start();
    console.log("MediaPipe Hands initialized successfully");
};

