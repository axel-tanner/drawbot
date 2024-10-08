// Starting point https://editor.p5js.org/SableRaf/sketches/PNSk4uR9v

// update handled by 'auto time stamp' extension
time_saved =  "Last modified: 2024-09-29T12:18:46"

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
// done - pressure to z value - test
// done - get rid of trailing points when mouse is not pressed anymore -> polyfillSpeedDown value
// done - why cannot press buttons with pencil? preventSelect? - just accept this
// done - detect iPad and only take event.pointerType = 'pen'
// done - 'spiegelverkehrt'
// done - canvas size?
// done - fix page on safari somehow?
// done - sometimes pressures doesn't seem to release - provoke by moving from outside
// done - clear button
// done - stronger effect of brush pressure on screen
// done - do some smoothing?
// done - test the oneeurofiltering


/***********************
*       SETTINGS       *
************************/

// How sensitive is the brush size to the pressure of the pen?
var pressureMultiplier = 12; 

// What is the smallest size for the brush?
var minBrushSize = 1;

// Higher numbers give a smoother stroke
var brushDensity = 10;

var showDebug = true;

// Jitter smoothing parameters
// See: http://cristal.univ-lille.fr/~casiez/1euro/
var minCutoff = 0.00001; // decrease this to get rid of slow speed jitter but increase lag (must be > 0)
var beta      = 1.0;  // increase this to get rid of high speed lag

const pointLimit = 2000; // worked also w 3000 at some point - not sure about the real limit

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

const canvasWidthIpad  = 1366;   // ipad 12,9 3rd generation has 1024 × 1366 px
const canvasHeightIpad = 890;
var height = document.body.clientHeight;
var width = document.body.clientWidth;
var canvasHeight;
var canvasWidth;
if (width < canvasWidthIpad) {
  canvasWidth = width;
} else {
  canvasWidth = canvasWidthIpad;
}
if (height < canvasHeightIpad) {
  canvasHeight = height - 100;
} else {
  canvasHeight = canvasHeightIpad;
}

const realWidth = 0.6;   // meter
const scaleCanvas2Real = realWidth / canvasWidth;
const realHeight = scaleCanvas2Real * canvasHeight;  // meter - keeping aspect ratio of canvas ...
const zUp = 0.015; // meter - height when not drawing
const zDown = 0.0; // meter - height when drawing
const zPressureRange = 0.002; // meter - change in z from 0 to full pressure = 1 (which is hard to reach ... 0.5 is more realistic)

const fontSize = '20px';

const epsilon = 0.8;

const isIpad = navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && navigator.platform == 'MacIntel';

var points = [];
var strokes = [];
var deletedStrokes = [];
var buttonRedraw;
var countPoints = 0;
// var sliderMC;
// var sliderBeta;
var pcount;

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
  buttonSave.position(40, canvasHeight);
  buttonSave.mousePressed(save2file);
  buttonSave.style('font-size', fontSize);
  
  let buttonClear = createButton('Clear');
  buttonClear.position(170, canvasHeight);
  buttonClear.mousePressed(clearAll);
  buttonClear.style('font-size', fontSize);

  buttonRedraw = createButton('Redraw');
  buttonRedraw.position(310, canvasHeight);
  buttonRedraw.mousePressed(redrawCanvas);
  buttonRedraw.style('font-size', fontSize);

  let buttonDbg = createButton('o');
  buttonDbg.position(0, canvasHeight);
  buttonDbg.mousePressed(toggleDebug);
  buttonDbg.style('font-size', fontSize/2);


  let buttonUndo = createButton('Undo');
  buttonUndo.position(440, canvasHeight);
  buttonUndo.mousePressed(undo);
  buttonUndo.style('font-size', fontSize);

  ua = window.navigator.userAgent;
  let buttonRedo = createButton('Redo');
  buttonRedo.position(540, canvasHeight);
  buttonRedo.mousePressed(redo);
  buttonRedo.style('font-size', fontSize);

  ts = createElement('div', time_saved.replace('Last modified: ', 'v') + ' ' + navigator.maxTouchPoints + ' ' + navigator.platform + ' ' + isIpad);
  ts.position(80, canvasHeight + 35);
  ts.style('font-size', '10pt');
  ts.style('font-family', 'sans-serif');

  pcount = createElement('div', countPoints + ' pts');
  pcount.position(20, canvasHeight + 35);
  pcount.style('font-size', '10pt');
  pcount.style('font-family', 'sans-serif');

  rect(2, 2, canvasWidth-4, canvasHeight-4);

  // sliderMC = createSlider(0, 10, minCutoff, 0);
  // sliderMC.position(650, canvasHeight+5);
  // sliderMC.size(80);

  // sliderBeta = createSlider(0, 1, beta, 0);
  // sliderBeta.position(750, canvasHeight+5);
  // sliderBeta.size(80);

  toggleDebug();
}

function redrawCanvas() { 
  print("in redrawCanvas"); 
  fill(255);
  rect(2, 2, canvasWidth-4, canvasHeight-4);
  fill(100,0,0);
  countPoints = 0;
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
      countPoints = countPoints + 1;
    }

    // // try smoothing
    // push()
    // noFill();
    // stroke(0,0,255);
    // smoothedPoints = smoothLine(pts);
    // for (let k=0; k < smoothedPoints.length; k++) {
    //   let p = smoothedPoints[k];
    //   ellipse(p[0], p[1], 16);
    // }
    // pop()

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
        push();
        noFill();
        stroke(0, 255, 0);
        brushSize = minBrushSize + (rdpPoints[j][2] * pressureMultiplier);
        ellipse(rdpPoints[j][0], rdpPoints[j][1], 2 * brushSize);
        pop();
        fill(0, 140, 0);
        // drawLine(prevPenX, prevPenY, 2*prevBrushSize, penX, penY, 2*brushSize, rdp=true);
        prevBrushSize = brushSize;
        prevPenX = penX;
        prevPenY = penY;
      }
      print(`redraw: orig stroke ${ptsXYp.length} vs rdp ${rdpPoints.length}`);
    }
  }
  pcount.html(countPoints + ' pts');
  if (countPoints > pointLimit) {
    pcount.html('too many points')
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

function toggleDebug() {
  showDebug = ! showDebug;
  if (showDebug) {
    buttonRedraw.style('visibility', 'visible');
    ts.style('visibility', 'visible');
  } else {
    buttonRedraw.style('visibility', 'hidden');
    ts.style('visibility', 'hidden');
  }
  redrawCanvas();
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

function convert(p) {
  // // original transformation portrait as seen by robot
  // prx = round(canvasWidth - p[0], 3);
  // pry = round(p[1], 3);
  // landscape as seen from robot
  prx = round(canvasHeight - p[1], 3);
  pry = round(canvasWidth - p[0], 3);
  
  prz = round(p[2], 4); // this is the pressure
  return [prx, pry, prz];
}

function save2file() {
  print("Saving to file ...");
  let writer = createWriter("drawing.script");
  // intro
  writer.write("def Print():\n");
  writer.write("  #set parameters\n");
  writer.write("  global r = 0.25\n");
  writer.write("  global fm = 0.15\n");
  writer.write("  global a = 0.25\n");
  writer.write("  global br = 0.0005\n");
  // writer.write("  global f = drawing_plane\n"); /// this does not work remotely
  writer.write("  global f = p[-0.3,-0.45,0,0,0, -1.57]\n");
  writer.write(`  global s = ${scaleCanvas2Real}\n`);
  writer.write(`  global zr = ${zPressureRange}\n`);

  writer.write("  movej([-1.26,-1.19,-2.39,-1.134,1.57,-1.26], r, a, 0, 0)\n");
  writer.write("  stopl(a)\n");
  writer.write("  sleep(1)\n");
  
  // simplify strokes first
  strokesSimplified = simplifyStrokes(strokes);
  // write strokes
  for (let i = 0; i < strokesSimplified.length; i = i + 1) {
    pts = strokesSimplified[i];

    // move to first point with zUp
    pCanvas = pts[0];
    p = convert(pCanvas);
    writer.write(`  movel(pose_trans(f, p[${p[0]}*s, ${p[1]}*s, ${zUp},0,0,0]), a, v=r, t=0, r=br)\n`);

    for (let j = 0; j < pts.length; j = j + 1) {
      pCanvas = pts[j];
      p = convert(pCanvas);
      writer.write(`  movel(pose_trans(f, p[${p[0]}*s, ${p[1]}*s, ${zDown}-${p[2]}*zr,0,0,0]), a, v=fm, t=0, r=br)\n`);
    }

    // move to last point with zUp
    pCanvas = pts[pts.length-1];
    p = convert(pCanvas);
    writer.write(`  movel(pose_trans(f, p[${p[0]}*s, ${p[1]}*s, ${zUp},0,0,0]), a, v=r, t=0, r=br)\n`);
  }
  // outro
  writer.write("  stopl(a)\n");
  writer.write("  sleep(1)\n");
  writer.write("  movej([-1.26,-1.19,-2.39,-1.134,1.57,-1.26], r, a, 0, 0)\n");
  writer.write("end\n");
  // writer.write("Print()\n");
  
  writer.close();
  print("... finished");
}

// ----------------------------------------------------
function draw() {
  // minCutoff = sliderMC.value();
  // beta = sliderBeta.value();
  // text(`mc: ${minCutoff} - beta: ${beta}`, 10, 20);
    
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

    // // show original mouse points
    // if (showDebug) {
    //   push();
    //   stroke(0,0,255, 150);
    //   noFill();
    //   ellipse(penX, penY, 13);
    //   stroke(255, 0,0, 150);
    //   ellipse(mouseX, mouseY, 15);
    //   pop();
    // }

    // Save the latest brush values for next frame
    prevBrushSize = brushSize;
    prevPenX = penX;
    prevPenY = penY;
    
    isDrawingJustStarted = false;
  } else {
    if (points.length > 0) {
      smoothedPoints = smoothLine(points);
      // strokes.push(points);
      /// check if limit is reached
      if (countPoints <= pointLimit) {
        strokes.push(smoothedPoints);
        // clear history of strokes
        deletedStrokes = [];
      }
      redrawCanvas();
    }
    points = [];
  }
}
// Simple smoothing using moving average technique
function smoothLine(points) {
  let smoothed = [];
  
  // Smooth every point by averaging with its neighbors
  smoothed.push(points[0]);
  for (let i = 1; i < points.length-1; i++) {
    let prev = points[i - 1]
    let curr = points[i];
    let next = points[i + 1];

    // Calculate the smoothed x and y as the average of the previous, current, and next points
    let avgX = (prev[0] + curr[0] + next[0]) / 3;
    let avgY = (prev[1] + curr[1] + next[1]) / 3;
    let avgP = (prev[2] + curr[2] + next[2]) / 3;

    // Add the smoothed point to the new list
    smoothed.push([avgX, avgY, avgP]);
  }
  smoothed.push(points[points.length-1]);
   
  return smoothed;
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

// Initializing Pressure.js
// https://pressurejs.com/documentation.html
function initPressure() {
  
  	// console.log("Attempting to initialize Pressure.js ");
  
    Pressure.set('#drawingCanvas', {
      
      start: function(event){
        // this is called on force start
        if (event.pointerType == 'pen' || !isIpad) {
          isDrawing = true;
          isDrawingJustStarted = true;
        }
  		},
      end: function(){
    		// this is called on force end
        isDrawing = false
        pressure = 0;
  		},
      change: function(force, event) {
        if (event.pointerType == 'pen' || !isIpad) {
          if (isPressureInit == false){
            console.log("Pressure.js initialized successfully");
            isPressureInit = true;
          }
          //console.log(force);
          pressure = force;
        }
      }
    });
  
    Pressure.config({
      polyfill: true, // use time-based fallback ?
      polyfillSpeedUp: 100000000, // how long does the fallback take to reach full pressure
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


// 2024-09-24: somehow only after removing this the page is fixed on ios safari
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
// })