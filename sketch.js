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
// TODO - pressure to z value - test
// done - get rid of trailing points when mouse is not pressed anymore -> polyfillSpeedDown value
// TODO - why cannot press buttons with pencil? preventSelect?
// TODO - prevent touching with hand on canvas? probably would prevent mouse on screen too ...
// done - 'spiegelverkehrt'
// TODO - canvas smaller?
// TODO - fix page on safari somehow?
// TODO - sometimes pressures doesn't seem to release - provoke by moving from outside
// done - clear button
// done - stronger effect of brush pressure on screen


/***********************
*       SETTINGS       *
************************/

// How sensitive is the brush size to the pressure of the pen?
var pressureMultiplier = 15; 

// What is the smallest size for the brush?
var minBrushSize = 1;

// Higher numbers give a smoother stroke
var brushDensity = 10;

var showDebug = true;

// Jitter smoothing parameters
// See: http://cristal.univ-lille.fr/~casiez/1euro/
var minCutoff = 0.0000001; // decrease this to get rid of slow speed jitter but increase lag (must be > 0)
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

const canvasWidth  = 900;   // ipad 12,9 3rd generation has 1024 × 1366 px
const canvasHeight = 600;
const realWidth = 0.4;   // meter
const realHeight = realWidth / canvasWidth * canvasHeight;  // meter - keeping aspect ratio of canvas ...
const zUp = 0.02; // meter - height when not drawing
const zDown = 0.0; // meter - height when drawing
const zPressureRange = 0.005; // meter - change in z from 0 to full pressure = 1 (which is hard to reach ... 0.5 is more realistic)

const fontSize = '20px';

const epsilon = 1.1;

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
  
  let buttonSave = createButton('Save');
  buttonSave.position(0, canvasHeight);
  buttonSave.mousePressed(save2file);
  // buttonSave.size(200, 100);
  buttonSave.style('font-size', fontSize);
  // buttonSave.style('background-color', '#f0cece');
  
  let buttonClear = createButton('Clear');
  buttonClear.position(170, canvasHeight);
  buttonClear.mousePressed(clearAll);
  buttonClear.style('font-size', fontSize);

  if (showDebug) {
    let buttonRedraw = createButton('Redraw');
    buttonRedraw.position(310, canvasHeight);
    buttonRedraw.mousePressed(redrawCanvas);
    buttonRedraw.style('font-size', fontSize);
  }

  let buttonUndo = createButton('Undo');
  buttonUndo.position(440, canvasHeight);
  buttonUndo.mousePressed(undo);
  buttonUndo.style('font-size', fontSize);

  let buttonRedo = createButton('Redo');
  buttonRedo.position(540, canvasHeight);
  buttonRedo.mousePressed(redo);
  buttonRedo.style('font-size', fontSize);

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

    if (showDebug) {
      // show rdpCalculation
      // consider pressure values simply as 3rd dimension of vectors to keep them ...
      rdpPoints = simplifyPoints(pts);
      prevPenX = rdpPoints[0][0];
      prevPenY = rdpPoints[0][1];
      prevBrushSize =  minBrushSize + (rdpPoints[0][2] * pressureMultiplier);
      for (let j = 0; j < rdpPoints.length; j = j + 1) {
        p = rdpPoints[j];
        penX = p[0];
        penY = p[1];
        pressure = p[2];
        noFill();
        stroke(0, 255, 0);
        brushSize = minBrushSize + (rdpPoints[j][2] * pressureMultiplier);
        ellipse(rdpPoints[j][0], rdpPoints[j][1], 2 * brushSize);
        fill(0, 140, 0);
        drawLine(prevPenX, prevPenY, 2*prevBrushSize, penX, penY, 2*brushSize, rdp=true);
        prevBrushSize = brushSize;
        prevPenX = penX;
        prevPenY = penY;
      }
      print(`redraw: orig stroke ${ptsXYp.length} vs rdp ${rdpPoints.length}`);
    }
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

function clearAll() {
  print("in clearAll");
  len = strokes.length;
  for (let i = 0; i < len; i = i + 1) {
    s = strokes.pop();
    deletedStrokes.push(s);
  }
  redrawCanvas();
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
  rdpline = []
  for (let j = 0; j < rdpPoints.length; j = j + 1) {
    rdpline.push(rdpPoints[j].array());
  }
  return rdpline;
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
  writer.write("  global blend_radius_m = 0.0002\n");
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
      writer.write(`  movel(pose_trans(feature, p[${pReal[0]}, ${pReal[1]}, ${round(zDown - pReal[2]*zPressureRange, 5)},0,0,0]), accel_mss, v=rapid_ms, t=0, r=blend_radius_m)\n`);
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
    // what to do about outside points ...
    if (penX < 0 || penX > canvasWidth-1 || penY < 0 || penY > canvasHeight-1) {
      return;
    }
    
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
      // clear history of strokes
      deletedStrokes = [];
    }
    points = [];
  }
}

function drawLine(prevPenX, prevPenY, prevBrushSize, penX, penY, brushSize, rdp=false) {
  d = dist(prevPenX, prevPenY, penX, penY);

  if (showDebug) {
    fill(100, 100, 100, 25);
  }
  if (rdp) {
    fill(0, 140, 0, 100, 25);
  }

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
  prx = round((canvasWidth - p[0]) / canvasWidth * realWidth, 5);
  pry = round(p[1] / canvasHeight * realHeight, 5);
  prz = p[2]; // this is the pressure
  return [prx, pry, prz];
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
      polyfillSpeedDown: 0,
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

// var xStart, yStart = 0; 

// document.addEventListener('touchstart', function(e) {
//     xStart = e.touches[0].screenX;
//     yStart = e.touches[0].screenY;
// }); 

// document.addEventListener('touchmove', function(e) {
//     var xMovement = Math.abs(e.touches[0].screenX - xStart);
//     var yMovement = Math.abs(e.touches[0].screenY - yStart);
//     if((yMovement * 3) > xMovement) {
//         e.preventDefault();
//     }
// });