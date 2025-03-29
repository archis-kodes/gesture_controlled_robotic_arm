const video = document.getElementById('webcam');
const outputCanvas = document.getElementById('output');
const ctx = outputCanvas.getContext('2d');
const rightHandGestureElement = document.getElementById('rightHandGesture');
const leftHandGestureElement = document.getElementById('leftHandGesture');

// Ngrok HTTPS URL
const socket = io("https://d05d-202-8-116-205.ngrok-free.app"); // Replace with your Ngrok URL

// Track previous gestures to avoid sending duplicate data
let previousRightHandGesture = null;
let previousLeftHandGesture = null;
let previousCommand = null;

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

    let rightHandGesture = 1; // Default to 1 (No Gesture Detected)
    let leftHandGesture = "No Gesture Detected";
    let currentCommand = "A"; // Default command

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

    // Determine command based on gesture combination
    if (rightHandGesture === 1) {
        currentCommand = "A";
    } else if (leftHandGesture === "Motor 1") {
        currentCommand = rightHandGesture === 2 ? "B" : "C";
    } else if (leftHandGesture === "Motor 2") {
        currentCommand = rightHandGesture === 2 ? "D" : "E";
    } else if (leftHandGesture === "Motor 3") {
        currentCommand = rightHandGesture === 2 ? "F" : "G";
    } else if (leftHandGesture === "Motor 4") {
        currentCommand = rightHandGesture === 2 ? "H" : "I";
    } else if (leftHandGesture === "Motor 5") {
        currentCommand = rightHandGesture === 2 ? "J" : "K";
    } else if (leftHandGesture === "Motor 6") {
        currentCommand = rightHandGesture === 2 ? "L" : "M";
    } else {
        currentCommand = "A"; // Default for any other combination
    }

    // Update UI
    rightHandGestureElement.textContent = `Right Hand: ${rightHandGesture === 1 ? "No Gesture" : rightHandGesture === 2 ? "Clockwise" : "Anti-clockwise"}`;
    leftHandGestureElement.textContent = `Left Hand: ${leftHandGesture}`;

    // Only send command if it has changed
    if (currentCommand !== previousCommand) {
        socket.emit('update_gesture', {
            command: currentCommand
        });
        
        console.log('Sending new command:', currentCommand);
        previousCommand = currentCommand;
        
        // Still track previous gestures for change detection
        previousRightHandGesture = rightHandGesture;
        previousLeftHandGesture = leftHandGesture;
    }
});

// Listen for servo updates from the server
socket.on('servo_update', (angles) => {
    console.log("Servo Angles Updated:", angles);
});

// Listen for uart responses from the server
socket.on('uart_response', (response) => {
    console.log("Server response:", response);
});

// Listen for errors from the server
socket.on('error', (error) => {
    console.error("Server Error:", error.message);
});

// ✅ Detect Left Hand Gestures (Motor Control)
function detectLeftHandGesture(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return "No Gesture Detected";
    }

    const fingers = [8, 12, 16, 20]; // Index, Middle, Ring, Little
    let extendedFingers = [];

    for (let i = 0; i < fingers.length; i++) {
        const fingertip = landmarks[fingers[i]];
        const fingerBase = landmarks[fingers[i] - 2];

        if (!fingertip || !fingerBase || !fingertip.y || !fingerBase.y) {
            continue;
        }

        if (fingertip.y < fingerBase.y) {
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
    if (littleExtended && ringExtended) return "Motor 5";
    if (littleExtended && extendedFingers.length === 1) return "Motor 6";

    return "Unknown Gesture";
}

// ✅ Detect Right Hand Gestures (Direction Control)
function detectRightHandGesture(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return 1;
    }

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    if (!thumbTip || !indexTip || !thumbTip.x || !thumbTip.y || !indexTip.x || !indexTip.y) {
        return 1;
    }

    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    return distance < 0.1 ? 2 : 3;
}

// ✅ Start Everything After Page Loads
window.onload = async () => {
    await startCamera();
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

