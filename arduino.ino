#include <Servo.h>

// Servo configuration
Servo servos[5];
const int servoPins[] = {3, 5, 6, 9, 10};
int currentPos[] = {90, 90, 90, 90, 90};  // All start at center
int targetPos[] = {90, 90, 90, 90, 90};   // Target positions
const int stepSize = 1;                    // Smaller = smoother
const int stepDelay = 20;                  // Higher = slower

// Command mapping (A-O)
const char commandMap[5][3] = {
  {'A', 'B', 'C'},  // Servo 1 (Pin 3)
  {'A', 'D', 'E'},  // Servo 2 (Pin 5)
  {'A', 'F', 'G'},  // Servo 3 (Pin 6)
  {'A', 'H', 'I'},  // Servo 4 (Pin 9)
  {'A', 'J', 'K'}   // Servo 5 (Pin 10)
};

void setup() {
  Serial.begin(9600);
  
  // Attach all servos
  for (int i = 0; i < 5; i++) {
    servos[i].attach(servoPins[i]);
    servos[i].write(currentPos[i]);
  }

  Serial.println("READY. Commands:");
  Serial.println("Servo1: A=Stop, B=CW, C=CCW");
  Serial.println("Servo2: D=Stop, E=CW, F=CCW");
  Serial.println("Servo3: G=Stop, H=CW, I=CCW");
  Serial.println("Servo4: J=Stop, K=CW, L=CCW");
  Serial.println("Servo5: M=Stop, N=CW, O=CCW");
}

void loop() {
  // Process incoming commands
  if (Serial.available() > 0) {
    char cmd = toupper(Serial.read());
    processCommand(cmd);
  }

  // Smooth movement for all servos
  updateServos();
  delay(stepDelay);
}

void processCommand(char cmd) {
  for (int servoIdx = 0; servoIdx < 5; servoIdx++) {
    if (cmd == commandMap[servoIdx][0]) {  // Stop
      targetPos[servoIdx] = currentPos[servoIdx];
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": STOP");
    } 
    else if (cmd == commandMap[servoIdx][1]) {  // CW
      targetPos[servoIdx] = 180;
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": CW");
    } 
    else if (cmd == commandMap[servoIdx][2]) {  // CCW
      targetPos[servoIdx] = 0;
      Serial.print("Servo"); Serial.print(servoIdx+1); Serial.println(": CCW");
    }
  }
}

void updateServos() {
  for (int i = 0; i < 5; i++) {
    if (currentPos[i] < targetPos[i]) {
      currentPos[i] = min(currentPos[i] + stepSize, targetPos[i]);
    } 
    else if (currentPos[i] > targetPos[i]) {
      currentPos[i] = max(currentPos[i] - stepSize, targetPos[i]);
    }
    servos[i].write(currentPos[i]);
  }
}
