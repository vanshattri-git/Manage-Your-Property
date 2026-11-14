const CITIES = [
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { name: "Delhi", state: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { name: "Gurugram", state: "Haryana", lat: 28.4595, lng: 77.0266 },
  { name: "Noida", state: "Uttar Pradesh", lat: 28.5355, lng: 77.391 },
  { name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { name: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
  { name: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { name: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
  { name: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { name: "Dehradun", state: "Uttarakhand", lat: 30.3165, lng: 78.0322 },
];
const state = { user: null, properties: [], leads: [], page: "dashboard", propertyQuery: "", propertyType: "all", propertyCity: "all", propertyStatus: "all", leadQuery: "", leadStatus: "all", mapCity: "India", mapPlots: false, pinCoords: null, map: null, markers: [], selectedImage: "" };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const icon = (name, extra) => '<svg class="icon ' + (extra || "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
const formatNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
function money(value, intent) {
  const amount = Number(value || 0);
  if (intent === "rent") return "₹" + formatNumber.format(amount) + " / month";
  if (amount >= 10000000) return "₹" + Number((amount / 10000000).toFixed(amount < 100000000 ? 2 : 1)) + " Cr";
  if (amount >= 100000) return "₹" + Number((amount / 100000).toFixed(amount < 10000000 ? 1 : 0)) + " L";
  return "₹" + formatNumber.format(amount);
}
function dateText(value) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value || Date.now())); }
function ageText(value) {
  const diff = Math.max(0, Date.now() - new Date(value || Date.now()).getTime());
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + " min ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + " hr ago";
  return dateText(value);
}
function categoryText(category) {
  return ({ plot: "Plot", land: "Land", apartment: "Apartment", villa: "Independent home", "builder-floor": "Builder floor", office: "Office", shop: "Retail" })[category] || "Property";
}
function initials(name) { return String(name || "").trim().split(/\s+/).map((part) => part[0] || "").join("").slice(0, 2).toUpperCase(); }
function cityInfo(name) { return CITIES.find((city) => city.name === name) || CITIES[0]; }
function nearestCity(point) {
  if (!point) return null;
  let closest = null;
  CITIES.forEach((city) => {
    const dy = city.lat - point.lat;
    const dx = (city.lng - point.lng) * Math.cos(point.lat * Math.PI / 180);
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (!closest || distance < closest.distance) closest = { city: city, distance: distance };
  });
  return closest && closest.distance < 1.8 ? closest.city : null;
}
function notify(message) {
  const host = $("#toast-region");
  host.innerHTML = '<div class="toast">' + icon("check") + '<span>' + esc(message) + "</span></div>";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { host.innerHTML = ""; }, 3000);
}
async function request(path, options) {
  const settings = Object.assign({ method: "GET", credentials: "same-origin", headers: {} }, options || {});
  if (settings.body && typeof settings.body !== "string") {
    settings.headers["Content-Type"] = "application/json";
    settings.body = JSON.stringify(settings.body);
  }
  const response = await fetch(path, settings);
  let body = {};
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) {
    const error = new Error(body.error || "Could not complete the request.");
    error.status = response.status;
    throw error;
  }
  return body;
}
function renderAuth(mode, message) {
  const signup = mode === "register";
  $("#app-shell").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
  $("#auth-screen").innerHTML = '<div class="auth-layout"><section class="auth-visual"><a class="brand" href="#"><span class="brand-mark">' + icon("mark") + '</span><span class="brand-name">terra<span>.</span><small>PROPERTY DESK</small></span></a><div class="auth-message"><div class="eyebrow">A calmer way to manage property</div><h1>Your property work, in one clear place.</h1><p>Keep listings, plots and buyer enquiries together. Sign in from any visit and pick up where you left off.</p></div><div class="auth-benefits"><div class="auth-benefit">' + icon("check") + '<span>One account for your full property desk</span></div><div class="auth-benefit">' + icon("check") + '<span>Listings stay saved to your account</span></div><div class="auth-benefit">' + icon("check") + '<span>Private access protected by your password</span></div></div><div class="auth-visual-foot">Terra Property Desk · India</div></section><section class="auth-form-side"><div class="auth-form"><div class="eyebrow">YOUR WORKSPACE</div><h2>' + (signup ? "Create your account" : "Welcome back") + '</h2><p class="intro">' + (signup ? "Use your mobile number to create a private property workspace." : "Sign in with the mobile number linked to your account.") + '</p><div class="auth-switch"><button type="button" data-auth-mode="login" class="' + (signup ? "" : "active") + '">Sign in</button><button type="button" data-auth-mode="register" class="' + (signup ? "active" : "") + '">Create account</button></div><form id="auth-form" class="stack-form">' + (signup ? '<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" required maxlength="80" placeholder="Name or agency contact"></div>' : "") + '<div class="field"><label for="auth-phone">Mobile number</label><input id="auth-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+91 98765 43210" value="' + esc($("#auth-phone") ? $("#auth-phone").value : "") + '"><span class="field-hint">Use the same number each time to reopen your account.</span></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="' + (signup ? "new-password" : "current-password") + '" required minlength="8" maxlength="128" placeholder="At least 8 characters"></div><div id="auth-error" class="auth-error" role="alert">' + esc(message || "") + '</div><button class="button button-primary button-wide" type="submit">' + (signup ? "Create account" : "Sign in") + '</button></form><p class="auth-footnote">Your password is stored as a secure hash. Your listings and enquiries are visible only after you sign in.</p></div></section></div>';
  $$('[data-auth-mode]').forEach((button) => button.addEventListener("click", () => renderAuth(button.dataset.authMode)));
  $("#auth-form").addEventListener("submit", submitAuth);
  $("#auth-phone").focus({ preventScroll: true });
}
async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const isCreate = Boolean(form.elements.name);
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = isCreate ? "Creating account…" : "Signing in…";
  try {
    const result = await request(isCreate ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: { name: values.get("name"), phone: values.get("phone"), password: values.get("password") } });
    await openWorkspace(result.user);
    location.hash = "dashboard";
  } catch (error) {
    const errorNode = $("#auth-error");
    if (errorNode) errorNode.textContent = error.message;
    button.disabled = false;
    button.textContent = isCreate ? "Create account" : "Sign in";
  }
}
async function openWorkspace(user) {
  state.user = user;
  const data = await request("/api/bootstrap");
  state.user = data.user;
  state.properties = data.properties || [];
  state.leads = data.leads || [];
  $("#auth-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#workspace-name").textContent = state.user.name;
  $("#workspace-mobile").textContent = state.user.phone;
  $("#workspace-initial").textContent = initials(state.user.name) || "T";
  updateCounts();
  renderPage(location.hash.replace("#", "") || "dashboard");
}
function updateCounts() {
  $("#property-count").textContent = state.properties.length;
  $("#lead-count").textContent = state.leads.filter((lead) => lead.status !== "Closed").length;
}
async function start() {
  try {
    const session = await request("/api/session");
    if (session.user) await openWorkspace(session.user);
    else renderAuth("login");
  } catch (error) { renderAuth("login", "The workspace could not connect. Refresh the page and try again."); }
}

function statusBadge(value) {
  const key = value === "Review" ? "review" : value === "Paused" ? "paused" : "";
  return '<span class="status-badge ' + key + '">' + esc(value) + "</span>";
}
function propertyById(id) { return state.properties.find((property) => property.id === id); }
function propertyCard(property) {
  const photo = property.image ? '<img src="' + esc(property.image) + '" alt="' + esc(categoryText(property.category) + " in " + property.locality) + '" loading="lazy">' : "";
  const land = ["plot", "land"].includes(property.category);
  return '<article class="property-card"><div class="property-photo">' + photo + '<span class="photo-tag">' + esc(categoryText(property.category).toUpperCase()) + '</span></div><div class="property-info"><div class="property-price">' + esc(money(property.price, property.intent)) + '</div><div class="property-title" title="' + esc(property.title) + '">' + esc(property.title) + '</div><div class="property-location">' + icon("pin", "tiny") + " " + esc(property.locality) + ", " + esc(property.city) + '</div><div class="property-meta"><span><strong>' + formatNumber.format(property.area) + '</strong> sq ft</span><span>' + (land ? esc(property.facing || "Facing not set") : esc((property.bedrooms || 0) + " BHK")) + '</span></div><div class="property-bottom">' + statusBadge(property.status) + '<button class="button button-secondary button-small" data-action="view-property" data-id="' + esc(property.id) + '">Details</button></div></div></article>';
}
function dashboardPage() {
  const published = state.properties.filter((property) => property.status === "Published");
  const open = state.leads.filter((lead) => lead.status !== "Closed");
  const plotCount = state.properties.filter((property) => ["plot", "land"].includes(property.category)).length;
  const needsCall = state.leads.filter((lead) => lead.status === "New").slice(0, 5);
  const recent = state.properties.slice(0, 5);
  const propertyRows = recent.map((property) => '<tr><td><div class="table-name"><strong>' + esc(property.title) + '</strong><small>' + esc(property.locality + ", " + property.city) + '</small></div></td><td>' + esc(money(property.price, property.intent)) + '</td><td>' + statusBadge(property.status) + '</td><td>' + esc(ageText(property.updatedAt)) + '</td><td><button class="inline-button" data-action="view-property" data-id="' + esc(property.id) + '">Open</button></td></tr>').join("");
  const leadItems = needsCall.map((lead) => '<div class="quick-item"><span class="lead-avatar">' + esc(initials(lead.name)) + '</span><span class="quick-copy"><strong>' + esc(lead.name) + '</strong><small>' + esc(lead.intent + " · " + (propertyById(lead.propertyId)?.title || "General enquiry")) + '</small></span><span class="quick-time">' + esc(ageText(lead.created_at)) + '</span></div>').join("");
  const cta = state.properties.length ? '<button class="button button-primary button-small" data-action="add-property">' + icon("plus") + ' Add property</button>' : '<button class="button button-primary button-small" data-action="add-property">' + icon("plus") + ' Add your first property</button>';
  return '<div class="page-heading"><div><div class="eyebrow">' + esc(dateText(Date.now())) + '</div><h1>Overview</h1><p>Keep your listings and buyer enquiries moving.</p></div><div class="heading-actions">' + cta + '</div></div>' +
    '<section class="stats-grid"><div class="stat-card"><div class="stat-label">All properties</div><div class="stat-number">' + state.properties.length + '</div><div class="stat-note">' + published.length + ' published</div></div><div class="stat-card"><div class="stat-label">Plots and land</div><div class="stat-number">' + plotCount + '</div><div class="stat-note">Included in your inventory</div></div><div class="stat-card"><div class="stat-label">Open enquiries</div><div class="stat-number">' + open.length + '</div><div class="stat-note">' + needsCall.length + ' need a first response</div></div><div class="stat-card"><div class="stat-label">Last saved</div><div class="stat-number" style="font-size:16px">' + (state.properties[0] ? esc(dateText(state.properties[0].updatedAt)) : "—") + '</div><div class="stat-note">Changes save to your account</div></div></section>' +
    '<section class="dashboard-grid"><div class="panel"><div class="panel-head"><div><h2>Recently updated properties</h2><div class="panel-subtitle">Your latest listing changes</div></div><button class="panel-link" data-page="properties">All properties →</button></div><div class="panel-body"><div class="table-wrap"><table class="overview-table"><thead><tr><th>Property</th><th>Price</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>' + (propertyRows || '<tr><td colspan="5"><div class="empty-state"><strong>No properties added yet</strong><p>Add your first listing. It will stay in your account when you return.</p><button class="button button-primary button-small" data-action="add-property">Add a property</button></div></td></tr>') + '</tbody></table></div></div></div>' +
    '<div class="panel"><div class="panel-head"><div><h2>Needs a response</h2><div class="panel-subtitle">New enquiries in your inbox</div></div><button class="panel-link" data-page="leads">View inbox →</button></div><div class="panel-body"><div class="quick-list">' + (leadItems || '<div class="empty-state"><strong>No new enquiries</strong><p>New enquiries will appear here.</p></div>') + '</div></div></div></section>' +
    '<div class="dashboard-actions"><button class="button button-secondary" data-page="properties">Manage properties</button><button class="button button-secondary" data-page="leads">Open enquiries</button><button class="button button-secondary" data-page="map">Explore India map</button></div>';
}
function getFilteredProperties() {
  const query = state.propertyQuery.trim().toLowerCase();
  return state.properties.filter((property) => {
    const text = [property.title, property.city, property.locality, categoryText(property.category)].join(" ").toLowerCase();
    return (!query || text.includes(query))
      && (state.propertyType === "all" || property.category === state.propertyType)
      && (state.propertyCity === "all" || property.city === state.propertyCity)
      && (state.propertyStatus === "all" || property.status === state.propertyStatus);
  });
}
function propertiesPage() {
  const properties = getFilteredProperties();
  const cityOptions = ['<option value="all">All cities</option>'].concat(CITIES.filter((city) => state.properties.some((property) => property.city === city.name)).map((city) => '<option value="' + esc(city.name) + '" ' + (state.propertyCity === city.name ? "selected" : "") + '>' + esc(city.name) + "</option>")).join("");
  const cards = properties.length ? '<div class="property-grid">' + properties.map(propertyCard).join("") + '</div>' : '<div class="empty-state"><strong>' + (state.properties.length ? "No matching properties" : "Start with your first property") + '</strong><p>' + (state.properties.length ? "Change a filter or clear your search." : "Add one clear listing to get your workspace started.") + '</p><button class="button button-primary button-small" data-action="add-property">' + icon("plus") + ' Add property</button></div>';
  return '<div class="page-heading"><div><div class="eyebrow">INVENTORY</div><h1>Properties</h1><p>Find and update sale, rental, plot and land listings.</p></div><div class="heading-actions"><button class="button button-primary button-small" data-action="add-property">' + icon("plus") + ' Add property</button></div></div>' +
    '<div class="toolbar"><div class="toolbar-group"><input id="property-search" class="input" type="search" placeholder="Search title, locality or city" value="' + esc(state.propertyQuery) + '" aria-label="Search properties"><select id="property-type" class="select" aria-label="Property type"><option value="all">All types</option>' + ["plot", "land", "apartment", "villa", "builder-floor", "office", "shop"].map((type) => '<option value="' + type + '" ' + (state.propertyType === type ? "selected" : "") + '>' + categoryText(type) + "</option>").join("") + '</select><select id="property-city" class="select" aria-label="Filter by city">' + cityOptions + '</select><select id="property-status" class="select" aria-label="Filter by status"><option value="all">All statuses</option><option ' + (state.propertyStatus === "Published" ? "selected" : "") + '>Published</option><option ' + (state.propertyStatus === "Review" ? "selected" : "") + '>Review</option><option ' + (state.propertyStatus === "Paused" ? "selected" : "") + '>Paused</option></select></div></div>' +
    '<div class="result-count">Showing <strong>' + properties.length + '</strong> of ' + state.properties.length + ' properties</div>' + cards;
}
function leadsPage() {
  const all = state.leads.slice().filter((lead) => state.leadStatus === "all" || lead.status === state.leadStatus).filter((lead) => {
    const property = propertyById(lead.property_id);
    return !state.leadQuery || (lead.name + " " + lead.phone + " " + (property?.title || "")).toLowerCase().includes(state.leadQuery.toLowerCase());
  });
  const counts = { all: state.leads.length, New: state.leads.filter((lead) => lead.status === "New").length, Contacted: state.leads.filter((lead) => lead.status === "Contacted").length, "Visit scheduled": state.leads.filter((lead) => lead.status === "Visit scheduled").length, Closed: state.leads.filter((lead) => lead.status === "Closed").length };
  const rows = all.map((lead) => {
    const property = propertyById(lead.property_id);
    return '<tr><td><div class="lead-person"><span class="lead-avatar">' + esc(initials(lead.name)) + '</span><span><strong>' + esc(lead.name) + '</strong><small>' + esc(lead.phone) + '</small></span></div></td><td><div class="table-name"><strong>' + esc(property?.title || "General enquiry") + '</strong><small>' + esc(property ? property.locality + ", " + property.city : "No property selected") + '</small></div></td><td>' + esc(lead.intent) + '</td><td>' + esc(ageText(lead.created_at)) + '</td><td><select class="status-select" data-status="' + esc(lead.status) + '" data-lead-id="' + esc(lead.id) + '" aria-label="Update enquiry status"><option ' + (lead.status === "New" ? "selected" : "") + '>New</option><option ' + (lead.status === "Contacted" ? "selected" : "") + '>Contacted</option><option ' + (lead.status === "Visit scheduled" ? "selected" : "") + '>Visit scheduled</option><option ' + (lead.status === "Closed" ? "selected" : "") + '>Closed</option></select></td></tr>';
  }).join("");
  const tabs = ["all", "New", "Contacted", "Visit scheduled", "Closed"].map((status) => '<button type="button" data-lead-filter="' + status + '" class="' + (state.leadStatus === status ? "active" : "") + '">' + (status === "all" ? "All" : status) + " (" + counts[status] + ")</button>").join("");
  return '<div class="page-heading"><div><div class="eyebrow">FOLLOW UP</div><h1>Enquiries</h1><p>Record buyer details and keep the next step clear.</p></div><div class="heading-actions"><button class="button button-secondary button-small" data-action="export-leads">Export CSV</button><button class="button button-primary button-small" data-action="add-lead">' + icon("plus") + ' Add enquiry</button></div></div>' +
    '<section class="lead-summary"><div class="lead-summary-card"><small>Total enquiries</small><strong>' + counts.all + '</strong></div><div class="lead-summary-card"><small>New</small><strong>' + counts.New + '</strong></div><div class="lead-summary-card"><small>Contacted</small><strong>' + counts.Contacted + '</strong></div><div class="lead-summary-card"><small>Visits arranged</small><strong>' + counts["Visit scheduled"] + '</strong></div></section>' +
    '<div class="panel"><div class="panel-head"><div><h2>Buyer and tenant enquiries</h2><div class="panel-subtitle">Contact information is stored in this private account.</div></div><input id="lead-search" class="input" type="search" placeholder="Search enquiries" aria-label="Search enquiries" value="' + esc(state.leadQuery) + '"></div><div class="panel-body"><div class="lead-tabs">' + tabs + '</div><div class="table-wrap"><table class="lead-table"><thead><tr><th>Person</th><th>Property</th><th>Request</th><th>Received</th><th>Status</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5"><div class="empty-state"><strong>No enquiries in this view</strong><p>Add an enquiry to keep a follow-up record.</p><button class="button button-primary button-small" data-action="add-lead">Add enquiry</button></div></td></tr>') + '</tbody></table></div></div></div>';
}
function mapPage() {
  const options = ['<option value="India" ' + (state.mapCity === "India" ? "selected" : "") + '>All India</option>'].concat(CITIES.map((city) => '<option value="' + esc(city.name) + '" ' + (state.mapCity === city.name ? "selected" : "") + '>' + esc(city.name + ", " + city.state) + "</option>")).join("");
  return '<div class="page-heading"><div><div class="eyebrow">LOCATION</div><h1>India map</h1><p>Explore your listings across Indian cities. Select a marker for details.</p></div><div class="heading-actions"><button class="button button-primary button-small" data-action="add-map-plot">' + icon("plus") + ' Add plot</button></div></div><div class="map-layout"><aside class="map-controls"><h2>Map filters</h2><p>The map starts at India level. Use the city menu or zoom controls to find a listing.</p><label class="map-label" for="map-city-select">City</label><select id="map-city-select" class="select">' + options + '</select><span class="map-label">Listing type</span><div class="map-chips"><button type="button" class="map-chip ' + (state.mapPlots ? "active" : "") + '" data-map-type="plots">Plots and land</button><button type="button" class="map-chip ' + (!state.mapPlots ? "active" : "") + '" data-map-type="all">All listings</button></div><label class="map-label" for="map-locality">Find a locality</label><input id="map-locality" class="input" list="locality-list" placeholder="City or locality"><datalist id="locality-list">' + state.properties.map((property) => '<option value="' + esc(property.locality + ", " + property.city) + '"></option>').join("") + '</datalist><div class="map-count"><span>' + icon("pin") + '</span><div><strong id="map-count-value">' + mapItems().length + '</strong><small>published listings shown</small></div></div></aside><div class="map-canvas"><div class="map-label-overlay"><span id="map-title">' + (state.mapCity === "India" ? "India overview" : esc(state.mapCity)) + '</span><small id="map-subtitle">Property locations from your account</small></div><div id="india-map" class="india-map" aria-label="Interactive map of India"></div><div id="map-message" class="map-disclaimer"></div></div></div><p class="map-disclaimer">Map tiles © OpenStreetMap contributors. New map pins use your selected point; other listings use their saved coordinates.</p>';
}
function mapItems() {
  return state.properties.filter((property) => property.status === "Published" && (state.mapCity === "India" || property.city === state.mapCity) && (!state.mapPlots || ["plot", "land"].includes(property.category)));
}
function renderPage(page) {
  const allowed = ["dashboard", "properties", "leads", "map"];
  state.page = allowed.includes(page) ? page : "dashboard";
  if (state.map) { state.map.remove(); state.map = null; state.markers = []; }
  const names = { dashboard: "Overview", properties: "Properties", leads: "Enquiries", map: "India map" };
  $("#current-section").textContent = names[state.page];
  $$(".nav-item[data-page]").forEach((link) => link.classList.toggle("active", link.dataset.page === state.page));
  const views = { dashboard: dashboardPage, properties: propertiesPage, leads: leadsPage, map: mapPage };
  $("#page-content").innerHTML = views[state.page]();
  $("#page-content").focus({ preventScroll: true });
  if (state.page === "properties") bindPropertyFilters();
  if (state.page === "leads") bindLeadFilters();
  if (state.page === "map") setTimeout(initMap, 80);
}
function navigate(page) { location.hash = page; }
window.addEventListener("hashchange", () => { if (state.user) renderPage(location.hash.slice(1)); });

function bindPropertyFilters() {
  $("#property-search").addEventListener("input", (event) => { state.propertyQuery = event.target.value; const cursor = event.target.selectionStart; renderPage("properties"); const next = $("#property-search"); next.focus(); next.setSelectionRange(cursor, cursor); });
  $("#property-type").addEventListener("change", (event) => { state.propertyType = event.target.value; renderPage("properties"); });
  $("#property-city").addEventListener("change", (event) => { state.propertyCity = event.target.value; renderPage("properties"); });
  $("#property-status").addEventListener("change", (event) => { state.propertyStatus = event.target.value; renderPage("properties"); });
}
function bindLeadFilters() {
  $("#lead-search").addEventListener("input", (event) => { state.leadQuery = event.target.value; const cursor = event.target.selectionStart; renderPage("leads"); const next = $("#lead-search"); next.focus(); next.setSelectionRange(cursor, cursor); });
  $$(".status-select").forEach((select) => select.addEventListener("change", async (event) => {
    try { await request("/api/leads/" + encodeURIComponent(event.target.dataset.leadId), { method: "PATCH", body: { status: event.target.value } }); await refreshWorkspace(); notify("Enquiry status updated."); }
    catch (error) { notify(error.message); }
  }));
}
async function refreshWorkspace() {
  const data = await request("/api/bootstrap");
  state.user = data.user; state.properties = data.properties || []; state.leads = data.leads || [];
  updateCounts();
  renderPage(state.page);
}

function initMap() {
  const node = $("#india-map");
  if (!node) return;
  if (!window.L) { $("#map-message").textContent = "The map needs an internet connection to load. Your saved property data is still available in Properties."; return; }
  state.map = L.map(node, { minZoom: 4, maxZoom: 18, maxBounds: [[5.4, 67.1], [37.8, 98.4]], maxBoundsViscosity: .55 }).setView([22.8, 79.1], 4.6);
  const startingCity = CITIES.find((city) => city.name === state.mapCity);
  if (startingCity) state.map.setView([startingCity.lat, startingCity.lng], 10);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' }).addTo(state.map);
  state.map.on("click", (event) => {
    state.pinCoords = { lat: Number(event.latlng.lat.toFixed(5)), lng: Number(event.latlng.lng.toFixed(5)) };
    state.pinCity = nearestCity(state.pinCoords)?.name || (state.mapCity === "India" ? "" : state.mapCity);
    $("#map-subtitle").textContent = "Plot point selected" + (state.pinCity ? " · near " + state.pinCity : " · choose a city when adding") + " · " + state.pinCoords.lat + ", " + state.pinCoords.lng;
  });
  $("#map-city-select").addEventListener("change", (event) => {
    state.mapCity = event.target.value;
    const city = CITIES.find((item) => item.name === state.mapCity);
    if (city) state.map.setView([city.lat, city.lng], 10, { animate: true });
    else { state.map.setView([22.8, 79.1], 4.6, { animate: true }); state.pinCoords = null; }
    $("#map-title").textContent = state.mapCity === "India" ? "India overview" : state.mapCity + " overview";
    $("#map-subtitle").textContent = "Property locations from your account";
    updateMarkers();
  });
  $("#map-locality").addEventListener("change", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const property = state.properties.find((item) => (item.locality + ", " + item.city).toLowerCase() === query || item.city.toLowerCase() === query);
    if (!property) { if (query) notify("Choose a city or locality from your saved listings."); return; }
    state.mapCity = property.city; $("#map-city-select").value = property.city;
    state.map.setView([property.lat, property.lng], 13, { animate: true });
  });
  $$('[data-map-type]').forEach((button) => button.addEventListener("click", () => {
    state.mapPlots = button.dataset.mapType === "plots";
    $$('[data-map-type]').forEach((item) => item.classList.toggle("active", item === button));
    updateMarkers();
  }));
  updateMarkers();
  setTimeout(() => state.map && state.map.invalidateSize(), 60);
}
function updateMarkers() {
  if (!state.map) return;
  state.markers.forEach((marker) => marker.remove()); state.markers = [];
  const properties = mapItems();
  properties.forEach((property) => {
    const isPlot = ["plot", "land"].includes(property.category);
    const label = isPlot ? "PLOT" : "HOME";
    const markerIcon = L.divIcon({ className: "terra-marker" + (isPlot ? " plot" : ""), html: "<span><i>" + label + "</i></span>", iconSize: [29, 29], iconAnchor: [14, 27], popupAnchor: [0, -25] });
    const marker = L.marker([property.lat, property.lng], { icon: markerIcon }).addTo(state.map);
    marker.bindPopup('<div class="map-popup-title">' + esc(property.title) + '</div><div class="map-popup-detail">' + esc(property.locality + ", " + property.city) + '</div><div class="map-popup-price">' + esc(money(property.price, property.intent)) + '</div>');
    marker.on("click", () => showProperty(property.id));
    state.markers.push(marker);
  });
  const counter = $("#map-count-value"); if (counter) counter.textContent = properties.length;
}

function modal(title, description, body, footer) {
  $("#modal-root").innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>' + title + '</h2><p>' + description + '</p></div><button class="close-button" data-action="close-modal" aria-label="Close">' + icon("close") + '</button></div><div class="modal-body">' + body + '</div><div class="modal-footer"><small>' + (footer || "Your changes are saved to your account.") + '</small><div class="modal-footer-actions"><button class="button button-secondary button-small" data-action="close-modal">Cancel</button><button class="button button-primary button-small" type="submit" form="active-form">Save</button></div></div></div>';
}
function openPropertyForm(property, fromMap) {
  const editing = Boolean(property);
  const current = property || {};
  const chosenCity = current.city || (fromMap && state.pinCoords && !state.pinCity && state.mapCity === "India" ? "" : fromMap && state.pinCity ? state.pinCity : state.mapCity !== "India" ? state.mapCity : CITIES[0].name);
  const coordinates = state.pinCoords || { lat: current.lat || cityInfo(chosenCity).lat, lng: current.lng || cityInfo(chosenCity).lng };
  const cityOptions = (chosenCity ? "" : '<option value="" selected disabled>Select nearest city</option>') + CITIES.map((city) => '<option value="' + esc(city.name) + '" ' + (chosenCity === city.name ? "selected" : "") + '>' + esc(city.name + ", " + city.state) + '</option>').join("");
  const photoLine = '<label class="photo-drop" for="listing-photo">' + icon("plus") + '<span><strong id="photo-label">' + (current.image ? "Keep current photo or choose another" : "Add a cover photo") + '</strong><small>Optional · JPG, PNG or WebP</small></span><input id="listing-photo" type="file" accept="image/jpeg,image/png,image/webp"></label><img id="photo-preview" class="photo-preview" alt="Listing photo preview" style="display:' + (current.image ? "block" : "none") + '" src="' + esc(current.image || "") + '">';
  const body = '<form id="active-form" class="form-grid"><input type="hidden" name="id" value="' + esc(current.id || "") + '"><div class="field full"><label for="listing-title">Property title</label><input id="listing-title" name="title" required maxlength="100" placeholder="A short, clear title" value="' + esc(current.title || "") + '"></div><div class="field"><label for="listing-category">Property type</label><select id="listing-category" name="category"><option value="plot" ' + (current.category === "plot" ? "selected" : "") + '>Plot</option><option value="land" ' + (current.category === "land" ? "selected" : "") + '>Land</option><option value="apartment" ' + (current.category === "apartment" ? "selected" : "") + '>Apartment</option><option value="villa" ' + (current.category === "villa" ? "selected" : "") + '>Independent home</option><option value="builder-floor" ' + (current.category === "builder-floor" ? "selected" : "") + '>Builder floor</option><option value="office" ' + (current.category === "office" ? "selected" : "") + '>Office</option><option value="shop" ' + (current.category === "shop" ? "selected" : "") + '>Retail</option></select></div><div class="field"><label for="listing-intent">Listing goal</label><select id="listing-intent" name="intent"><option value="sale" ' + (current.intent !== "rent" ? "selected" : "") + '>For sale</option><option value="rent" ' + (current.intent === "rent" ? "selected" : "") + '>For rent / lease</option></select></div><div class="field"><label for="listing-city">City</label><select id="listing-city" name="city">' + cityOptions + '</select></div><div class="field"><label for="listing-locality">Locality</label><input id="listing-locality" name="locality" required maxlength="120" placeholder="Neighbourhood or project" value="' + esc(current.locality || "") + '"></div><div class="field"><label for="listing-area">Area (sq ft)</label><input id="listing-area" name="area" type="number" min="1" required placeholder="e.g. 2400" value="' + esc(current.area || "") + '"></div><div class="field"><label for="listing-price">' + (current.intent === "rent" ? "Monthly rent (₹)" : "Asking price (₹)") + '</label><input id="listing-price" name="price" type="number" min="1" required placeholder="Full amount in rupees" value="' + esc(current.price || "") + '"></div><div class="field"><label for="listing-facing">Facing</label><select id="listing-facing" name="facing"><option value="">Not specified</option>' + ["North", "South", "East", "West", "North-East", "South-East", "North-West", "South-West"].map((facing) => '<option ' + (current.facing === facing ? "selected" : "") + '>' + facing + '</option>').join("") + '</select></div><div class="field"><label for="listing-status">Status</label><select id="listing-status" name="status"><option ' + (current.status === "Published" ? "selected" : "") + '>Published</option><option ' + (current.status === "Review" ? "selected" : "") + '>Review</option><option ' + (current.status === "Paused" ? "selected" : "") + '>Paused</option></select></div><div class="field"><label for="listing-mobile">Contact mobile</label><input id="listing-mobile" name="contactPhone" type="tel" required value="' + esc(current.contactPhone || state.user.phone) + '"><span class="field-hint">Defaults to the mobile number on your account.</span></div><div class="field full"><label for="listing-description">Description <span class="field-hint">(optional)</span></label><textarea id="listing-description" name="description" maxlength="1000" placeholder="Key details for a buyer or tenant">' + esc(current.description || "") + '</textarea></div><div class="field full"><label>Photo</label>' + photoLine + '</div><div class="field"><label for="listing-lat">Map latitude</label><input id="listing-lat" name="lat" type="number" step="0.00001" min="5" max="38" required value="' + esc(coordinates.lat) + '"></div><div class="field"><label for="listing-lng">Map longitude</label><input id="listing-lng" name="lng" type="number" step="0.00001" min="67" max="99" required value="' + esc(coordinates.lng) + '"></div><div class="field full"><div id="form-error" class="form-error" role="alert"></div></div></form>';
  modal(editing ? "Edit property" : fromMap ? "Add a plot" : "Add a property", editing ? "Update the listing details below." : "Add the details buyers ask for most. You can edit them later.", body, "Saved to your account and available after you sign in again.");
  const form = $("#active-form");
  $("#listing-title").focus();
  $("#listing-city").addEventListener("change", (event) => {
    if (state.pinCoords && fromMap) return;
    const info = cityInfo(event.target.value); $("#listing-lat").value = info.lat; $("#listing-lng").value = info.lng;
  });
  $("#listing-intent").addEventListener("change", (event) => { $("label[for='listing-price']").textContent = event.target.value === "rent" ? "Monthly rent (₹)" : "Asking price (₹)"; });
  $("#listing-photo").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    $("#photo-label").textContent = file.name;
    resizeImage(file).then((dataUrl) => { state.selectedImage = dataUrl; $("#photo-preview").src = dataUrl; $("#photo-preview").style.display = "block"; }).catch(() => { $("#form-error").textContent = "This photo could not be opened. Choose a different image."; });
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      title: String(data.get("title")).trim(), category: data.get("category"), intent: data.get("intent"), city: data.get("city"), locality: String(data.get("locality")).trim(),
      price: Number(data.get("price")), area: Number(data.get("area")), status: data.get("status"), facing: data.get("facing"), bedrooms: 0,
      lat: Number(data.get("lat")), lng: Number(data.get("lng")), description: String(data.get("description") || "").trim(), contactPhone: data.get("contactPhone"), image: state.selectedImage || current.image || "",
    };
    const submit = $(".modal-footer [type=submit]"); submit.disabled = true; submit.textContent = "Saving…";
    try {
      if (editing) await request("/api/properties/" + encodeURIComponent(current.id), { method: "PUT", body: payload });
      else await request("/api/properties", { method: "POST", body: payload });
      state.selectedImage = ""; state.pinCoords = null; state.pinCity = null; $("#modal-root").innerHTML = "";
      await refreshWorkspace();
      if (!editing) notify("Property saved to your account."); else notify("Property details updated.");
      if (!editing) { state.propertyQuery = ""; state.propertyType = "all"; state.propertyCity = "all"; state.propertyStatus = "all"; }
      if (fromMap) navigate("map"); else navigate("properties");
    } catch (error) { $("#form-error").textContent = error.message; submit.disabled = false; submit.textContent = "Save"; }
  });
}
function openLeadForm(propertyId) {
  const options = ['<option value="">General enquiry</option>'].concat(state.properties.map((property) => '<option value="' + esc(property.id) + '" ' + (property.id === propertyId ? "selected" : "") + '>' + esc(property.title) + '</option>')).join("");
  const body = '<form id="active-form" class="form-grid"><div class="field"><label for="lead-name">Name</label><input id="lead-name" name="name" required maxlength="80" placeholder="Buyer or tenant name"></div><div class="field"><label for="lead-phone">Mobile number</label><input id="lead-phone" name="phone" type="tel" required placeholder="+91 98765 43210"></div><div class="field full"><label for="lead-property">Property</label><select id="lead-property" name="propertyId">' + options + '</select></div><div class="field full"><label for="lead-intent">Enquiry type</label><select id="lead-intent" name="intent"><option>More information</option><option>Site visit</option><option>Price details</option><option>Availability</option><option>Rental viewing</option></select></div><div class="field full"><div id="form-error" class="form-error" role="alert"></div></div></form>';
  modal("Add an enquiry", "Save the contact and request so you can follow up later.", body, "Enquiry details are private to your account.");
  $("#lead-name").focus();
  $("#active-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const data = new FormData(form); const button = $(".modal-footer [type=submit]"); button.disabled = true; button.textContent = "Saving…";
    try {
      await request("/api/leads", { method: "POST", body: { name: String(data.get("name")).trim(), phone: data.get("phone"), propertyId: data.get("propertyId") || null, intent: data.get("intent"), source: "Workspace" } });
      $("#modal-root").innerHTML = ""; await refreshWorkspace(); navigate("leads"); notify("Enquiry saved.");
    } catch (error) { $("#form-error").textContent = error.message; button.disabled = false; button.textContent = "Save"; }
  });
}
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob || blob.size > 950000) { resolve(canvas.toDataURL("image/jpeg", .58)); return; }
          const encoded = new FileReader(); encoded.onerror = reject; encoded.onload = () => resolve(encoded.result); encoded.readAsDataURL(blob);
        }, "image/jpeg", .72);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function openAccountForm() {
  const body = '<form id="active-form" class="form-grid"><div class="field full"><label for="account-name">Name</label><input id="account-name" name="name" value="' + esc(state.user.name) + '" required maxlength="80"></div><div class="field full"><label for="account-phone">Account mobile</label><input id="account-phone" name="phone" type="tel" value="' + esc(state.user.phone) + '" required><span class="field-hint">This unique mobile number is used to sign in. Updating it also updates listing contacts that use your account number.</span></div><div class="field full"><div id="form-error" class="form-error" role="alert"></div></div></form>';
  modal("Account settings", "Update the name or mobile number connected to your workspace.", body, "Use this number with your password next time you sign in.");
  $("#active-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const button = $(".modal-footer [type=submit]"); button.disabled = true; button.textContent = "Saving…";
    try {
      const result = await request("/api/me", { method: "PATCH", body: { name: data.get("name"), phone: data.get("phone") } });
      state.user = result.user; $("#workspace-name").textContent = state.user.name; $("#workspace-mobile").textContent = state.user.phone; $("#workspace-initial").textContent = initials(state.user.name);
      $("#modal-root").innerHTML = ""; await refreshWorkspace(); notify("Account details updated.");
    } catch (error) { $("#form-error").textContent = error.message; button.disabled = false; button.textContent = "Save"; }
  });
}
function showProperty(id) {
  const property = propertyById(id); if (!property) return;
  const photo = property.image ? '<img class="drawer-image" src="' + esc(property.image) + '" alt="' + esc(property.title) + '">' : '<div class="drawer-image"></div>';
  $("#drawer-root").innerHTML = '<aside class="drawer" role="dialog" aria-modal="true" aria-label="Property details"><div class="drawer-image-wrap">' + photo + '<button class="close-button" data-action="close-drawer" aria-label="Close">' + icon("close") + '</button></div><div class="drawer-content"><div>' + statusBadge(property.status) + '</div><h2>' + esc(property.title) + '</h2><div class="drawer-location">' + esc(property.locality + ", " + property.city + " · " + cityInfo(property.city).state) + '</div><div class="drawer-price">' + esc(money(property.price, property.intent)) + '<small>' + (property.intent === "rent" ? "monthly" : "asking price") + '</small></div><div class="drawer-facts"><div><small>Type</small><strong>' + esc(categoryText(property.category)) + '</strong></div><div><small>Area</small><strong>' + formatNumber.format(property.area) + ' sq ft</strong></div><div><small>Contact mobile</small><strong>' + esc(property.contactPhone) + '</strong></div></div><div class="drawer-section-title">Property details</div><div class="drawer-copy">' + esc(property.description || "No description added.") + '</div><div class="contact-card"><span><strong>Listing contact</strong><small>' + esc(state.user.name) + '</small></span><a class="button button-secondary button-small" href="tel:' + esc(property.contactPhone) + '">' + icon("phone") + ' Call</a></div><div class="drawer-actions"><button class="button button-primary" data-action="add-lead-for-property" data-id="' + esc(property.id) + '">' + icon("plus") + ' Add enquiry</button><button class="button button-secondary" data-action="edit-property" data-id="' + esc(property.id) + '">' + icon("edit") + ' Edit</button></div><div class="drawer-actions"><button class="button button-secondary" data-action="toggle-property" data-id="' + esc(property.id) + '">' + (property.status === "Paused" ? "Publish listing" : "Pause listing") + '</button><button class="button button-danger" data-action="delete-property" data-id="' + esc(property.id) + '">' + icon("trash") + ' Delete</button></div></div></aside>';
}

function exportCsv(kind) {
  const leads = kind === "leads";
  const header = leads ? ["Name", "Mobile", "Property", "Request", "Status", "Received"] : ["Title", "Type", "Goal", "Locality", "City", "Price INR", "Area sqft", "Status", "Contact mobile"];
  const rows = leads ? state.leads.map((lead) => [lead.name, lead.phone, propertyById(lead.property_id)?.title || "", lead.intent, lead.status, dateText(lead.created_at)]) : state.properties.map((property) => [property.title, categoryText(property.category), property.intent, property.locality, property.city, property.price, property.area, property.status, property.contactPhone]);
  const csv = [header].concat(rows).map((row) => row.map((value) => '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"').join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "terra-" + kind + "-" + new Date().toISOString().slice(0, 10) + ".csv"; anchor.click(); URL.revokeObjectURL(url);
  notify((leads ? "Enquiries" : "Properties") + " exported as CSV.");
}
async function handleAction(action, id) {
  if (action === "add-property") { state.pinCoords = null; state.pinCity = null; state.selectedImage = ""; openPropertyForm(null, false); }
  if (action === "add-map-plot") { if (!state.pinCoords) { state.pinCity = state.mapCity === "India" ? CITIES[0].name : state.mapCity; state.pinCoords = cityInfo(state.pinCity); } state.selectedImage = ""; openPropertyForm(null, true); }
  if (action === "view-property") showProperty(id);
  if (action === "edit-property") { $("#drawer-root").innerHTML = ""; state.selectedImage = ""; openPropertyForm(propertyById(id), false); }
  if (action === "add-lead") openLeadForm("");
  if (action === "add-lead-for-property") { $("#drawer-root").innerHTML = ""; openLeadForm(id); }
  if (action === "account") openAccountForm();
  if (action === "close-modal") $("#modal-root").innerHTML = "";
  if (action === "close-drawer") $("#drawer-root").innerHTML = "";
  if (action === "export-leads") exportCsv("leads");
  if (action === "export-properties") exportCsv("properties");
  if (action === "toggle-property") {
    const property = propertyById(id); if (!property) return;
    try {
      await request("/api/properties/" + encodeURIComponent(id), { method: "PUT", body: Object.assign({}, property, { status: property.status === "Paused" ? "Published" : "Paused" }) });
      $("#drawer-root").innerHTML = ""; await refreshWorkspace(); notify("Property status updated.");
    } catch (error) { notify(error.message); }
  }
  if (action === "delete-property") {
    const property = propertyById(id); if (!property || !window.confirm("Delete “" + property.title + "” from this account?")) return;
    try { await request("/api/properties/" + encodeURIComponent(id), { method: "DELETE" }); $("#drawer-root").innerHTML = ""; await refreshWorkspace(); notify("Property deleted."); }
    catch (error) { notify(error.message); }
  }
  if (action === "logout") {
    try { await request("/api/auth/logout", { method: "POST" }); } catch (error) { console.warn(error); }
    state.user = null; state.properties = []; state.leads = []; $("#drawer-root").innerHTML = ""; $("#modal-root").innerHTML = ""; renderAuth("login");
  }
}

document.addEventListener("click", (event) => {
  const page = event.target.closest("[data-page]");
  if (page) { event.preventDefault(); navigate(page.dataset.page); return; }
  const mode = event.target.closest("[data-auth-mode]");
  if (mode) { renderAuth(mode.dataset.authMode); return; }
  const mapType = event.target.closest("[data-map-type]");
  if (mapType && state.page === "map") { state.mapPlots = mapType.dataset.mapType === "plots"; $$('[data-map-type]').forEach((button) => button.classList.toggle("active", button === mapType)); updateMarkers(); return; }
  const filter = event.target.closest("[data-lead-filter]");
  if (filter) { state.leadStatus = filter.dataset.leadFilter; renderPage("leads"); return; }
  const action = event.target.closest("[data-action]");
  if (action) { event.preventDefault(); handleAction(action.dataset.action, action.dataset.id || ""); return; }
  if (event.target.classList.contains("modal-root")) event.target.innerHTML = "";
  if (event.target.classList.contains("drawer-root")) event.target.innerHTML = "";
});
document.addEventListener("input", (event) => {
  if (event.target.id === "global-search") {
    state.propertyQuery = event.target.value;
    if (state.page !== "properties") navigate("properties"); else renderPage("properties");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { $("#modal-root").innerHTML = ""; $("#drawer-root").innerHTML = ""; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#global-search").focus(); }
});

start();
