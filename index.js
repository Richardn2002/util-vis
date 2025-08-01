"use strict";

/* User Interface */

const startTimeBox = document.getElementById("startTime");
const endTimeBox = document.getElementById("endTime");
const scaleBox = document.getElementById("scale");

const schBtn = document.getElementById("schBtn");
const confBtn = document.getElementById("confBtn");
const animBtn = document.getElementById("animBtn");
const verifyBtn = document.getElementById("verifyBtn");

const terminal = document.getElementById("terminal");
const svgContainer = document.getElementById("svgContainer");

let startTime = 0;
let endTime = 10;
let scale = 1;

let schLoaded = false;
let conf = null;
/*
{
  signalNames: [str],
  timestamps: [int],
  signals: [[str]],
}
*/
let anim = null;
let verified = false;

for (const element of [schBtn, confBtn, animBtn, verifyBtn]) {
  element.addEventListener("mouseover", () => {
    if (isPlaying) {
      element.style.cursor = "not-allowed";
    }
  });
  element.addEventListener("mouseout", function () {
    element.style.cursor = "default";
  });
}
function disableInputs() {
  for (const element of [
    startTimeBox,
    endTimeBox,
    scaleBox,
    schBtn,
    confBtn,
    animBtn,
    verifyBtn,
  ]) {
    element.disabled = true;
  }
}
function enableInputs() {
  for (const element of [
    startTimeBox,
    endTimeBox,
    scaleBox,
    schBtn,
    confBtn,
    animBtn,
    verifyBtn,
  ]) {
    element.disabled = false;
  }
}

function updateStartTime() {
  startTime = startTimeBox.value;

  if (startTime > endTime) {
    startTime = endTime - scale;
    startTimeBox.value = startTime;
  }
}
function updateEndTime() {
  endTime = endTimeBox.value;

  if (endTime < startTime) {
    endTime = startTime + scale;
    endTimeBox.value = endTime;
  }
}
function updateScale() {
  scale = scaleBox.value;

  if (scale == 0) {
    scale = 1;
    scaleBox.value = 1;
  }
}

function loadSchematic(input) {
  const file = input.files[0];

  if (file.type !== "image/svg+xml") {
    terminal.textContent = "Chosen file is not valid SVG.";
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    svgContainer.innerHTML = e.target.result;
    svgContainer.children[0].setAttribute(
      "style",
      "position:absolute;left:0; top:0; width:100%; height:100%",
    );

    terminal.textContent = "Schematic loaded.";
    schLoaded = true;
    verified = false;
  };
  reader.onerror = function () {
    terminal.textContent = "Error loading schematic.";
  };

  reader.readAsText(file);
}

function loadConfig(input) {
  const file = input.files[0];

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);

      let startTimeFile = data["animStart"];
      if (startTimeFile) {
        startTime = startTimeFile;
        startTimeBox.value = startTimeFile;
      } else {
        terminal.textContent = "'startTime' missing from config.";
        return;
      }
      let endTimeFile = data["animEnd"];
      if (endTimeFile) {
        endTime = endTimeFile;
        endTimeBox.value = endTimeFile;
      } else {
        terminal.textContent = "'endTime' missing from config.";
        return;
      }
      let scaleFile = data["animScale"];
      if (scaleFile) {
        scale = scaleFile;
        scaleBox.value = scaleFile;
      } else {
        terminal.textContent = "'animScale' missing from config.";
        return;
      }
      if (!data["mapping"]) {
        terminal.textContent = "'mapping' missing from config.";
        return;
      }
      if (!data["elements"]) {
        terminal.textContent = "'elements' missing from config.";
        return;
      }
      if (!data["groups"]) {
        terminal.textContent = "'groups' missing from config.";
        return;
      }

      terminal.textContent = "Config loaded.";
      conf = data;
      verified = false;
    } catch {
      terminal.textContent = "Config file not valid JSON.";
    }
  };
  reader.onerror = function () {
    terminal.textContent = "Error loading config.";
  };

  reader.readAsText(file);
}

function loadAnimation(input) {
  const file = input.files[0];

  const reader = new FileReader();

  reader.onload = function (e) {
    const lines = e.target.result.split("\n");
    const signalNames = lines[0].replace(/\s+/g, "").split(",").slice(1);

    let timestamps = [];
    let signals = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/\s+/g, "").split(",");
      // use integer time but string signal
      timestamps.push(parseInt(line[0]));
      signals.push(line.slice(1));
    }

    terminal.textContent = "Animation loaded.";
    anim = {
      signalNames: signalNames,
      timestamps: timestamps,
      signals: signals,
    };
    verified = false;
  };
  reader.onerror = function () {
    terminal.textContent = "Error loading animation.";
  };

  reader.readAsText(file);
}

function verify() {
  if (verified) {
    terminal.textContent = "Already verified.";
    return;
  }
  if (!schLoaded) {
    terminal.textContent = "Schematic not loaded.";
    return;
  }
  if (!conf) {
    terminal.textContent = "Config not loaded.";
    return;
  }
  if (!anim) {
    terminal.textContent = "Animation not loaded.";
    return;
  }

  for (const signalName of anim["signalNames"]) {
    const mappedName = conf["mapping"][signalName];
    if (!mappedName) {
      continue;
    }

    if (conf["elements"][mappedName]) {
      if (conf["groups"][mappedName]) {
        terminal.textContent = `"${mappedName}" is both an element and a group.`;
        return;
      }
    } else {
      if (!conf["groups"][mappedName]) {
        terminal.textContent = `"${mappedName}" is neither an element nor a group.`;
        return;
      }
    }
  }

  terminal.textContent = "Input files verified.";
  verified = true;
}

/* Animation Control */

const progressBar = document.getElementById("progressBar");
const progressHandle = document.getElementById("progressHandle");
const progressFill = document.getElementById("progressFill");
const repeatButton = document.getElementById("repeatBtn");

let isDragging = false;
// [0, 1]. If exactly 1, means the last frame has already been rendered
let animationProgress = 0;

let isStarted = false;
let isPlaying = false;
let isRepeating = false;
// If exactly 0, means current render pass is the first one during a play through (just started or unpaused)
let lastAnimateTime = 0;

progressBar.addEventListener("click", function (e) {
  if (!isDragging) {
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    setProgress(progress);

    draw();
  }
});

progressHandle.addEventListener("mousedown", function (e) {
  if (isPlaying) {
    pauseAnimation();
  }

  isDragging = true;
  progressHandle.classList.add("dragging");
  e.preventDefault();
});

document.addEventListener("mousemove", function (e) {
  if (isDragging) {
    const rect = progressBar.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, mouseX / rect.width));
    setProgress(progress);

    draw();
  }
});

document.addEventListener("mouseup", function () {
  if (isDragging) {
    isDragging = false;
    progressHandle.classList.remove("dragging");
  }
});

function setProgress(progress) {
  animationProgress = progress;

  const percentage = progress * 100;
  progressFill.style.width = percentage + "%";
  progressHandle.style.left = percentage + "%";
}

function animate(currentTime) {
  if (!isPlaying) return;

  if (animationProgress == 1) {
    // last frame has already been rendered
    if (isRepeating) {
      // Reset for repeat
      animationProgress = 0;
      lastAnimateTime = 0;
    } else {
      // Animation finished, stop playing
      terminal.textContent = "Animation finished.";
      isStarted = false;
      isPlaying = false;
      enableInputs();
    }
  }

  if (lastAnimateTime !== 0) {
    // requested by the last requestAnimationFrame, value set to last timestamp
    animationProgress +=
      (((currentTime - lastAnimateTime) / 1000) * scale) /
      (endTime - startTime);
  } // else, first ever request of animate

  if (animationProgress > 1) {
    // make sure last frame is rendered and mark end
    animationProgress = 1;
  }

  draw();

  lastAnimateTime = currentTime;
  if (isPlaying) {
    requestAnimationFrame(animate);
  }
}

function playAnimation() {
  if (!verified) {
    verify();
    if (!verified) {
      return;
    }
  }

  terminal.textContent = "Playing animation.";
  disableInputs();
  animationProgress = 0;
  isStarted = true;
  isPlaying = true;

  // Start the animation loop
  lastAnimateTime = 0;
  requestAnimationFrame(animate);
}

function pauseAnimation() {
  if (!isStarted) {
    return;
  }

  if (isPlaying) {
    // Pause the animation
    terminal.textContent = "Animation paused.";
    enableInputs();
    isPlaying = false;
  } else {
    // Resume from pause
    terminal.textContent = "Playing animation.";
    disableInputs();
    isPlaying = true;
    lastAnimateTime = 0;
    requestAnimationFrame(animate);
  }
}

function toggleRepeat() {
  isRepeating = !isRepeating;
  repeatButton.textContent = isRepeating ? "🔁 Repeating" : "🔁 Repeat";
}

/* Drawing */

function lowerBound(arr, searchKey) {
  let low = 0;
  let high = arr.length - 1;
  let ans = arr.length - 1; // Default to arr.length - 1 if searchKey greater than all

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (arr[mid] >= searchKey) {
      ans = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return ans;
}

function modifyElement(element, attributes) {
  for (const [attribute, value] of Object.entries(attributes)) {
    if (attribute == "style") {
      let oldValues = (element.getAttribute("style") ?? "").split(";");
      let newValues = [];
      for (let [styleAttribute, styleValue] of Object.entries(value)) {
        const setString = styleAttribute + ":" + styleValue;
        let existing = false;
        for (let [i, oldValue] of oldValues.entries()) {
          if (oldValue.startsWith(styleAttribute)) {
            existing = true;
            oldValues[i] = setString;
            break;
          }
        }
        if (!existing) {
          newValues.push(setString);
        }
      }

      element.setAttribute("style", oldValues.concat(newValues).join(";"));
    } else {
      element.setAttribute(attribute, value);
    }
  }
}

function draw() {
  setProgress(animationProgress);

  const animTime =
    (1 - animationProgress) * startTime + animationProgress * endTime;
  let animIndex;
  if (animTime >= endTime) {
    animIndex = anim["timestamps"].length - 1;
  } else {
    animIndex = lowerBound(anim["timestamps"], animTime);
  }
  const signal = anim["signals"][animIndex];

  /*
  {
    "elementA": {
      "value0": [
        {
          "attributeA": "setA",
          "attributeB": "setB"
        },
        {
          "style": {
            "attributeC": "setC"
          }
        }
      ],
      "value1": [
        ...
      ]
    },
    "elementB": {
      ...
    }
  }
  */
  let setRequests = {};
  for (const [i, point] of signal.entries()) {
    const name = conf["mapping"][anim["signalNames"][i]];
    if (!name) continue;

    const growRequest = (n, conf) => {
      if (!setRequests[n]) {
        let newEntry = {};
        newEntry[point] = [];
        setRequests[n] = newEntry;
      }
      if (setRequests[n][point]) {
        setRequests[n][point].push(conf[point]);
      } else {
        setRequests[n][point] = [conf[point]];
      }
    };
    const elementConf = conf["elements"][name];
    if (elementConf) {
      growRequest(name, elementConf);
    } else {
      // name correspond to a group
      const groupConf = conf["groups"][name];
      for (const [elementName, conf] of Object.entries(groupConf)) {
        if (elementName == "cnm1_out" && point == "1") {
          console.log("here");
        }
        growRequest(elementName, conf);
      }
    }
  }

  for (const [name, valueRequests] of Object.entries(setRequests)) {
    // pick "1" over "0", for now
    const signalToSet = Object.keys(valueRequests).sort().slice(-1)[0];
    // pick a random value to set, for now
    const attributesToSet = valueRequests[signalToSet][0];
    if (!attributesToSet) continue;

    const element = document.getElementById(name);
    modifyElement(element, attributesToSet);
  }
}
