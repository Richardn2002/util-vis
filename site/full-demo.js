"use strict";

const vivify = document.getElementById("vivify").contentWindow;

/* State Management */

let startTime = 0;
let endTime = 10;
let scale = 1;

let sch;
let conf;
let anim;
let verified = false;

let isPlaying = false;
let isRepeating = false;

/* User Interface */

const startTimeBox = document.getElementById("startTime");
const endTimeBox = document.getElementById("endTime");
const scaleBox = document.getElementById("scale");

const schBtn = document.getElementById("schBtn");
const confBtn = document.getElementById("confBtn");
const animBtn = document.getElementById("animBtn");
const verifyBtn = document.getElementById("verifyBtn");

const terminal = document.getElementById("terminal");

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

function toggleRepeat() {
  isRepeating = !isRepeating;

  repeatButton.textContent = isRepeating ? "🔁 Repeating" : "🔁 Repeat";
  repeatButton.classList.toggle("active");

  updatePlayConfig();
}

function updateStartTime() {
  startTime = startTimeBox.value;

  if (startTime > endTime) {
    startTime = endTime - scale;
    startTimeBox.value = startTime;
  }

  updatePlayConfig();
}
function updateEndTime() {
  endTime = endTimeBox.value;

  if (endTime < startTime) {
    endTime = startTime + scale;
    endTimeBox.value = endTime;
  }

  updatePlayConfig();
}
function updateScale() {
  scale = scaleBox.value;

  if (scale == 0) {
    scale = 1;
    scaleBox.value = 1;
  }

  updatePlayConfig();
}

function loadSchematic(input) {
  const file = input.files[0];

  if (file.type !== "image/svg+xml") {
    terminal.textContent = "Chosen file is not valid SVG.";
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    sch = e.target.result;

    terminal.textContent = "Schematic loaded.";
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
    conf = e.target.result;

    terminal.textContent = "Config loaded.";
    verified = false;
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
    anim = e.target.result;

    terminal.textContent = "Animation loaded.";
    verified = false;
  };
  reader.onerror = function () {
    terminal.textContent = "Error loading animation.";
  };

  reader.readAsText(file);
}

/* Progress Bar */

const progressBar = document.getElementById("progressBar");
const progressHandle = document.getElementById("progressHandle");
const progressFill = document.getElementById("progressFill");
let isDragging = false;

const repeatButton = document.getElementById("repeatBtn");

progressBar.addEventListener("click", function (e) {
  if (!isDragging) {
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    setProgress(progress);
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
  }
});

document.addEventListener("mouseup", function () {
  if (isDragging) {
    isDragging = false;
    progressHandle.classList.remove("dragging");
  }
});

/* Interface with Vivify */

function verify() {
  if (verified) {
    terminal.textContent = "Already verified.";
    return;
  }
  if (!sch) {
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

  vivify.postMessage(
    Object({
      type: "load",
      data: Object({
        conf,
        anim,
        sch,
      }),
    }),
    "*",
  );
}

function updatePlayConfig() {
  vivify.postMessage(
    Object({
      type: "playConfig",
      data: Object({
        startTime,
        endTime,
        scale,
        isRepeating,
      }),
    }),
    "*",
  );
}

function playAnimation() {
  if (!verified) {
    terminal.textContent = "Please verify files first.";
    return;
  }

  vivify.postMessage(
    Object({
      type: "play",
    }),
    "*",
  );
}

function pauseAnimation() {
  vivify.postMessage(
    Object({
      type: "pause",
    }),
    "*",
  );
}

function setProgress(progress) {
  if (!verified) {
    terminal.textContent = "Please verify files first.";
    return;
  }

  vivify.postMessage(
    Object({
      type: "jump",
      data: progress,
    }),
    "*",
  );
}

function step(s) {
  if (!verified) {
    terminal.textContent = "Please verify files first.";
    return;
  }

  vivify.postMessage(
    Object({
      type: "step",
      data: s,
    }),
    "*",
  );
}

window.addEventListener("message", (event) => {
  switch (event.data.type) {
    case "verified":
      startTime = event.data.data.startTime;
      endTime = event.data.data.endTime;
      scale = event.data.data.scale;

      terminal.textContent = "Input files verified.";
      verified = true;
      break;
    case "error":
      terminal.textContent = event.data.data;
      verified = false;
      break;
    case "progress":
      // update play status
      if (isPlaying != event.data.data.isPlaying) {
        isPlaying = event.data.data.isPlaying;
        if (isPlaying) {
          disableInputs();
        } else {
          enableInputs();
        }
      }

      // render progress bar
      const percentage = event.data.data.animationProgress * 100;
      progressFill.style.width = percentage + "%";
      progressHandle.style.left = percentage + "%";

      break;
  }
});
