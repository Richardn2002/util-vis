"use strict";

const svgContainer = document.getElementById("svgContainer");

let startTime = 0;
let endTime = 10;
let scale = 1;

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

function load(data) {
  /* Configuration */

  try {
    conf = JSON.parse(data.conf);
  } catch {
    reportError("Config file not valid JSON.");
    return;
  }

  let fieldValues = [0, 0, 0];
  ["animStart", "animEnd", "animScale"].forEach((field, i) => {
    if (conf[field]) {
      fieldValues[i] = conf[field];
    } else {
      reportError("'" + field + "' missing from config");
      return;
    }
  });
  [startTime, endTime, scale] = fieldValues;

  ["mapping", "elements", "groups"].forEach((field) => {
    if (!conf[field]) {
      reportError("'" + field + "' missing from config");
      return;
    }
  });

  /* Animation */

  const lines = data.anim.split("\n");
  const signalNames = lines[0].replace(/\s+/g, "").split(",").slice(1);

  let timestamps = [];
  let signals = [];
  for (let i = 1; i < lines.length; i++) {
    // skip empty new line, usually caused by the trailing \n in a file
    if (lines[i].length == 0) {
      continue;
    }

    const line = lines[i].replace(/\s+/g, "").split(",");
    // use integer time but string signal
    timestamps.push(parseInt(line[0]));
    signals.push(line.slice(1));
  }

  anim = {
    signalNames: signalNames,
    timestamps: timestamps,
    signals: signals,
  };

  /* SVG */

  svgContainer.innerHTML = data.sch;
  svgContainer.children[0].setAttribute(
    "style",
    "position:absolute;left:0; top:0; width:100%; height:100%",
  );

  /* Overall Check */

  for (const signalName of anim["signalNames"]) {
    const mappedName = conf["mapping"][signalName];
    if (!mappedName) {
      continue;
    }

    if (conf["elements"][mappedName]) {
      if (conf["groups"][mappedName]) {
        reportError(`"${mappedName}" is both an element and a group.`);
        return;
      }
    } else {
      if (!conf["groups"][mappedName]) {
        reportError(`"${mappedName}" is neither an element nor a group.`);
        return;
      }
    }
  }

  verified = true;
  reportVerified();
}

function playConfig(data) {
  if (
    data.startTime == undefined ||
    data.endTime == undefined ||
    data.scale == undefined ||
    data.isRepeating == undefined
  ) {
    console.error(
      "Vivify: Malformed config set, expected fields: startTime, endTime, scale, isRepeating.",
    );
    return;
  }

  startTime = data.startTime;
  endTime = data.endTime;
  scale = data.scale;
  isRepeating = data.isRepeating;
}

// [0, 1]. If exactly 1, means the last frame has already been rendered
let animationProgress = 0;
// the exact frame index corresponding to animationProgress
let animationFrame = 0;

let isStarted = false;
let isPlaying = false;
let isRepeating = false;
// If exactly 0, means current render pass is the first one during a play through (just started or unpaused)
let lastAnimateTime = 0;

// properly set variables (animationProgress and animationFrame) for jumping to a point in [0, 1]
function setProgress(progress) {
  animationProgress = progress;

  const animTime =
    (1 - animationProgress) * startTime + animationProgress * endTime;

  // return the smallest index such that arr[index] > searchKey
  let upperBound = (arr, searchKey) => {
    let low = 0;
    let high = arr.length - 1;
    let ans = arr.length; // Default to arr.length if searchKey greater than all

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      if (arr[mid] > searchKey) {
        ans = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return ans;
  };
  animationFrame = upperBound(anim["timestamps"], animTime) - 1;
}

function animate(currentTime) {
  if (!isPlaying) return;

  if (animationProgress == 1) {
    // last frame has already been rendered
    if (isRepeating) {
      // Reset for repeat
      setProgress(0);
      lastAnimateTime = 0;
    } else {
      // Animation finished, stop playing
      isStarted = false;
      isPlaying = false;
    }
  }

  if (lastAnimateTime !== 0) {
    // requested by the last requestAnimationFrame, value set to last timestamp
    animationProgress +=
      (((currentTime - lastAnimateTime) / 1000) * scale) /
      (endTime - startTime);
    setProgress(animationProgress);
  } // else, first ever request of animate

  if (animationProgress > 1) {
    // make sure last frame is rendered and mark end
    setProgress(1);
  }

  draw();

  lastAnimateTime = currentTime;
  if (isPlaying) {
    requestAnimationFrame(animate);
  }
}

function playAnimation() {
  setProgress(0);
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
    isPlaying = false;
    reportProgress();
  } else {
    // Resume from pause
    isPlaying = true;
    lastAnimateTime = 0;
    requestAnimationFrame(animate);
  }
}

function step(s) {
  if (isPlaying) {
    pauseAnimation();
  }

  animationFrame += s >= 0 ? 1 : -1;
  animationFrame = Math.max(
    0,
    Math.min(anim["timestamps"].length - 1, animationFrame),
  );

  let animTime = anim["timestamps"][animationFrame];
  animationProgress = (animTime - startTime) / (endTime - startTime);
  animationProgress = Math.max(0, Math.min(1, animationProgress));

  draw();
}

/* Drawing */

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
  // inform parent of play progress
  reportProgress();

  // render svg
  const signal = anim["signals"][animationFrame];

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

/* Interface with Parent */

function reportError(msg) {
  window.parent.postMessage(
    Object({
      type: "error",
      data: msg,
    }),
    "*",
  );
}

function reportVerified() {
  window.parent.postMessage(
    Object({
      type: "verified",
      data: Object({
        startTime,
        endTime,
        scale,
      }),
    }),
    "*",
  );
}

function reportProgress() {
  window.parent.postMessage(
    Object({
      type: "progress",
      data: Object({
        isPlaying,
        animationProgress,
        animationFrame,
      }),
    }),
    "*",
  );
}

window.addEventListener("message", (event) => {
  switch (event.data.type) {
    case "load":
      load(event.data.data);
      break;
    case "playConfig":
      playConfig(event.data.data);
      break;
    case "play":
      if (!verified) {
        console.error("Vivify: Play request received while nothing loaded.");
        return;
      }

      playAnimation();
      break;
    case "pause":
      pauseAnimation();
      break;
    case "step":
      if (!verified) {
        console.error("Vivify: Play request received while nothing loaded.");
        return;
      }

      step(event.data.data);
      break;
    case "jump":
      if (!verified) {
        console.error("Vivify: Jump request received while nothing loaded.");
        return;
      }

      setProgress(event.data.data);
      draw();
      break;
  }
});
