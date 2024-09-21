// Starting point https://editor.p5js.org/SableRaf/sketches/PNSk4uR9v

// Apple Pencil demo using Pressure.js

// Alternative method: https://github.com/quietshu/apple-pencil-safari-api-test

// If you want to go deeper into pointer events
// https://patrickhlauke.github.io/touch/
// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure

// done - keep also pressure
// done - create a redraw function
// done - implement undo/redo
// done - tune the epsilon parameter for douglas-peucker ...
// done - implement minimum distance before new point stored - use douglas-peucker ... use actually these during saving
// TODO get rid of trailing points when mouse is not pressed anymore / maybe try first on tablet


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

const canvasWidth  = 800;
const canvasHeight = 600;
const realWidth = 0.4;   // meter
const realHeight = realWidth / canvasWidth * canvasHeight;  // meter - keeping aspect ratio of canvas ...
const zUp = 0.03; // meter - height when not drawing
const zDown = 0.0; // meter - height when drawing

const epsilon = 2.0;

var points = [];
var strokes = [];
var deletedStrokes = [];

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
  
  let buttonSave = createButton('Click to save');
  buttonSave.position(0, canvasHeight);
  buttonSave.mousePressed(save2file);

  let buttonRedraw = createButton('Redraw');
  buttonRedraw.position(100, canvasHeight);
  buttonRedraw.mousePressed(redrawCanvas);

  let buttonUndo = createButton('Undo');
  buttonUndo.position(200, canvasHeight);
  buttonUndo.mousePressed(undo);

  let buttonRedo = createButton('Redo');
  buttonRedo.position(250, canvasHeight);
  buttonRedo.mousePressed(redo);

  rect(2, 2, canvasWidth-4, canvasHeight-4);
}

function redrawCanvas() { 
  print("in redrawCanvas"); 
  fill(255);
  rect(2, 2, canvasWidth-4, canvasHeight-4);
  fill(100,0,0);
  for (let i = 0; i < strokes.length; i = i + 1) {
    pts = strokes[i];
    prevPenX = pts[0][0];
    prevPenY = pts[0][1];
    prevBrushSize =  minBrushSize + (pts[0][2] * pressureMultiplier);
    for (let j = 0; j < pts.length; j = j + 1) {
      p = pts[j];
      penX = p[0];
      penY = p[1];
      pressure = p[2];
      brushSize = minBrushSize + (pressure * pressureMultiplier);

      drawLine(prevPenX, prevPenY, prevBrushSize, penX, penY, brushSize);

      // Save the latest brush values for next frame
      prevBrushSize = brushSize;
      prevPenX = penX;
      prevPenY = penY;

      ellipse(penX, penY, brushSize);
    }

    // test rdpCalculation
    // consider pressure values simply as 3rd dimension of vectors to keep them ...
    rdpPoints = simplifyPoints(pts);
    for (let j = 0; j < rdpPoints.length; j = j + 1) {
      noFill();
      stroke(0, 255, 0);
      brushSize = minBrushSize + (rdpPoints[j][2] * pressureMultiplier);
      ellipse(rdpPoints[j][0], rdpPoints[j][1], 2 * brushSize);
    }
    print(`redraw: orig stroke ${ptsXYp.length} vs rdp ${rdpPoints.length}`);
  }
}

function undo() {
  print("in undo");
  if (strokes.length > 0) {
    deleted = strokes.pop();
    deletedStrokes.push(deleted);
    redrawCanvas();
  }
}

function redo() {
  print("in redo");
  if (deletedStrokes.length > 0) {
    last = deletedStrokes.pop();
    strokes.push(last);
    redrawCanvas();
  }
}

// --- douglas-peucker reduction ---------
function rgp(pts = [], epsilon = 0.1) {
  const p1 = pts[0];
  const p2 = pts[pts.length - 1];
  const { index, dist } = furthestPoint(p1, p2, pts);
  if (dist > epsilon) {
    return [...rgp(pts.slice(0, index + 1), epsilon), ...rgp(pts.slice(index).slice(1), epsilon)];
  } else {
    return p1 == p2 ? [p1] : [p1, p2];
  }
}

function furthestPoint(p1, p2, pts) {
  let dmax = 0;
  let maxI = -1;
  for (let i = 0; i < pts.length; i++) {
    const dtemp = perpendicularDist(pts[i], p1, p2);
    if (dtemp > dmax) {
      dmax = dtemp;
      maxI = i;
    }
  }
  return { index: maxI, dist: dmax };
}

function perpendicularDist(p, p1, p2) {
  if (p1 == p || p == p2) return 0;
  const a = p.copy().sub(p1);
  const b = p.copy().sub(p2);
  const c = a.cross(b).mag();
  const d = p2.copy().sub(p1).mag();
  return c / d;
}
// ----------------------------------------

function simplifyStrokes() {
  strokesSimplified = [];
  for (let i = 0; i < strokes.length; i = i + 1) {
    pts = strokes[i];
    rdp = simplifyPoints(pts);
    strokesSimplified.push(rdp);
  }
  return strokesSimplified;
}

function simplifyPoints(pts = []) {
  // convert to p5.Vectors for the algorithm
  ptsXYp = [];
  for (let j = 0; j < pts.length; j = j + 1) {
    ptsXYp.push(createVector(pts[j][0], pts[j][1], pts[j][2]));
  }
  rdpPoints = rgp(ptsXYp, epsilon);

  // convert back to arrays again
  rdp = []
  for (let j = 0; j < rdpPoints.length; j = j + 1) {
    rdp.push(rdpPoints[j].array());
  }
  return rdp;
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
  
  // simplify strokes first
  strokesSimplified = simplifyStrokes(strokes);
  // write strokes
  for (let i = 0; i < strokesSimplified.length; i = i + 1) {
    pts = strokesSimplified[i];

    // move to first point with zUp
    pCanvas = pts[0];
    pReal = convert(pCanvas);
    writer.write(`  movel(pose_trans(feature, p[${pReal[0]}, ${pReal[1]}, ${zUp},0,0,0]), accel_mss, v=rapid_ms, t=0, r=blend_radius_m)\n`);

    for (let j = 0; j < pts.length; j = j + 1) {
      pCanvas = pts[j];
      pReal = convert(pCanvas);
      writer.write(`  movel(pose_trans(feature, p[${pReal[0]}, ${pReal[1]}, ${zDown},0,0,0]), accel_mss, v=rapid_ms, t=0, r=blend_radius_m)\n`);
    }

    // move to last point with zUp
    pCanvas = pts[pts.length-1];
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
    drawLine(prevPenX, prevPenY, prevBrushSize, penX, penY, brushSize);
    points.push([penX, penY, pressure]);

    // Save the latest brush values for next frame
    prevBrushSize = brushSize;
    prevPenX = penX;
    prevPenY = penY;
    
    isDrawingJustStarted = false;
  } else {
    if (points.length > 0) {
      strokes.push(points);
      points = [];
      // clear history of strokes
      deletedStrokes = [];
    }
  }
}

function drawLine(prevPenX, prevPenY, prevBrushSize, penX, penY, brushSize) {
  d = dist(prevPenX, prevPenY, penX, penY);

  fill(100, 100, 100, 25);

  // The bigger the distance the more ellipses
  // will be drawn to fill in the empty space
  inBetween = (d / min(brushSize, prevBrushSize)) * brushDensity;

  // Add ellipses to fill in the space 
  // between samples of the pen position
  for (i = 1; i <= inBetween; i++) {
    amt = i / inBetween;
    s = lerp(prevBrushSize, brushSize, amt);
    x = lerp(prevPenX, penX, amt);
    y = lerp(prevPenY, penY, amt);
    noStroke();
    ellipse(x, y, s);
  }

  // Draw an ellipse at the latest position
  noStroke();
  fill(100, 0, 0);
  ellipse(penX, penY, brushSize);
  stroke(100,0,0);
  line(prevPenX, prevPenY, penX, penY);
  noStroke();
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