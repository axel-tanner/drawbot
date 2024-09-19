// Starting point https://editor.p5js.org/SableRaf/sketches/PNSk4uR9v

// Apple Pencil demo using Pressure.js

// Alternative method: https://github.com/quietshu/apple-pencil-safari-api-test

// If you want to go deeper into pointer events
// https://patrickhlauke.github.io/touch/
// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure

// TODO implement undo/redo
// TODO implement minimum distance before new point stored


/***********************
*       SETTINGS       *
************************/

// How sensitive is the brush size to the pressure of the pen?
var pressureMultiplier = 10; 

// What is the smallest size for the brush?
var minBrushSize = 1;

// Higher numbers give a smoother stroke
var brushDensity = 5;

var showDebug = true;

// Jitter smoothing parameters
// See: http://cristal.univ-lille.fr/~casiez/1euro/
var minCutoff = 0.0001; // decrease this to get rid of slow speed jitter but increase lag (must be > 0)
var beta      = 1.0;  // increase this to get rid of high speed lag

/***********************
*       GLOBALS        *
************************/
var xFilter, yFilter, pFilter;
var inBetween;
var prevPenX = 0;
var prevPenY = 0; 
var prevBrushSize = 1;
var amt, x, y, s, d;
var pressure = -2;
var drawCanvas, uiCanvas;
var isPressureInit = false;
var isDrawing = false;
var isDrawingJustStarted = false;

const canvasWidth  = 400;
const canvasHeight = 300;
const realWidth = 0.4;   // meter
const realHeight = 0.3;  // meter // TODO should keep aspect ratio of canvas ...
const zUp = 0.03; // meter - height when not drawing
const zDown = 0.0; // meter - height when drawing

var points = [];
var strokes = [];

function setup() {
    
  // Filters used to smooth position and pressure jitter
  xFilter = new OneEuroFilter(60, minCutoff, beta, 1.0);
  yFilter = new OneEuroFilter(60, minCutoff, beta, 1.0);
  pFilter = new OneEuroFilter(60, minCutoff, beta, 1.0);
  
  // prevent scrolling on iOS Safari
  disableScroll();
  
  //Initialize the canvas
  drawCanvas = createCanvas(canvasWidth, canvasHeight);
  drawCanvas.id("drawingCanvas");
  drawCanvas.position(0, 0);    
  
    // Create a button and place it beneath the canvas.
    let button = createButton('Click to save');
    button.position(0, canvasHeight);
  
    // Call repaint() when the button is pressed.
    button.mousePressed(save2file);

    rect(2, 2, canvasWidth-4, canvasHeight-4);

}

function save2file() {
  print("Saving to file ...");
  let writer = createWriter("drawing.script");
  // intro
  writer.write("def Print():\n");
  writer.write("  #set parameters\n");
  writer.write("  global rapid_ms = 0.25\n");
  writer.write("  global feed_ms = 0.01\n");
  writer.write("  global accel_mss = 0.25\n");
  writer.write("  global blend_radius_m = 0.005\n");
  writer.write("  global approach = 0.03\n");
  writer.write("  global feature = drawing_plane\n");

  writer.write("  movej([-1.26,-1.19,-2.39,-1.134,1.57,-1.26], rapid_ms, accel_mss, 0, 0)\n");
  writer.write("  sleep(1)\n");
  
  // write strokes
  for (let i = 0; i < strokes.length; i = i + 1) {
    points = strokes[i];

    // move to first point with zUp
    pCanvas = points[0];
    pReal = convert(pCanvas);
    writer.write(`  movel(pose_trans(feature, p[${pReal[0]}, ${pReal[1]}, ${zUp},0,0,0]), accel_mss, v=rapid_ms, t=0, r=blend_radius_m)\n`);

    for (let j = 0; j < points.length; j = j + 1) {
      pCanvas = points[j];
      pReal = convert(pCanvas);
      writer.write(`  movel(pose_trans(feature, p[${pReal[0]}, ${pReal[1]}, ${zDown},0,0,0]), accel_mss, v=rapid_ms, t=0, r=blend_radius_m)\n`);
    }

    // move to last point with zUp
    pCanvas = points[points.length-1];
    pReal = convert(pCanvas);
    writer.write(`  movel(pose_trans(feature, p[${pReal[0]}, ${pReal[1]}, ${zUp},0,0,0]), accel_mss, v=rapid_ms, t=0, r=blend_radius_m)\n`);

  }
  // outro
  writer.write("  sleep(1)\n");
  writer.write("  movej([-1.26,-1.19,-2.39,-1.134,1.57,-1.26], rapid_ms, accel_mss, 0, 0)\n");
  writer.write("end\n");
  writer.write("Print()\n");
  
  writer.close();
  print("... finished");
}

function draw() {
    
  // Start Pressure.js if it hasn't started already
  if(isPressureInit == false){
    initPressure();
  }
    
  
  if(isDrawing) {      
    // Smooth out the position of the pointer 
    penX = xFilter.filter(mouseX, millis());
    penY = yFilter.filter(mouseY, millis());
    
    // What to do on the first frame of the stroke
    if(isDrawingJustStarted) {
      //console.log("started drawing");
      prevPenX = penX;
      prevPenY = penY;
    }

    // Smooth out the pressure
    pressure = pFilter.filter(pressure, millis());

    // Define the current brush size based on the pressure
    brushSize = minBrushSize + (pressure * pressureMultiplier);

    // Calculate the distance between previous and current position
    d = dist(prevPenX, prevPenY, penX, penY);

    // The bigger the distance the more ellipses
    // will be drawn to fill in the empty space
    inBetween = (d / min(brushSize,prevBrushSize)) * brushDensity;

    // Add ellipses to fill in the space 
    // between samples of the pen position
    for(i=1;i<=inBetween;i++){
      amt = i/inBetween;
      s = lerp(prevBrushSize, brushSize, amt);
      x = lerp(prevPenX, penX, amt);
      y = lerp(prevPenY, penY, amt);
      noStroke();
      fill(100)
      ellipse(x, y, s);      
    }

    // Draw an ellipse at the latest position
    noStroke();
    fill(100,0,0);
    ellipse(penX, penY, brushSize);
    points.push([penX, penY])
    fill(100);

    // Save the latest brush values for next frame
    prevBrushSize = brushSize; 
    prevPenX = penX;
    prevPenY = penY;
    
    isDrawingJustStarted = false;
  } else {
    if (points.length > 0) {
      strokes.push(points);
      points = [];
    }
  }
  
}


/***********************
*       UTILITIES      *
************************/

function convert(p) {
  prx = round(p[0] / canvasWidth * realWidth, 5);
  pry = round(p[1] / canvasHeight * realHeight, 5);
  return [prx, pry];
}

// Initializing Pressure.js
// https://pressurejs.com/documentation.html
function initPressure() {
  
  	// console.log("Attempting to initialize Pressure.js ");
  
    Pressure.set('#drawingCanvas', {
      
      start: function(event){
        // this is called on force start
        isDrawing = true;
        isDrawingJustStarted = true;
  		},
      end: function(){
    		// this is called on force end
        isDrawing = false
        pressure = 0;
  		},
      change: function(force, event) {
        if (isPressureInit == false){
          console.log("Pressure.js initialized successfully");
	        isPressureInit = true;
      	}
        //console.log(force);
        pressure = force;
        
      }
    });
  
    Pressure.config({
      polyfill: true, // use time-based fallback ?
      polyfillSpeedUp: 1000, // how long does the fallback take to reach full pressure
      polyfillSpeedDown: 300,
      preventSelect: true,
      only: null
 		 });
  
}

// Disabling scrolling and bouncing on iOS Safari
// https://stackoverflow.com/questions/7768269/ipad-safari-disable-scrolling-and-bounce-effect

function preventDefault(e){
    e.preventDefault();
}

function disableScroll(){
    document.body.addEventListener('touchmove', preventDefault, { passive: false });
}
/*
function enableScroll(){
    document.body.removeEventListener('touchmove', preventDefault, { passive: false });
}*/