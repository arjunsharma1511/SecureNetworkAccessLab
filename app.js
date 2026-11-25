"use strict";

const KEY = "harborline-progress-v1";
const TOTAL = exercises.flat().length;
const validIds = new Set(exercises.flatMap((group, chapter) => group.map((_, index) => `${chapter}:${index}`)));
const byId = id => document.getElementById(id);
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const packetAnimations = new Set();
let motionPaused = motionPreference.matches;
let chapter = 0;
let index = 0;
let completed = readProgress();
let renderVersion = 0;
let routeObserver;

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return new Set(Array.isArray(saved) ? saved.filter(id => validIds.has(id)) : []);
  } catch {
    return new Set();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...completed]));
  } catch {
    byId("progress-label").title = "Storage is unavailable. Progress is kept until this page closes.";
  }
}

function updateOverview() {
  byId("progress-label").textContent = `${completed.size} / ${TOTAL} complete`;
  byId("progress-bar").value = completed.size;
  byId("resume").textContent = completed.size === TOTAL ? "View certificate" : completed.size ? "Resume the lab" : "Start the lab";
  byId("cert-form").hidden = completed.size !== TOTAL;
  byId("cert-status").textContent = completed.size === TOTAL
    ? "All 25 challenges completed. Your certificate is ready."
    : "Complete all 25 challenges to unlock your certificate.";
}

function showMotionState() {
  document.documentElement.classList.toggle("motion-paused", motionPaused);
  byId("motion").textContent = motionPaused ? "Play motion" : "Pause motion";
  byId("motion").setAttribute("aria-pressed", String(motionPaused));
  if (motionPaused) packetAnimations.forEach(animation => animation.cancel());
}

byId("motion").addEventListener("click", () => {
  motionPaused = !motionPaused;
  showMotionState();
});
motionPreference.addEventListener("change", event => {
  motionPaused = event.matches;
  showMotionState();
});
showMotionState();

function openCase(nextChapter, nextIndex, focus = true) {
  chapter = nextChapter;
  index = nextIndex;
  render();
  if (focus) byId("case-title").focus();
}

function drawNavigation() {
  const chapterNav = byId("chapters");
  chapterNav.innerHTML = chapters.map((item, position) => {
    const count = exercises[position].filter((_, caseNo) => completed.has(`${position}:${caseNo}`)).length;
    return `<button type="button" data-chapter="${position}" ${position === chapter ? 'aria-current="step"' : ""}>
      <span class="chapter-number">${item.icon}</span><span><b>${item.title}</b><small>${count} of ${exercises[position].length} complete</small></span></button>`;
  }).join("");
  chapterNav.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    const next = Number(button.dataset.chapter);
    const first = exercises[next].findIndex((_, pos) => !completed.has(`${next}:${pos}`));
    openCase(next, Math.max(0, first));
  }));
  const caseNav = byId("case-nav");
  caseNav.innerHTML = exercises[chapter].map((item, pos) => {
    const done = completed.has(`${chapter}:${pos}`);
    return `<button type="button" data-case="${pos}" aria-label="Challenge ${pos + 1}: ${item.title}${done ? ", completed" : ""}" ${pos === index ? 'aria-current="step"' : ""}><span>${pos + 1}</span>${done ? '<i aria-hidden="true">✓</i>' : ""}</button>`;
  }).join("");
  caseNav.querySelectorAll("button").forEach(button => button.addEventListener("click", () => openCase(chapter, Number(button.dataset.case))));
}

function evaluateAccess(item) {
  const identity = item.identity !== false;
  const device = item.device !== false;
  const allowedRoute = policies[item.source].allows.includes(item.resource);
  const tunnel = item.vpn === "active" || (item.vpn === "new" && identity && device);
  const stoppedAtGateway = item.vpn === "new" && !tunnel;
  const recheck = item.context === "verify";
  const outcome = !identity || !device || !allowedRoute ? 1 : recheck ? 2 : 0;
  const decision = !identity ? "Identity verification is incomplete."
    : !device ? "Device does not meet access policy."
    : !allowedRoute ? "This resource is outside the permitted route."
    : recheck ? "Additional verification is required for this request."
    : "The supplied checks permit this request.";
  const context = item.context === "verified" ? "Extra check completed"
    : recheck ? "Extra check pending" : "Routine";
  const checks = stoppedAtGateway
    ? [["Identity", identity ? "Verified" : "Incomplete", identity ? "pass" : "fail"],
      ["Device", !identity ? "Not reached" : "Not approved", identity ? "fail" : "idle"],
      ["Resource", "Not reached", "idle"], ["Context", "Not reached", "idle"]]
    : [["Identity", item.source === "guest" ? "Guest session" : identity ? "Verified" : "Incomplete", identity ? "pass" : "fail"],
      ["Device", item.source === "guest" ? "Guest device on guest Wi-Fi" : device ? "Approved" : "Out of policy", device ? "pass" : "fail"],
      ["Resource", allowedRoute ? "Route listed" : "Route restricted", allowedRoute ? "pass" : "fail"],
      ["Context", context, recheck ? "hold" : "pass"]];
  return { outcome, decision, tunnel, stoppedAtGateway, checks };
}

const outcomeLabels = ["Allow access", "Deny access", "Ask for another check"];
const resultLabels = ["Access allowed", "Access denied", "Verification required"];
const resultStyles = ["pass", "fail", "hold"];

function renderRequest(item) {
  const route = policies[item.source];
  const target = resources[item.resource];
  return `<div class="scenario-grid"><dl class="request">
    <div><dt>Requester</dt><dd>${route.label}</dd></div><div><dt>Target</dt><dd>${target.label} · ${target.zone}</dd></div>
    <div><dt>Connection</dt><dd>${item.vpn === "new" ? "VPN requested" : item.vpn === "active" ? "VPN already connected" : "Local network"}</dd></div>
    <div><dt>Situation</dt><dd>${item.context ? "After-hours admin request" : "Standard working context"}</dd></div>
    </dl><div class="policy"><b>Route policy for this requester</b><p>Each destination has its own rule. Other checks still apply to listed routes.</p>
      <ul class="zone-list">${Object.entries(resources).map(([key, resource]) => `<li ${key === item.resource ? 'class="requested"' : ""}><span>${resource.label}${key === item.resource ? " · Target" : ""}</span><b>${route.allows.includes(key) ? "Listed" : "Restricted"}</b></li>`).join("")}</ul></div></div>`;
}

function renderNetwork(item) {
  const target = resources[item.resource];
  return `<div class="route-sim" id="route-sim">
      <div class="sim-head"><span>PACKET ROUTE</span><span id="tunnel-label">Awaiting replay</span></div>
      <div class="network" id="network" aria-label="Packet route from requester through connection and policy to destination">
        <div class="wires" id="wires" aria-hidden="true"></div>
        <div class="net-node" id="node-source"><b>DEVICE</b><small>${item.source === "guest" ? "Guest device" : "Requester"}</small></div>
        <div class="net-node" id="node-connect"><b>${item.vpn ? "VPN" : "LAN"}</b><small>${item.vpn ? "Gateway" : "Local link"}</small></div>
        <div class="net-node" id="node-gate"><b>POLICY</b><small>Access gate</small></div>
        <div class="net-node target" id="node-target"><b>${target.mark}</b><small>${target.label}</small></div>
        <div class="packet" id="packet" hidden aria-hidden="true"></div>
      </div>
      <div class="checks" id="checks">
        ${["Identity", "Device", "Resource", "Context"].map(label => `<div><b>${label}</b><span>Waiting</span></div>`).join("")}
      </div>
    </div>`;
}

function renderChange(item) {
  return `<div class="scenario-grid"><div class="baseline"><b>Approved baseline</b><p>${item.baseline}</p></div>
    <div class="observed"><b>Observed setting</b><p>${item.observed}</p></div></div>`;
}

function choiceList(name, options) {
  return options.map((option, pos) => `<label class="choice"><input type="radio" name="${name}" value="${pos}"><span>${option}</span></label>`).join("");
}

function render() {
  const version = ++renderVersion;
  packetAnimations.forEach(animation => animation.cancel());
  routeObserver?.disconnect();
  const item = exercises[chapter][index];
  const lesson = chapters[chapter];
  const id = `${chapter}:${index}`;
  const isAccess = item.kind === "access";
  const alreadyPassed = completed.has(id);
  drawNavigation();
  updateOverview();
  byId("lesson").innerHTML = `<h3>${lesson.title}</h3><p>${lesson.intro}</p><p class="lesson-cue">${lesson.cue}</p>`;
  byId("challenge").innerHTML = `
    <header class="case-header"><div><p class="eyebrow">CHALLENGE ${index + 1} OF ${exercises[chapter].length}</p><h3 id="case-title" tabindex="-1">${item.title}</h3></div>
      <span class="completed-pill" id="case-done" ${alreadyPassed ? "" : "hidden"}>Completed</span></header>
    <p class="story">${item.story}</p>
    ${isAccess ? renderRequest(item) : renderChange(item)}
    <fieldset id="run-options"><legend>${isAccess ? "Predict the access decision" : "Choose a change to test"}</legend>
      ${choiceList("simulation-choice", isAccess ? outcomeLabels : item.options)}
    </fieldset>
    <div class="run-actions"><button class="primary" id="run" type="button">${isAccess ? "Run the request" : "Test this change"}</button>
      <details class="hint"><summary>Show a hint</summary><p>${item.review.hint}</p></details></div>
    ${isAccess ? renderNetwork(item) : ""}
    <p id="run-prompt" class="notice" role="status"></p>
    <div id="evidence" class="evidence" aria-live="polite" hidden></div>
    <div id="review" class="review" hidden>
      <fieldset><legend>${item.review.question}</legend>${choiceList("review-choice", item.review.options)}</fieldset>
      <button class="primary" id="grade" type="button">Check my reasoning</button>
      <p class="notice" id="review-result" role="status"></p>
    </div>
    <div class="case-footer"><button class="quiet" id="previous" type="button" ${chapter === 0 && index === 0 ? "disabled" : ""}>Previous challenge</button>
      <button class="quiet" id="next" type="button" ${alreadyPassed ? "" : "disabled"}>${chapter === chapters.length - 1 && index === exercises[chapter].length - 1 ? "View completion" : "Next challenge"}</button></div>`;
  routeObserver = isAccess && typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => drawWires(version)) : null;
  if (isAccess) {
    routeObserver?.observe(byId("network"));
    drawWires(version);
  }
  byId("run").addEventListener("click", async () => {
    const checked = document.querySelector('input[name="simulation-choice"]:checked');
    if (!checked) {
      notice("run-prompt", "Choose one option, then run the simulation.", "hold");
      return;
    }
    const selected = Number(checked.value);
    byId("review").hidden = true;
    byId("evidence").hidden = true;
    byId("review-result").textContent = "";
    document.querySelectorAll('input[name="review-choice"]').forEach(input => { input.checked = false; });
    notice("run-prompt", "", "");
    byId("run").disabled = true;
    byId("run-options").disabled = true;
    if (isAccess) {
      const result = evaluateAccess(item);
      byId("run").textContent = "Replaying request…";
      const route = byId("route-sim");
      const bounds = route.getBoundingClientRect();
      if (bounds.bottom > window.innerHeight || bounds.top < byId("motion").getBoundingClientRect().bottom) {
        route.scrollIntoView({ block: "center", behavior: "instant" });
      }
      await replayRoute(item, result, version);
      if (version !== renderVersion) return;
      byId("run").textContent = "Run the request";
      showAccessResult(item, result);
      const matched = selected === result.outcome;
      byId("review").hidden = !matched;
      notice("run-prompt", matched
        ? "Your prediction matches the replay. Answer the follow-up below."
        : "Compare your prediction with the replay. Choose the recorded outcome and run it again.", matched ? "pass" : "hold");
    } else {
      const passes = showTests(item, selected);
      byId("review").hidden = !passes;
      notice("run-prompt", passes
        ? "All checks passed. Answer the follow-up below."
        : "Review the failed checks. Pick a change that meets every requirement and test it.", passes ? "pass" : "hold");
    }
    byId("run").disabled = false;
    byId("run-options").disabled = false;
  });
  byId("grade").addEventListener("click", () => {
    const picked = document.querySelector('input[name="review-choice"]:checked');
    if (!picked) return notice("review-result", "Choose one explanation first.", "hold");
    if (Number(picked.value) !== item.review.answer) {
      return notice("review-result", `Try again. ${item.review.hint}`, "hold");
    }
    notice("review-result", item.review.explanation, "pass");
    completed.add(id);
    saveProgress();
    updateOverview();
    drawNavigation();
    byId("case-done").hidden = false;
    byId("next").disabled = false;
  });
  byId("previous").addEventListener("click", () => {
    if (index > 0) openCase(chapter, index - 1);
    else openCase(chapter - 1, exercises[chapter - 1].length - 1);
  });
  byId("next").addEventListener("click", () => {
    if (index < exercises[chapter].length - 1) openCase(chapter, index + 1);
    else if (chapter < chapters.length - 1) openCase(chapter + 1, 0);
    else {
      byId("certificate").scrollIntoView();
      if (completed.size === TOTAL) byId("learner").focus({ preventScroll: true });
    }
  });
}

function notice(id, message, tone) {
  const element = byId(id);
  element.textContent = message;
  element.dataset.tone = tone;
}

const routeNodes = ["source", "connect", "gate", "target"];

function point(name) {
  const map = byId("network").getBoundingClientRect();
  const node = byId(`node-${name}`).getBoundingClientRect();
  return { x: node.left - map.left + node.width / 2, y: node.top - map.top + node.height / 2 };
}

function drawWires(version) {
  if (version !== renderVersion) return;
  const wires = byId("wires");
  wires.querySelectorAll("i").forEach((wire, num) => positionWire(wire, num));
  if (wires.childElementCount) return;
  for (let num = 0; num < routeNodes.length - 1; num += 1) {
    const wire = document.createElement("i");
    positionWire(wire, num);
    wires.append(wire);
  }
}

function positionWire(wire, num) {
  const start = point(routeNodes[num]);
  const end = point(routeNodes[num + 1]);
  const x = end.x - start.x;
  const y = end.y - start.y;
  wire.style.left = `${start.x}px`;
  wire.style.top = `${start.y}px`;
  wire.style.width = `${Math.hypot(x, y)}px`;
  wire.style.transform = `rotate(${Math.atan2(y, x)}rad)`;
}

async function movePacket(from, to, packet) {
  if (motionPaused || !packet.animate) return;
  const position = name => {
    const { x, y } = point(name);
    return `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  };
  packet.hidden = false;
  const animation = packet.animate([{ transform: position(from) }, { transform: position(to) }], {
    duration: 640, easing: "cubic-bezier(.24,.75,.3,1)", fill: "none"
  });
  packetAnimations.add(animation);
  try {
    await animation.finished;
  } catch {
    // Motion can be paused or the learner can open a different case.
  } finally {
    packetAnimations.delete(animation);
    packet.hidden = true;
  }
}

async function replayRoute(item, result, version) {
  const packet = byId("packet");
  const wires = [...byId("wires").children];
  const steps = [...byId("checks").children];
  routeNodes.forEach(name => { byId(`node-${name}`).dataset.state = ""; });
  wires.forEach(wire => { wire.className = ""; });
  steps.forEach(step => {
    step.dataset.state = "";
    step.lastElementChild.textContent = "Waiting";
  });
  byId("tunnel-label").textContent = item.vpn === "active" ? "Tunnel active" : item.vpn ? "Checking VPN request" : "Local network path";
  byId("node-source").dataset.state = "pass";
  if (item.vpn === "active") wires[0].className = "protected";
  await movePacket("source", "connect", packet);
  if (version !== renderVersion) return;
  const markChecks = (start, end) => result.checks.slice(start, end).forEach(([, summary, state], pos) => {
    const step = steps[pos + start];
    step.lastElementChild.textContent = summary;
    step.dataset.state = state;
  });
  markChecks(0, 2);
  if (result.stoppedAtGateway) {
    byId("node-connect").dataset.state = "fail";
    byId("tunnel-label").textContent = "Tunnel not established";
    markChecks(2, 4);
    return;
  }
  byId("node-connect").dataset.state = "pass";
  wires[0].className = result.tunnel ? "protected" : "traversed";
  if (result.tunnel) byId("tunnel-label").textContent = "Protected tunnel ends at gateway";
  await movePacket("connect", "gate", packet);
  if (version !== renderVersion) return;
  wires[1].className = "traversed";
  markChecks(2, 4);
  byId("node-gate").dataset.state = resultStyles[result.outcome];
  if (result.outcome !== 0) return;
  await movePacket("gate", "target", packet);
  if (version !== renderVersion) return;
  wires[2].className = "traversed";
  byId("node-target").dataset.state = "pass";
}

function showAccessResult(item, result) {
  const stamp = new Date().toLocaleTimeString();
  const connection = item.vpn ? (result.tunnel ? "Protected link active" : "Tunnel unavailable") : "Local path";
  const profile = policies[item.source];
  const person = item.identity === false ? "Unverified requester" : profile.person;
  const deviceStatus = item.source === "guest" ? "Guest device" : item.device === false ? "Out of policy" : "Registered device";
  const device = `${item.deviceName || profile.device} · ${deviceStatus}`;
  const evidence = byId("evidence");
  evidence.innerHTML = `<div class="result-heading"><span class="result-tag ${resultStyles[result.outcome]}">${resultLabels[result.outcome]}</span><p>${result.decision}</p></div>
    <h4>Remote and local access log</h4>
    <dl class="event-log"><div><dt>Time</dt><dd>${stamp}</dd></div><div><dt>Requester</dt><dd>${person}</dd></div>
    <div><dt>Device</dt><dd>${device}</dd></div><div><dt>Target</dt><dd>${resources[item.resource].label}</dd></div>
    <div><dt>Connection</dt><dd>${connection}</dd></div><div><dt>Decision</dt><dd>${resultLabels[result.outcome]}</dd></div></dl>`;
  evidence.hidden = false;
}

function showTests(item, selected) {
  const evidence = byId("evidence");
  const passes = item.tests.every(test => test.pass[selected]);
  evidence.innerHTML = `<h4>Validation results</h4><p>${item.options[selected]}</p>
    <ul class="test-results">${item.tests.map((test, pos) => `<li style="--step:${pos}"><span>${test.label}</span><b class="result-tag ${test.pass[selected] ? "pass" : "fail"}">${test.pass[selected] ? "Pass" : "Fail"}</b></li>`).join("")}</ul>`;
  evidence.hidden = false;
  return passes;
}

byId("resume").addEventListener("click", () => {
  for (let group = 0; group < exercises.length; group += 1) {
    const first = exercises[group].findIndex((_, pos) => !completed.has(`${group}:${pos}`));
    if (first >= 0) {
      openCase(group, first, false);
      byId("workbench").scrollIntoView();
      byId("work-title").focus({ preventScroll: true });
      return;
    }
  }
  byId("certificate").scrollIntoView();
  byId("learner").focus({ preventScroll: true });
});

byId("reset").addEventListener("click", () => {
  if (!window.confirm("Clear the completed challenges saved in this browser?")) return;
  completed.clear();
  saveProgress();
  openCase(0, 0);
});

byId("cert-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = byId("learner").value.trim();
  if (!name || completed.size !== TOTAL) {
    byId("learner").focus();
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1500;
  canvas.height = 930;
  const context = canvas.getContext("2d");
  context.fillStyle = "#102b34";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#67e4b6";
  context.lineWidth = 4;
  context.strokeRect(42, 42, 1416, 846);
  context.textAlign = "center";
  function line(value, y, font, colour) {
    context.fillStyle = colour;
    context.font = font;
    context.fillText(value, 750, y, 1270);
  }
  line("HARBORLINE NETWORK TRAINING", 151, "bold 30px system-ui", "#8defcd");
  line("Certificate of Completion", 274, "bold 75px system-ui", "#ffffff");
  line("Awarded to", 362, "30px system-ui", "#c1d6d9");
  line(name, 478, "bold 88px system-ui", "#ffffff");
  line("Secure Network Access Lab", 611, "bold 46px system-ui", "#8defcd");
  line("VPN • Segmentation • Zero Trust • Network Hardening", 669, "31px system-ui", "#d5e6e8");
  line(`25 challenges completed · ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`, 805, "28px system-ui", "#c1d6d9");
  const link = document.createElement("a");
  link.download = "Harborline-Certificate.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

render();
