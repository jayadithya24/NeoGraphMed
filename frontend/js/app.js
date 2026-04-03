window.addEventListener("unhandledrejection", e => {
  console.error("❌ UNHANDLED PROMISE:", e.reason);
  console.trace("STACK TRACE");
});


let graphNodes = [];
let graphLinks = [];
let node;
let link;
let label;
let linkLabel;
let simulation;
let svg;
let g;
let zoom;
let container;   // ✅ ADD THIS

// =========================
// 🔧 SAFE STRING NORMALIZER
// =========================
function normalize(v) {
  return String(v || "").trim().toLowerCase();
}


window.safeFindNode = function (name) {
  const n = graphNodes.find(
    d => normalize(d.id) === normalize(name) ||
         normalize(d.name) === normalize(name)
  );

  if (!n) {
    console.warn("⚠ Ignored auto-search for missing node:", name);
    return null; // ⛔ NEVER THROW
  }

  return n;
};





console.log("✅ app.js loaded");


const NODE_COLORS = {
  Patient: "#22c55e",   // green
  Disease: "#ef4444",   // red
  Drug: "#3b82f6",      // blue
  Gene: "#a855f7",      // purple
  Symptom: "#f97316"    // orange
};


import { addPatient, linkPatientDisease, getPatientInsights } from "./api.js";
import { state } from "./state.js";
// -----------------------------
// Imports
// -----------------------------
import {
  dashboardView,
  graphView,
  addPatientView,
  linkDiseaseView,
  searchView,
  importCSVView,
  riskView
} from "./components.js";


// -----------------------------
// App root
// -----------------------------
const app = document.getElementById("app");

// -----------------------------
// Initial load (VERY IMPORTANT)
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔥 DOMContentLoaded fired");
  app.innerHTML = dashboardView();
  console.log("🔥 Dashboard HTML injected");
});

function resetGraphState() {
  console.log("🧹 HARD resetting graph state");

  // 🛑 Stop simulation completely
  if (simulation) {
    simulation.stop();
    simulation = null;
  }

  // 🧨 Remove SVG completely (not just contents)
  d3.selectAll("svg#graphSvg").remove();

  // 🔄 Reset all references
  graphNodes = [];
  graphLinks = [];
  node = null;
  link = null;
  label = null;
  linkLabel = null;
  g = null;
  svg = null;
  zoom = null;
}




// -----------------------------
// Header navigation (data-view)
// -----------------------------



// --------------------
// View loader
// --------------------
function loadView(view) {

  // 🔄 ALWAYS RESET LAYOUT FIRST
  app.classList.remove("full-width");
  app.classList.remove("centered");

  // =========================
  // DASHBOARD
  // =========================
  if (view === "dashboard") {
    app.innerHTML = dashboardView();
    app.classList.add("centered");
    return;
  }

  // =========================
  // GRAPH VIEW
  // =========================
  if (view === "graph") {

  // 🧨 HARD REMOVE ANY OLD GRAPHS
  document.querySelectorAll("svg#graphSvg").forEach(svg => svg.remove());

  app.innerHTML = graphView();
  app.classList.add("full-width");

  setTimeout(() => {
  loadGraph();
}, 0);


  return;
}


  // =========================
  // ADD PATIENT
  // =========================
  if (view === "add") {
    app.innerHTML = addPatientView();
    app.classList.add("centered");
    return;
  }

  // =========================
  // LINK DISEASE
  // =========================
  if (view === "link") {
    app.innerHTML = linkDiseaseView();
    app.classList.add("centered");
    return;
  }

  // =========================
  // PATIENT INSIGHTS
  // =========================
  if (view === "search") {
    app.innerHTML = searchView();
    app.classList.add("centered");
    return;
  }

  // =========================
  // IMPORT CSV
  // =========================
  if (view === "import") {
    app.innerHTML = importCSVView();
    app.classList.add("centered");
    return;
  }

  // =========================
  // RISK VIEW
  // =========================
  if (view === "risk") {
    app.innerHTML = riskView();
    app.classList.add("centered");
    return;
  }
}


window.loadView = loadView;


  /* ================================
     RESET VISUAL STATE
  ================================ */
  /*function resetView() {
    node.style("opacity", 1);
    text.style("opacity", 1);
    link.style("opacity", 1);
    linkLabel.style("opacity", 1);
  }

   ================================
     EGO GRAPH HIGHLIGHT (STABLE)
  ================================ 
  function highlightEgo(focusNode) {
  if (!focusNode) return;

  // 1️⃣ Reset visibility
  node.style("opacity", 1);
  text.style("opacity", 1);
  link.style("opacity", 1);
  linkLabel.style("opacity", 1);

  const neighborIds = new Set();
  neighborIds.add(focusNode.id);

  const focusName = (focusNode.name || "").toLowerCase();

  // 2️⃣ Collect neighbors (ID OR NAME match)
  data.links.forEach(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;

    const sNode = typeof l.source === "object" ? l.source : null;
    const tNode = typeof l.target === "object" ? l.target : null;

    if (
      s === focusNode.id ||
      (sNode && sNode.name && sNode.name.toLowerCase() === focusName)
    ) {
      neighborIds.add(t);
    }

    if (
      t === focusNode.id ||
      (tNode && tNode.name && tNode.name.toLowerCase() === focusName)
    ) {
      neighborIds.add(s);
    }
  });

  // 3️⃣ Fade non-neighbors
  node.style("opacity", d =>
    neighborIds.has(d.id) ? 1 : 0.25
  );

  text.style("opacity", d =>
    neighborIds.has(d.id) ? 1 : 0.25
  );

  link.style("opacity", l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    return neighborIds.has(s) && neighborIds.has(t) ? 1 : 0.25;
  });

  linkLabel.style("opacity", l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    return neighborIds.has(s) && neighborIds.has(t) ? 1 : 0.25;
  });

  // 4️⃣ Compact ego layout
  simulation.force("link").distance(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    return s === focusNode.id || t === focusNode.id ? 60 : 140;
  });

  simulation.alpha(0.7).restart();
}


  /* ================================
     NODE DETAILS PANEL
  ================================ */
  /*function showNodeDetails(nodeData) {
    const panel = document.getElementById("details-panel");
    if (!panel) return;

    let html = `<h3>${nodeData.label}</h3><p><strong>${nodeData.name || nodeData.pid || nodeData.id}</strong></p><ul>`;

    data.links.forEach(l => {
      if (l.source.id === nodeData.id) {
        html += `<li>${l.type} → ${l.target.name || l.target.pid || l.target.id}</li>`;
      }
      if (l.target.id === nodeData.id) {
        html += `<li>${l.type} ← ${l.source.name || l.source.pid || l.source.id}</li>`;
      }
    });

    html += "</ul>";
    panel.innerHTML = html;
  }*/

  /* ================================
     SEARCH (FIND BUTTON)
  ================================ */


  



document.addEventListener("click", async (e) => {
  console.log("🖱 Clicked:", e.target.id);
 
    // 🌐 SPA NAVIGATION (data-view buttons)
  const navBtn = e.target.closest("button[data-view]");
  if (navBtn) {
    const view = navBtn.dataset.view;
    console.log("➡️ Navigating to view:", view);
    loadView(view);
    return;
  }


     // ========================
  // 👥 FIND SIMILAR PATIENTS
  // ========================
  if (e.target.id === "similarBtn") {

  if (!graphNodes || graphNodes.length === 0) {
    alert("Please load the graph first");
    return;
  }

  const pid = document.getElementById("nodeSearch")?.value.trim();

if (!pid) {
  alert("Please enter a Patient ID (e.g., Ravi, P1)");
  return;
}

  if (!pid) {
    document.getElementById("similarStatus").innerText =
      "⚠ Enter Patient ID in search box";
    return;
  }

  document.getElementById("similarStatus").innerText =
    "Calculating similarity...";

  fetchSimilarPatients(pid);
  return;
}



  if (e.target.id === "resetFilterBtn") {
  if (!node || !link || !label || !linkLabel) {
    alert("Please load the graph first");
    return;
  }

  // 🔄 RESET EVERYTHING — NO DIMMING
  node.style("opacity", 1);
  label.style("opacity", 1);
  link.style("opacity", 1);
  linkLabel.style("opacity", 1);

  document.getElementById("relFilter").value = "";
  console.log("✅ Filter reset (no symptom dimming)");
  return;
}


  if (e.target.id === "cleanLayoutBtn") {


  if (!simulation) {
    alert("Please load the graph first");
    return;
  }

  console.log("🧹 Cleaning layout");

  // release dragged nodes
  graphNodes.forEach(d => {
    d.fx = null;
    d.fy = null;
  });

  // restart physics smoothly
  simulation
    .alpha(0.8)
    .restart();

  return;
}


  if (e.target.id === "clusterPatientsBtn") {

  if (!simulation) {
    alert("Please load the graph first");
    return;
  }

  console.log("🧠 Clustering patients");

  simulation
    .force(
      "x",
      d3.forceX(d => {
        if (d.label === "Patient") return 300;
        if (d.label === "Disease") return 700;
        return 1000;
      }).strength(0.35)
    )
    .force(
      "y",
      d3.forceY(d => {
        if (d.label === "Patient") return 300;
        if (d.label === "Disease") return 500;
        return 400;
      }).strength(0.35)
    )
    .alpha(1)
    .restart();

  return;
}



  if (e.target.id === "resetViewBtn") {

  if (!svg || !g || !zoom) {
    alert("Graph not loaded");
    return;
  }

  console.log("🔄 Reset View (zoom & pan only)");

  // 1️⃣ RESET ONLY ZOOM & PAN (CAMERA RESET)
  svg
    .transition()
    .duration(600)
    .call(zoom.transform, d3.zoomIdentity);

  // 2️⃣ RESET VISIBILITY ONLY
  node.style("opacity", 1);
  link.style("opacity", 1);
  label.style("opacity", 1);
  linkLabel.style("opacity", 1);

  return;
}


  /* =====================================================
     🌐 SPA NAVIGATION USING data-view (TOP PRIORITY)
     (Dashboard buttons + Navbar buttons)
  ===================================================== */
  


  /* ========================
     🔗 LINK DISEASE
  ========================= */
  if (e.target.id === "linkDisease") {

    const pid = document.getElementById("pid")?.value;
    const disease = document.getElementById("disease")?.value;
    const statusEl = document.getElementById("status");

    if (!pid || !disease) {
      alert("Patient ID and Disease are required");
      return;
    }

    statusEl.innerText = "Linking disease...";

    const res = await fetch("http://127.0.0.1:5000/link_patient_disease", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, disease })
    });

    const data = await res.json();
    statusEl.innerText = data.status;
    statusEl.style.color = "green";
    return;
  }

  /* ========================
     🔍 PATIENT INSIGHTS
  ========================= */
if (e.target.id === "searchPatient") {

  const pid = document.getElementById("pid").value;
  const result = document.getElementById("result");
  result.innerText = "Loading...";

  try {
    const res = await fetch(`http://127.0.0.1:5000/patient_insights/${pid}`);
    if (!res.ok) throw new Error();

    const data = await res.json();

    result.innerHTML = `
      <b>Name:</b> ${data.patient_name}<br>
      <b>ID:</b> ${data.patient_id}<br>
      <b>Diseases:</b> ${data.diseases.join(", ") || "None"}<br>
      <b>Drugs:</b> ${data.drugs.join(", ") || "None"}<br>
      <b>Genes:</b> ${data.genes.join(", ") || "None"}
    `;

    // 🔵 OPTIONAL graph highlight
    result.innerHTML += `
  <br><br>
  <button class="graph-btn" onclick="openGraphAndFocus('${pid}')">
  🔍 View in Graph
</button>

`;


  } catch {
    result.innerText = "❌ Error fetching patient insights";
  }

  return;
}

  /* ========================
   📄 CSV FILE NAME DISPLAY (STABLE)
========================= */
if (
  e.target.id === "csvFile" ||
  e.target.classList.contains("file-upload-text") ||
  e.target.closest(".file-upload")
) {

  const input = document.getElementById("csvFile");

  if (input && !input.dataset.listenerAttached) {
    input.dataset.listenerAttached = "true";

    input.addEventListener("change", ev => {
      const label = document.querySelector(".file-upload-text");
      if (label) {
        label.textContent =
          ev.target.files[0]?.name || "📄 Choose CSV file";
      }
    });
  }
}




  /* ========================
     📁 IMPORT CSV
  ========================= */
  if (e.target.id === "uploadCSV") {

    const file = document.getElementById("csvFile")?.files[0];
    if (!file) {
      alert("Please select a CSV file");
      return;
    }

    const form = new FormData();
    form.append("file", file);

    await fetch("http://127.0.0.1:5000/import_csv", {
  method: "POST",
  body: form
});


    document.getElementById("csvStatus").innerText =
      "CSV imported successfully ✅";
    return;
  }



  
  if (e.target.id === "calculateRisk") {
  const pid = document.getElementById("riskPid").value;
  const result = document.getElementById("riskResult");

  if (!pid) {
    result.innerHTML = "❌ Please enter Patient ID";
    return;
  }

  // Dummy logic (replace later with backend)
  const score = Math.floor(Math.random() * 40) + 60;

  result.innerHTML = `
    <b>Patient:</b> ${pid}<br>
    <b>Risk Score:</b> ${score}%<br>
    <b>Status:</b> ${score > 75 ? "High Risk 🔴" : "Moderate Risk 🟡"}
  `;
}


  /* ========================
     🔄 REFRESH GRAPH
  ========================= */
  if (e.target.id === "refreshGraph") {
    console.log("🔄 Refresh Graph clicked");
    loadGraph();
    return;
  }
 
  if (e.target.id === "searchBtn") {
    const value = document.getElementById("searchInput").value.trim();
    if (value) {
      searchNodeAndShowEgo(value);
    }
  }

  // 🔍 GRAPH VIEW SEARCH (THIS IS THE FIX)
if (e.target.id === "graphSearchBtn") {
  const value = document
    .getElementById("graphSearchInput")
    .value
    .trim();

  if (!value) return;

  highlightGraphNode(value);
}

 // 🔍 GRAPH VIEW SEARCH
  if (e.target.id === "findNode") {

  if (!node || !link || !label || graphNodes.length === 0) {
    alert("Please load the graph first");
    return;
  }

  const rawQuery = document
  .getElementById("nodeSearch")
  .value
  .trim();

if (!rawQuery) {
  alert("Please enter a node name (e.g., P1, Fever, Paracetamol)");
  return;
}

const query = normalize(rawQuery);

// ✅ This allows: P1 → Patient:P1
const targetNode = graphNodes.find(n => {
  const id = normalize(n.id);     // patient:p1
  return (
    id === query ||               // exact match
    id.endsWith(":" + query)      // P1 → Patient:P1
  );
});

if (!targetNode) {
  alert("Node not found in graph");
  return;
}


  if (!targetNode) {
    alert("Node not found in graph");
    return;
  }

  // Fade all
  node.style("opacity", 0.15).attr("stroke", null);
  link.style("opacity", 0.05);
  label.style("opacity", 0.15);

  // Highlight selected node
  node
    .filter(d => d.id === targetNode.id)
    .style("opacity", 1)
    .attr("stroke", "#000")
    .attr("stroke-width", 3);

  // Highlight connected links
  link
    .filter(d =>
      d.source.id === targetNode.id ||
      d.target.id === targetNode.id
    )
    .style("opacity", 1)
    .attr("stroke", "#000");

  // Highlight connected nodes
  node
    .filter(d =>
      graphLinks.some(l =>
        (l.source.id === targetNode.id && l.target.id === d.id) ||
        (l.target.id === targetNode.id && l.source.id === d.id)
      )
    )
    .style("opacity", 1);
}


if (e.target.id === "riskBtn") {
  app.innerHTML = riskView();
  app.classList.remove("full-width");
  app.classList.add("centered");
  return;
}


  /* ========================
     ⬅ BACK TO DASHBOARD
  ========================= */
  if (e.target.id === "backDashboard") {
  app.innerHTML = dashboardView();

  // 🔄 RESET LAYOUT STATE COMPLETELY
  app.classList.remove("full-width");
  app.classList.remove("centered");

  return;
}


  /* ========================
   GRAPH TOOLBAR BUTTONS
======================== */


});



async function loadGraph() {
  console.log("🔥 loadGraph called");

  
  // ✅ HARD RESET FIRST
  resetGraphState();

  container = document.getElementById("graph-container");

  

if (!container) {
  console.warn("Graph container not found");
  return;
}

const width = container.clientWidth;
  const height = Math.max(container.clientHeight, 600);
// ❌ Remove any existing SVG (double safety)
container.querySelectorAll("svg").forEach(s => s.remove());

// ✅ Create fresh SVG
svg = d3.select(container)
  .append("svg")
  .attr("id", "graphSvg")
  .attr("data-graph", "main");

// =========================
// 🔒 CLIP GRAPH TO CONTAINER
// =========================
const clipId = "graph-clip";

svg.append("defs")
  .append("clipPath")
  .attr("id", clipId)
  .append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", width)
  .attr("height", height);

  if (svg.empty()) {
    console.warn("Graph SVG not found");
    return;
  }

  // 🔴 FIX 5: SAFETY RESET (CORRECT LOCATION)

  // ✅ SINGLE ROOT GROUP
  g = svg.append("g")
  .attr("class", "graph-root")
  .attr("clip-path", "url(#graph-clip)");



  if (!container || svg.empty()) {
    console.warn("Graph container or SVG not found");
    return;
  }

  


  svg
    .attr("width", width)
    .attr("height", height);


zoom = d3.zoom()
  .scaleExtent([0.4, 4])
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
  });

// attach zoom ONCE
svg.call(zoom);





  // 🔹 Fetch graph data
  const res = await fetch("http://127.0.0.1:5000/graph");
  const data = await res.json();

  console.log("Graph data:", data);
  const nodes = data.nodes;
  const links = data.links;

  // 🧼 CLEAR any pinned positions (fix frozen nodes)
nodes.forEach(n => {
  n.fx = null;
  n.fy = null;
});


  if (!data.nodes || !data.links || data.nodes.length === 0) return;
   
  graphNodes = nodes;
  graphLinks = links;


// =========================
// 🔧 FIX LINK → NODE ID MISMATCH
// =========================
const nodeIdMap = new Map();

// map normalized name → actual node id
// map normalized values → actual node id
nodes.forEach(n => {

  // 1️⃣ From name (Drug:Paracetamol, Patient:P1, etc.)
  if (n.name) {
    const rawName = n.name.includes(":")
      ? n.name.split(":")[1]
      : n.name;

    nodeIdMap.set(normalize(rawName), n.id);
  }

  // 2️⃣ From patient_id (P001, P1, etc.)
  if (n.patient_id) {
    nodeIdMap.set(normalize(n.patient_id), n.id);
  }

});


// rewrite links to use correct node IDs
links.forEach(l => {
  if (typeof l.source === "string") {
    const fixed = nodeIdMap.get(normalize(l.source));
    if (fixed) l.source = fixed;
  }

  if (typeof l.target === "string") {
    const fixed = nodeIdMap.get(normalize(l.target));
    if (fixed) l.target = fixed;
  }
});



  console.log("✅ Graph nodes loaded:", graphNodes.length);
  // =========================
  // FORCE SIMULATION
  // =========================
  simulation = d3.forceSimulation(graphNodes)

    .force(
      "link",
      d3.forceLink(data.links)
        .id(d => d.id)
        .distance(140)
    )
    .force("charge", d3.forceManyBody().strength(-450))
    .force("center", d3.forceCenter(width / 2, height / 2))
    // ❌ REMOVE collision FOR NOW
// .force("collision", d3.forceCollide().radius(d => d.radius + 4));



  // =========================
  // LINKS
  // =========================
  link = g.append("g")
  .selectAll("line")
  .data(data.links, d => {
  const s = d.source.id || d.source;
  const t = d.target.id || d.target;
  return `${s}-${t}-${d.type}`;
})

  .join("line")
  .attr("stroke", "#aaa")
  .attr("stroke-width", 1.4);

linkLabel = g.append("g")
  .selectAll("text")
  .data(data.links, d => {
  const s = d.source.id || d.source;
  const t = d.target.id || d.target;
  return `${s}-${t}-${d.type}`;
})

  .join("text")

  .text(d => d.type)
  .attr("font-size", "9px")
  .attr("fill", "#444")
  .attr("text-anchor", "middle")
  .attr("class", "link-label");


  node = g.append("g")
  .selectAll("circle")
  .data(nodes, d => d.id)   // ✅ KEY FIX
  .join("circle")
  .attr("class", "graph-node")
  
  .attr("r", d => {
  d.radius =
    d.label === "Patient" ? 12 :
    d.label === "Disease" ? 14 :
    d.label === "Drug" ? 13 :
    d.label === "Gene" ? 12 :
    d.label === "Symptom" ? 11 :
    12;
  return d.radius;
})
.attr("fill", d => NODE_COLORS[d.label] || "#64748b")
.attr("stroke", "#ffffff")
.attr("stroke-width", 1.5);

// ✅ NOW radius exists — SAFE to add collision
simulation.force(
  "collision",
  d3.forceCollide().radius(d => d.radius + 6)
);

// 🔄 restart physics so it takes effect
simulation.alpha(1).restart();

// 🔕 DIM SYMPTOM NODES BY DEFAULT (PRESENTATION MODE)
// 🔕 DIM SYMPTOMS BY DEFAULT (NODES + LABELS)
node.style("opacity", d =>
  d.label === "Symptom" ? 0.15 : 1
);




  node
  .on("mouseover", function () {
    d3.select(this)
      .attr("stroke", "#000")
      .attr("stroke-width", 2.5);
  })
  .on("mouseout", function () {
    d3.select(this)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);
  });

  // 🟢 ENABLE NODE DRAGGING
   node.call(
  d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended)
  );


label = g.append("g")
  .selectAll("text")
  .data(nodes, d => d.id)
  .join("text")
  .text(d => {
  // d.name is like "Disease:Fever"
  return d.name.split(":")[1] || d.name;
})

  .attr("font-size", "10px")
  .attr("text-anchor", "middle");

  // ✅ DIM SYMPTOMS BY DEFAULT (SAFE LOCATION)
node.style("opacity", d =>
  d.label === "Symptom" ? 0.15 : 1
);

label.style("opacity", d =>
  d.label === "Symptom" ? 0.15 : 1
);


node.on("click", (event, d) => {
  event.stopPropagation();
  showNodeDetails(d);
});


svg.on("click", () => {
  const panel = document.getElementById("details-panel");
  if (panel) {
    panel.innerHTML = "Click a node to see details";
  }
});


  // =========================
  // NODES
  // =========================
  
  // =========================
  // TICK — KEEP NODES INSIDE BOX
  // =========================
  console.log("node:", node);
console.log("label:", label);
console.log("link:", link);
console.log("linkLabel:", linkLabel);


  simulation.on("tick", () => {

  const padding = 10;

  node
    .attr("cx", d => {
      d.x = Math.max(
        d.radius + padding,
        Math.min(width - d.radius - padding, d.x)
      );
      return d.x;
    })
    .attr("cy", d => {
      d.y = Math.max(
        d.radius + padding,
        Math.min(height - d.radius - padding, d.y)
      );
      return d.y;
    });

  label
    .attr("x", d => d.x)
    .attr("y", d => d.y + d.radius + 10); // 👈 BELOW the node

  link
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  linkLabel
    .attr("x", d => (d.source.x + d.target.x) / 2)
    .attr("y", d => (d.source.y + d.target.y) / 2);
});


// =========================
// 🔽 RELATIONSHIP FILTER
// =========================
const relFilter = document.getElementById("relFilter");

if (relFilter) {
  relFilter.onchange = () => {
    const selectedRel = relFilter.value;

    // 🔁 RESET — SHOW EVERYTHING
    if (!selectedRel) {
      link.style("opacity", 1);
      linkLabel.style("opacity", 1);
      node.style("opacity", 1);
      label.style("opacity", 1);
      return;
    }

    // 🔗 FILTER LINKS
    link.style("opacity", d =>
      d.type === selectedRel ? 1 : 0.05
    );

    linkLabel.style("opacity", d =>
      d.type === selectedRel ? 1 : 0.05
    );

    // 🎯 FIND CONNECTED NODES
    const connectedNodes = new Set();

    graphLinks.forEach(l => {
      if (l.type === selectedRel) {
        connectedNodes.add(l.source.id || l.source);
        connectedNodes.add(l.target.id || l.target);
      }
    });

    // 🟢 SHOW ONLY CONNECTED NODES
    node.style("opacity", d =>
      connectedNodes.has(d.id) ? 1 : 0.1
    );

    label.style("opacity", d =>
      connectedNodes.has(d.id) ? 1 : 0.1
    );
  };
}


  // =========================
  // DRAG FUNCTIONS
  // =========================
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // 🔓 FORCE RESET VISIBILITY AFTER LOAD
setTimeout(() => {
  if (node && link && label && linkLabel) {
    node.style("opacity", 1);
    link.style("opacity", 1);
    label.style("opacity", 1);
    linkLabel.style("opacity", 1);
  }
}, 0);

// 🚫 BLOCK ANY LEGACY AUTO-SEARCH
window.focusNode = () => {};
window.highlightNode = () => {};
window.findNodeByName = () => {};

}


async function fetchSimilarPatients(pid) {
  try {
    const res = await fetch(
      `http://127.0.0.1:5000/similar_patients/${encodeURIComponent(pid)}`
    );
    const data = await res.json();

    const similar = data.similar_patients || [];

    // ✅ MOVE THESE TO THE TOP (FIX)
    const status = document.getElementById("similarStatus");
    const list = document.getElementById("similarList");

    status.innerText = "";
    list.innerHTML = "";

    // ❌ NO SIMILAR PATIENTS
    if (similar.length === 0) {
      alert("No similar patients found for this patient.");
      return;
    }

    // ✅ SHOW SIMILAR PATIENTS
    status.innerText = "Patients with shared diseases:";


    similar.forEach(p => {
      const li = document.createElement("li");
      li.innerText = p;
      //li.onclick = () => searchNodeAndShowEgo(p);
      list.appendChild(li);
    });

    // 🔦 GRAPH HIGHLIGHT
    d3.selectAll(".graph-node")
      .attr("opacity", d => {
        if (d.label !== "Patient") return 0.15;
        if (d.id === pid) return 1;
        if (similar.includes(d.id)) return 1;
        return 0.15;
      })
      .attr("stroke", d =>
        similar.includes(d.id) ? "#f1c40f" : "none"
      )
      .attr("stroke-width", d =>
        similar.includes(d.id) ? 4 : 0
      );

  } catch (err) {
    console.error(err);
    document.getElementById("similarStatus").innerText =
      "Error calculating similarity";
  }
}



function searchNodeAndShowEgo(nodeName) {
  console.log("🔍 Searching for:", nodeName);

  const targetNode = graphNodes.find(n =>
  normalize(n.id) === normalize(nodeName) ||
  normalize(n.name) === normalize(nodeName)
);



  console.log("🔍 Searching for:", nodeName);
  console.log("📦 Graph nodes:", graphNodes.map(n => ({
  id: n.id,
  name: n.name,
  patient_id: n.patient_id
})));



  if (!targetNode) {
  console.warn("⚠ Ignoring ego search for missing node:", nodeName);
  return; // ⛔ SILENT FAIL — NO ERROR, NO PROMISE REJECT
}



  // Collect connected node IDs
  const connectedNodeIds = new Set();
  connectedNodeIds.add(targetNode.id);

  graphLinks.forEach(link => {
    const s = link.source.id || link.source;
    const t = link.target.id || link.target;

    if (s === targetNode.id || t === targetNode.id) {
      connectedNodeIds.add(s);
      connectedNodeIds.add(t);
    }
  });

  // 🔵 Show / hide nodes
  d3.selectAll(".graph-node")
    .attr("opacity", d =>
      connectedNodeIds.has(d.id) ? 1 : 0.1
    );

  // 🔗 Show / hide links
  d3.selectAll("line")
    .attr("opacity", d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return (s === targetNode.id || t === targetNode.id) ? 1 : 0.05;
    });

  // 🏷️ Link labels (if you added them)
  d3.selectAll(".link-label")
    .attr("opacity", d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return (s === targetNode.id || t === targetNode.id) ? 1 : 0.05;
    });

  console.log("✅ Ego network shown for:", targetNode.id);
}

function highlightGraphNode(searchText) {
  const query = searchText.toLowerCase();

  // 1️⃣ Find the target node
  const target = graphNodes.find(n =>
  normalize(n.id) === normalize(searchText) ||
  normalize(n.name) === normalize(searchText)
);


  if (!target) {
    console.log("Node not found:", searchText);
    return;
  }

  // 2️⃣ Collect connected nodes (ego network)
  const connected = new Set();
  connected.add(target.id);

  graphLinks.forEach(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;

    if (s === target.id || t === target.id) {
      connected.add(s);
      connected.add(t);
    }
  });

  // 3️⃣ FADE / HIGHLIGHT NODES (IMPORTANT)
  d3.selectAll(".graph-node")
    .transition()
    .duration(300)
    .attr("opacity", d => connected.has(d.id) ? 1 : 0.1);

  // 4️⃣ FADE / HIGHLIGHT LINKS
  d3.selectAll("line")
    .transition()
    .duration(300)
    .attr("opacity", d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return (connected.has(s) && connected.has(t)) ? 1 : 0.05;
    });

  // 5️⃣ FADE / HIGHLIGHT LINK LABELS (YOU HAVE THESE)
  d3.selectAll(".link-label")
    .transition()
    .duration(300)
    .attr("opacity", d => {
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return (connected.has(s) && connected.has(t)) ? 1 : 0.05;
    });
}

function fadeOtherNodes(focusNode, data, node, link, label) {

  // build neighbor lookup
  const connected = new Set();

  data.links.forEach(l => {
    if (l.source.id === focusNode.id) connected.add(l.target.id);
    if (l.target.id === focusNode.id) connected.add(l.source.id);
  });

  // fade nodes
  node.style("opacity", d =>
    d.id === focusNode.id || connected.has(d.id) ? 1 : 0.15
  );

  // fade labels
  label.style("opacity", d =>
    d.id === focusNode.id || connected.has(d.id) ? 1 : 0.15
  );

  // fade links
  link.style("opacity", l =>
    l.source.id === focusNode.id || l.target.id === focusNode.id ? 1 : 0.1
  );
}

window.submitPatient = async function () {
  const pid = document.getElementById("pid")?.value;
  const name = document.getElementById("name")?.value;
  const age = document.getElementById("age")?.value;
  const gender = document.getElementById("gender")?.value;
  const diseasesRaw = document.getElementById("diseases")?.value || "";
  const notes = document.getElementById("notes")?.value;

  const diseases = diseasesRaw
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  if (!pid || !name) {
    alert("Patient ID and Name are required");
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/add_patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, name, age, gender, notes, diseases })
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data.error || "Failed to add patient";

      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.innerText = message;
        statusEl.style.color = "red";
      }
      return;
    }

const statusEl = document.getElementById("status");
statusEl.innerText = data.status || "Patient added successfully ✅";
statusEl.style.color = "green";

  } catch (err) {
    console.error(err);
    alert("Error adding patient");
  }
};

function showNodeDetails(nodeData) {
  const panel = document.getElementById("details-panel");
  if (!panel) return;

  let html = `
    <h3>${nodeData.label}</h3>
    <p><strong>${nodeData.name || nodeData.pid || nodeData.id}</strong></p>
    <ul>
  `;

  graphLinks.forEach(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;

    if (s === nodeData.id) {
      html += `<li>${l.type} → ${l.target.name || l.target.id}</li>`;
    }
    if (t === nodeData.id) {
      html += `<li>${l.type} ← ${l.source.name || l.source.id}</li>`;
    }
  });

  html += "</ul>";
  panel.innerHTML = html;
}

window.openGraphAndFocus = function (pid) {
  // 🔑 ALWAYS convert to graph node ID
  const graphId = `Patient:${pid}`;

  loadView("graph");

  setTimeout(() => {
    const exists = graphNodes.some(n =>
      normalize(n.id) === normalize(graphId)
    );

    if (!exists) {
      console.warn("❌ Node not in graph:", graphId);
      return;
    }

    searchNodeAndShowEgo(graphId);
  }, 800);
};





