// Get the video element from HTML where webcam feed will be shown
const video = document.getElementById('webcam');

// Get the canvas element where we'll draw hand landmarks
const outputCanvas = document.getElementById('output');

// Get drawing context for the canvas (lets us draw on it)
const ctx = outputCanvas.getContext('2d');

// Get elements where we'll display detected gestures
const rightHandGestureElement = document.getElementById('rightHandGesture');
const leftHandGestureElement = document.getElementById('leftHandGesture');

// Connect to server using socket.io (Ngrok tunnel for localhost testing)
const socket = io("https://d05d-202-8-116-205.ngrok-free.app");

// Variables to store previous gestures to avoid duplicate commands
let previousRightHandGesture = null;  // Stores last right hand gesture
let previousLeftHandGesture = null;   // Stores last left hand gesture
let previousCommand = null;          // Stores last sent command

// Function to start camera with error handling
async function startCamera() {
    try {
        // Request camera access from user
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Set the video source to our camera stream
        video.srcObject = stream;
        
        // Play the video
        video.play();
        
        // Log success message
        console.log("Camera started successfully");
    } catch (err) {
        // Handle errors (like permission denied)
        console.error("Error accessing webcam:", err);
        alert("Failed to access webcam. Please check camera permissions and try again.");
    }
}

// Initialize MediaPipe Hands model
const hands = new Hands({
    // Tell MediaPipe where to find its model files
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// Configure MediaPipe Hands settings
hands.setOptions({
    maxNumHands: 2,          // Detect maximum 2 hands
    modelComplexity: 1,       // Balance between speed and accuracy
    minDetectionConfidence: 0.5,  // Minimum confidence to consider detection valid
    minTrackingConfidence: 0.5    // Minimum confidence to keep tracking a hand
});

// This runs every time MediaPipe detects hand results
hands.onResults((results) => {
    // Clear the canvas for fresh drawing
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    
    // Draw the camera image on canvas
    ctx.drawImage(results.image, 0, 0, outputCanvas.width, outputCanvas.height);

    // Default values when no hands detected
    let rightHandGesture = 1;  // 1 = No gesture, 2 = Clockwise, 3 = Anti-clockwise
    let leftHandGesture = "No Gesture Detected";
    let currentCommand = "A";  // Default command

    // Check if any hands were detected
    if (results.multiHandLandmarks) {
        // Loop through all detected hands (max 2)
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            // Get the landmarks (21 points) for this hand
            const landmarks = results.multiHandLandmarks[i];
            
            // Check if it's left or right hand
            const handedness = results.multiHandedness[i].label;

            // Draw the landmarks (red dots) and connections (green lines)
            drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });

            // Detect gestures based on which hand it is
            if (handedness === "Left") {
                leftHandGesture = detectLeftHandGesture(landmarks);
            } else {
                rightHandGesture = detectRightHandGesture(landmarks);
            }
        }
    }

    // Determine command based on gesture combinations:
    // Right hand controls direction, left hand selects motor
    if (rightHandGesture === 1) {
        currentCommand = "A";  // Default when no right hand gesture
    } else if (leftHandGesture === "Motor 1") {
        currentCommand = rightHandGesture === 2 ? "B" : "C";  // B=Clockwise, C=Anti-clockwise
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
        currentCommand = "A";  // Default for any other combination
    }

    // Update the HTML to show current gestures
    rightHandGestureElement.textContent = `Right Hand: ${rightHandGesture === 1 ? "No Gesture" : rightHandGesture === 2 ? "Clockwise" : "Anti-clockwise"}`;
    leftHandGestureElement.textContent = `Left Hand: ${leftHandGesture}`;

    // Only send command if it's different from previous command
    if (currentCommand !== previousCommand) {
        // Send command to server via socket.io
        socket.emit('update_gesture', {
            command: currentCommand
        });
        
        console.log('Sending new command:', currentCommand);
        previousCommand = currentCommand;  // Remember this command
        
        // Update previous gestures for future comparison
        previousRightHandGesture = rightHandGesture;
        previousLeftHandGesture = leftHandGesture;
    }
});

// Listen for servo angle updates from server
socket.on('servo_update', (angles) => {
    console.log("Servo Angles Updated:", angles);
});

// Listen for responses from server
socket.on('uart_response', (response) => {
    console.log("Server response:", response);
});

// Listen for errors from server
socket.on('error', (error) => {
    console.error("Server Error:", error.message);
});

// Function to detect left hand gestures (motor selection)
function detectLeftHandGesture(landmarks) {
    // Return if no landmarks provided
    if (!landmarks || landmarks.length === 0) {
        return "No Gesture Detected";
    }

    // Finger tip landmarks (index, middle, ring, little)
    const fingers = [8, 12, 16, 20];
    let extendedFingers = [];  // Array to store which fingers are extended

    // Check each finger to see if it's extended
    for (let i = 0; i < fingers.length; i++) {
        // Get tip and base joints of finger
        const fingertip = landmarks[fingers[i]];
        const fingerBase = landmarks[fingers[i] - 2];

        // Skip if we couldn't get the positions
        if (!fingertip || !fingerBase || !fingertip.y || !fingerBase.y) {
            continue;
        }

        // If tip is above base (on screen), finger is extended
        if (fingertip.y < fingerBase.y) {
            extendedFingers.push(fingers[i]);
        }
    }

    // Check specific finger combinations:
    const littleExtended = extendedFingers.includes(20);
    const ringExtended = extendedFingers.includes(16);
    const indexExtended = extendedFingers.includes(8);

    // Return different motor commands based on finger combinations
    if (extendedFingers.length === 0) return "Fist (Do Nothing)";
    if (extendedFingers.length === 1 && indexExtended) return "Motor 1";
    if (extendedFingers.length === 2 && extendedFingers.includes(12)) return "Motor 2";
    if (extendedFingers.length === 3 && extendedFingers.includes(16)) return "Motor 3";
    if (extendedFingers.length === 4 && extendedFingers.includes(20)) return "Motor 4";
    if (littleExtended && ringExtended) return "Motor 5";
    if (littleExtended && extendedFingers.length === 1) return "Motor 6";

    return "Unknown Gesture";
}

// Function to detect right hand gestures (direction control)
function detectRightHandGesture(landmarks) {
    // Return default if no landmarks
    if (!landmarks || landmarks.length === 0) {
        return 1;
    }

    // Get thumb and index finger tips
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // Return default if positions not available
    if (!thumbTip || !indexTip || !thumbTip.x || !thumbTip.y || !indexTip.x || !indexTip.y) {
        return 1;
    }

    // Calculate distance between thumb and index finger tips
    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    
    // If distance is small, fingers are touching (clockwise), else anti-clockwise
    return distance < 0.1 ? 2 : 3;
}

// When page loads, initialize everything
window.onload = async () => {
    // Start camera
    await startCamera();
    console.log("Initializing MediaPipe Hands...");

    // Set up camera processing with MediaPipe
    const camera = new Camera(video, {
        // Function called for each video frame
        onFrame: async () => {
            // Send each frame to MediaPipe for hand detection
            await hands.send({ image: video });
        },
        width: 720,   // Processing width
        height: 540   // Processing height
    });
    
    // Start processing frames
    camera.start();
    console.log("MediaPipe Hands initialized successfully");
};
