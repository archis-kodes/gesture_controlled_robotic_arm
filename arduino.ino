#include <Servo.h>

// Servo configuration
Servo servos[6];
const int servoPins[] = {3, 5, 6, 9, 10, 11};
int currentPos[] = {90, 90, 90, 90, 90};  // All start at center
int targetPos[] = {90, 90, 90, 90, 90};   // Target positions
const int stepSize = 1;                    // Smaller = smoother
const int stepDelay = 20;                  // Higher = slower

//******************************************************************************************
//-----------------------------------     FOR MG996R     -----------------------------------
//******************************************************************************************


// Pulse widths (microseconds)
const int FULL_CW = 1300;    // Full clockwise
const int FULL_CCW = 1700;   // Full counter-clockwise
const int STOP = 1500;       // Stop position
const int HALF_SPEED_CW = 1400;  // 50% CW speed
const int HALF_SPEED_CCW = 1600; // 50% CCW speed
const int DEFAULT_RUN_TIME = 1000; // ms to rotate 90°
const int BRAKE_DURATION = 200;    // ms of braking
const int BRAKE_STRENGTH = 100;    // µs offset for braking

// MG996R Control Variables
struct {
  bool active = false;
  int lastPulse = STOP;
  unsigned long startTime = 0;
  int runTime = 0;
  int targetPulse = STOP;
} servo6;

void stopServo() {
  servos[5].writeMicroseconds(STOP);
  servo6.lastPulse = STOP;
}

void activeBrake() {
  int currentPulse = servos[5].readMicroseconds();
  
  // Apply opposite pulse for braking
  if(currentPulse > STOP) {
    servos[5].writeMicroseconds(currentPulse - BRAKE_STRENGTH);
  } else {
    servos[5].writeMicroseconds(currentPulse + BRAKE_STRENGTH);
  }
  delay(BRAKE_DURATION);
  stopServo();
  servo6.lastPulse = servos[5].readMicroseconds(); // Save final position
} 

int calculateRunTime(int degrees) {
  return map(degrees, 0, 360, 0, DEFAULT_RUN_TIME * 4);
}

void startServo6Movement() {
  // Start from last known position
  servos[5].writeMicroseconds(servo6.lastPulse);
  delay(50); // Settling time
  
  // Begin movement
  servos[5].writeMicroseconds(servo6.targetPulse);
  servo6.startTime = millis();
  servo6.active = true;
}

// Command mapping (A-O)
const char commandMap[6][3] = {
  {'A', 'B', 'C'},  // Servo 1 (Pin 3)
  {'A', 'D', 'E'},  // Servo 2 (Pin 5)
  {'A', 'F', 'G'},  // Servo 3 (Pin 6)
  {'A', 'H', 'I'},  // Servo 4 (Pin 9)
  {'A', 'J', 'K'},  // Servo 5 (Pin 10)
  {'A', 'L', 'M'}   // Servo 6 (Pin 11)
};

void setup() {
  Serial.begin(9600);
  
  // Attach all servos
  for (int i = 0; i < 5; i++) {
    servos[i].attach(servoPins[i]);
    servos[i].write(currentPos[i]);
  }
  servos[5].attach(servoPins[5]);


  Serial.println("READY. Commands:");
  Serial.println("Servo1: A=Stop, B=CW, C=CCW");
  Serial.println("Servo2: D=Stop, E=CW, F=CCW");
  Serial.println("Servo3: G=Stop, H=CW, I=CCW");
  Serial.println("Servo4: J=Stop, K=CW, L=CCW");
  Serial.println("Servo5: M=Stop, N=CW, O=CCW");
}

void processCommand(char cmd) {
  // Immediately stop all servos
  for (int i = 0; i < 5; i++) {
    targetPos[i] = currentPos[i]; // Freeze regular servos
  }
  
  // Handle MG996R stop
  if (servo6.active) {
    activeBrake();
    servo6.active = false;
  }

  // Process command for specific servo
  for (int servoIdx = 0; servoIdx < 6; servoIdx++) {
    if (cmd == commandMap[servoIdx][1]) {  // CW command
      if (servoIdx == 5) { // MG996R
        servo6.targetPulse = HALF_SPEED_CW;
        servo6.runTime = calculateRunTime(280);
        startServo6Movement();
      } else {
        targetPos[servoIdx] = 180;
      }
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": CW");
    }
    else if (cmd == commandMap[servoIdx][2]) {  // CCW command
      if (servoIdx == 5) { // MG996R
        servo6.targetPulse = HALF_SPEED_CCW;
        servo6.runTime = calculateRunTime(280);
        startServo6Movement();
      } else {
        targetPos[servoIdx] = 0;
      }
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": CCW");
    }
    else if (cmd == commandMap[servoIdx][0]) {  // Stop
      if (servoIdx == 5) {
        stopServo();
      }
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": STOP");
    }
  }
}

void updateServos() {
  // Handle regular servos (1-5)
  for (int i = 0; i < 5; i++) {
    if (currentPos[i] < targetPos[i]) {
      currentPos[i] = min(currentPos[i] + stepSize, targetPos[i]);
    } 
    else if (currentPos[i] > targetPos[i]) {
      currentPos[i] = max(currentPos[i] - stepSize, targetPos[i]);
    }
    servos[i].write(currentPos[i]);
  }
  
  // Handle MG996R movement completion
  if (servo6.active && (millis() - servo6.startTime >= servo6.runTime)) {
    activeBrake();
    servo6.active = false;
  }
}

void loop() {
  // Check for new commands
  if (Serial.available() > 0) {
    char cmd = toupper(Serial.read());
    processCommand(cmd);
    // Clear any remaining serial buffer
    while (Serial.available()) Serial.read();
  }

  updateServos();
  delay(stepDelay);
}
