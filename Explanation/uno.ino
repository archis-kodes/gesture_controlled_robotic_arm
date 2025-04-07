// Include the Servo library
#include <Servo.h>

// Servo configuration
Servo servos[6];  // Array to control 6 servos
const int servoPins[] = {3, 5, 6, 9, 10, 11};  // Digital pins connected to servos
int currentPos[] = {90, 90, 90, 90, 90};  // Current positions (0-180°) for servos 1-5
int targetPos[] = {90, 90, 90, 90, 90};   // Target positions for servos 1-5
const int stepSize = 1;     // How much to move each servo per update (smaller = smoother)
const int stepDelay = 20;   // Delay between movements in milliseconds (higher = slower)

//******************************************************************************************
// Special configuration for MG996R servo (typically more powerful/continuous rotation)
//******************************************************************************************

// Pulse width settings in microseconds (specific to MG996R servo)
const int FULL_CW = 1300;    // Full clockwise rotation pulse width
const int FULL_CCW = 1700;   // Full counter-clockwise rotation pulse width
const int STOP = 1500;       // Stop position pulse width
const int HALF_SPEED_CW = 1400;  // 50% speed clockwise
const int HALF_SPEED_CCW = 1600; // 50% speed counter-clockwise
const int DEFAULT_RUN_TIME = 1000; // Default time (ms) to rotate 90°
const int BRAKE_DURATION = 200;    // How long to brake (ms)
const int BRAKE_STRENGTH = 100;    // How strong to brake (microseconds offset)

// Structure to track MG996R (servo 6) state
struct {
  bool active = false;       // Is servo currently moving?
  int lastPulse = STOP;      // Last pulse width sent
  unsigned long startTime = 0; // When movement started
  int runTime = 0;           // How long to run (ms)
  int targetPulse = STOP;    // Target pulse width
} servo6;

// Stop servo 6 (MG996R)
void stopServo() {
  servos[5].writeMicroseconds(STOP);  // Send stop pulse
  servo6.lastPulse = STOP;            // Update last pulse
}

// Active braking for servo 6
void activeBrake() {
  int currentPulse = servos[5].readMicroseconds();
  
  // Apply opposite pulse briefly to brake
  if(currentPulse > STOP) {
    servos[5].writeMicroseconds(currentPulse - BRAKE_STRENGTH);
  } else {
    servos[5].writeMicroseconds(currentPulse + BRAKE_STRENGTH);
  }
  delay(BRAKE_DURATION);  // Hold brake
  stopServo();            // Then stop
  servo6.lastPulse = servos[5].readMicroseconds(); // Save final position
} 

// Calculate run time based on desired rotation
int calculateRunTime(int degrees) {
  return map(degrees, 0, 360, 0, DEFAULT_RUN_TIME * 4);
}

// Start movement for servo 6
void startServo6Movement() {
  // Start from last known position
  servos[5].writeMicroseconds(servo6.lastPulse);
  delay(50); // Small delay to settle
  
  // Begin movement to target pulse width
  servos[5].writeMicroseconds(servo6.targetPulse);
  servo6.startTime = millis();  // Record start time
  servo6.active = true;         // Flag as active
}

// Command mapping (letters A-M control different servos/directions)
const char commandMap[6][3] = {
  {'A', 'B', 'C'},  // Servo 1 commands (Pin 3)
  {'A', 'D', 'E'},  // Servo 2 commands (Pin 5)
  {'A', 'F', 'G'},  // Servo 3 commands (Pin 6)
  {'A', 'H', 'I'},  // Servo 4 commands (Pin 9)
  {'A', 'J', 'K'},  // Servo 5 commands (Pin 10)
  {'A', 'L', 'M'}   // Servo 6 commands (Pin 11)
};

void setup() {
  Serial.begin(9600);  // Start serial communication
  
  // Attach all servos to their pins
  for (int i = 0; i < 5; i++) {
    servos[i].attach(servoPins[i]);
    servos[i].write(currentPos[i]);  // Initialize to center position
  }
  servos[5].attach(servoPins[5]);  // Special attach for servo 6

  // Print command help to serial monitor
  Serial.println("READY. Commands:");
  Serial.println("Servo1: A=Stop, B=CW, C=CCW");
  Serial.println("Servo2: D=Stop, E=CW, F=CCW");
  Serial.println("Servo3: G=Stop, H=CW, I=CCW");
  Serial.println("Servo4: J=Stop, K=CW, L=CCW");
  Serial.println("Servo5: M=Stop, N=CW, O=CCW");
}

void processCommand(char cmd) {
  // First stop all servos when new command arrives
  for (int i = 0; i < 5; i++) {
    targetPos[i] = currentPos[i]; // Freeze regular servos
  }
  
  // Handle MG996R stop if moving
  if (servo6.active) {
    activeBrake();
    servo6.active = false;
  }

  // Process command for each possible servo
  for (int servoIdx = 0; servoIdx < 6; servoIdx++) {
    if (cmd == commandMap[servoIdx][1]) {  // CW (Clockwise) command
      if (servoIdx == 5) { // Special handling for MG996R (servo 6)
        servo6.targetPulse = HALF_SPEED_CW;
        servo6.runTime = calculateRunTime(280);
        startServo6Movement();
      } else {
        targetPos[servoIdx] = 180;  // Set target to CW position
      }
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": CW");
    }
    else if (cmd == commandMap[servoIdx][2]) {  // CCW (Counter-Clockwise) command
      if (servoIdx == 5) { // Special handling for MG996R
        servo6.targetPulse = HALF_SPEED_CCW;
        servo6.runTime = calculateRunTime(280);
        startServo6Movement();
      } else {
        targetPos[servoIdx] = 0;  // Set target to CCW position
      }
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": CCW");
    }
    else if (cmd == commandMap[servoIdx][0]) {  // Stop command
      if (servoIdx == 5) {
        stopServo();
      }
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": STOP");
    }
  }
}

void updateServos() {
  // Update regular servos (1-5) with smooth movement
  for (int i = 0; i < 5; i++) {
    if (currentPos[i] < targetPos[i]) {
      currentPos[i] = min(currentPos[i] + stepSize, targetPos[i]); // Move up
    } 
    else if (currentPos[i] > targetPos[i]) {
      currentPos[i] = max(currentPos[i] - stepSize, targetPos[i]); // Move down
    }
    servos[i].write(currentPos[i]); // Send position to servo
  }
  
  // Check if MG996R movement time has elapsed
  if (servo6.active && (millis() - servo6.startTime >= servo6.runTime)) {
    activeBrake();  // Stop with braking
    servo6.active = false; // Mark as inactive
  }
}

void loop() {
  // Check for incoming serial commands
  if (Serial.available() > 0) {
    char cmd = toupper(Serial.read()); // Read and uppercase command
    processCommand(cmd); // Process the command
    // Clear any extra characters in buffer
    while (Serial.available()) Serial.read();
  }

  updateServos(); // Update all servo positions
  delay(stepDelay); // Control movement speed
}
