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

  for (const signalName in anim["signalNames"]) {
    const mappedName = conf["mapping"][signalName];
    if (!mappedName) {
      continue;
    }

    if (conf["elements"].has(mappedName)) {
      if (conf["groups"].has(mappedName)) {
        terminal.textContent = `"${mappedName}" is both an element and a group.`;
        return;
      }
    } else {
      if (!conf["groups"].has(mappedName)) {
        terminal.textContent = `"${mappedName}" is neither an element nor a group.`;
        return;
      }
    }
  }

  terminal.textContent = "Input files verified.";
  verified = true;
}

/* Animation Control */

const repeatButton = document.getElementById("repeatBtn");

let isStarted = false;
let isPlaying = false;
let isRepeating = false;
let animationStartTime = null;
let pauseStartTime = 0;
let totalPausedTime = 0;

function animate(currentTime) {
  if (!isPlaying) return;

  const animation_duration = ((endTime - startTime) / scale) * 1000;

  let elapsedTime = currentTime - animationStartTime - totalPausedTime;

  if (elapsedTime >= animation_duration) {
    // If end reached
    if (isRepeating) {
      // Reset for repeat
      animationStartTime = currentTime;
      totalPausedTime = 0;
      elapsedTime = 0;
    } else {
      // Animation finished, stop playing
      terminal.textContent = "Animation finished.";
      isStarted = false;
      isPlaying = false;
      enableInputs();
    }
  }

  draw(elapsedTime);

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
  animationStartTime = performance.now();
  isStarted = true;
  isPlaying = true;
  totalPausedTime = 0;

  // Start the animation loop
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
    pauseStartTime = performance.now();
  } else {
    // Resume from pause
    terminal.textContent = "Playing animation.";
    disableInputs();
    isPlaying = true;
    totalPausedTime += performance.now() - pauseStartTime;
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
  let ans = arr.length - 1; // Default to arr.length if searchKey greater than all

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

function draw(time) {
  const animTime = (time / 1000) * scale + startTime;
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

    const elementConf = conf["elements"][name];
    if (elementConf) {
      if (!setRequests[name]) {
        let newEntry = {};
        newEntry[point] = [];
        setRequests[name] = newEntry;
      }
      setRequests[name][point].push(elementConf[point]);
    } else {
      // name correspond to a group
      const groupConf = conf["groups"][name];
      for (const [elementName, conf] of Object.entries(groupConf)) {
        if (!setRequests[elementName]) {
          let newEntry = {};
          newEntry[point] = [];
          setRequests[elementName] = newEntry;
        }
        setRequests[elementName][point].push(conf[point]);
      }
    }
  }

  for (const [name, valueRequests] of Object.entries(setRequests)) {
    // pick "1" over "0", for now
    const signalToSet = Object.keys(valueRequests).sort().slice(-1)[0];
    // pick a random value to set, for now
    const attributesToSet = valueRequests[signalToSet][0];

    const element = document.getElementById(name);
    modifyElement(element, attributesToSet);
  }
}
