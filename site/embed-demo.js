"use strict";

const conf = `
  {
    "animStart": 10,
    "animEnd": 20,
    "animScale": 10,
    "mapping": {
      "cIrClEa": "circleA",
      "CiRcLeB": "circleB",
      "MaGiC": "circles"
    },
    "elements": {
      "circleA": {
        "0": {
          "style": { "fill": "red", "stroke": "orange" }
        },
        "1": {
          "style": { "fill": "blue", "stroke": "green" }
        }
      },
      "circleB": {
        "0": {
          "fill": "red"
        },
        "1": {
          "fill": "blue"
        }
      }
    },
    "groups": {
      "circles": {
        "circleC": {
          "0": {
            "style": { "fill": "red" }
          },
          "1": {
            "style": { "fill": "blue" }
          }
        },
        "circleD": {
          "0": {
            "style": { "fill": "red" }
          },
          "1": {
            "style": { "fill": "blue" }
          }
        }
      }
    }
  }
`;

// NOTE: there MUST NOT be a leading newline character
const anim = `SimTime,cIrClEa,CiRcLeB,MaGiC
  10,0,0,1
  12,0,1,0
  14,0,1,1
  16,1,0,0
  18,1,0,1
`;

const sch = `
  <?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle id="circleA" cx="50" cy="50" r="50" style="fill: red" />
      <circle id="circleB" cx="150" cy="50" r="50" fill="blue" />
      <circle id="circleC" cx="50" cy="150" r="50" style="fill: red" />
      <circle id="circleD" cx="150" cy="150" r="50" style="fill: blue" />
  </svg>
`;

function load() {
  const vivify = document.getElementById("vivify").contentWindow;

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

  vivify.postMessage(
    Object({
      type: "playConfig",
      data: Object({
        startTime: 10,
        endTime: 20,
        scale: 10,
        isRepeating: true,
      }),
    }),
    "*",
  );

  vivify.postMessage(
    Object({
      type: "play",
    }),
    "*",
  );
}
