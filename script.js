/* Vastunest Realty: GitHub Pages + Pages CMS project loader. */
const OWNER = "vastunestrealty";
const REPO = "vastunestrealty";
const BRANCH = "main";
const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbwxBbWqX6KkvjD2GoH5ZttK-lxb3JWLf2qCNB-Xk4GOPcv5iF-wbu22PXA9GueDLUdjuw/exec";
const PROJECTS_PATH = "content/projects";
const WHATSAPP_NUMBER = "919699293097";
const OFFICIAL_EMAIL = "official@vastunestrealty.com";
const FALLBACK_PROJECTS = [{
  title: "Yashada Evo, Punawale", slug: "yashada-evo-punawale", location: "Punawale, Pune",
  bhk: "2 BHK, 3 BHK homes", startingPrice: 10000000, propertyType: "Apartment",
  coverImage: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80",
  description: "Explore a contemporary residential address in Punawale. Contact Vastunest Realty for the latest availability, pricing and project details."
}];
let projects = [];
const $ = (selector) => document.querySelector(selector);
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));

function field(project, ...keys) {
  for (const key of keys) {
    const value = project?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}
function money(value) {
  const amount = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  if (amount >= 10000000) {
    const crore = amount / 10000000;
    return `₹${Number.isInteger(crore) ? crore : crore.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} Cr`;
  }
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}
function parseScalar(value) {
  let text = String(value ?? "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1);
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (text.startsWith("[") && text.endsWith("]")) return text.slice(1, -1).split(",").map(parseScalar);
  return text;
}
function parseMarkdown(markdown, filename) {
  const lines = markdown.split(/\r?\n/);
  const data = {};
  let body = markdown;
  if (lines[0]?.trim() === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      body = lines.slice(end + 1).join("\n");
      let activeKey = null;
      for (const line of lines.slice(1, end)) {
        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (match) {
          activeKey = match[1];
          data[activeKey] = parseScalar(match[2]);
        } else if (activeKey && /^\s+-\s+/.test(line)) {
          if (!Array.isArray(data[activeKey])) data[activeKey] = data[activeKey] ? [data[activeKey]] : [];
          data[activeKey].push(parseScalar(line.replace(/^\s+-\s+/, "")));
        }
      }
    }
  }
  data.description = field(data, "description", "summary") || body.replace(/^#+.*$/gm, "").trim().slice(0, 500);
  data.title = field(data, "title", "name") || filename.replace(/\.md$/i, "").replace(/-/g, " ");
  data.slug = data.slug || filename.replace(/\.md$/i, "");
  return data;
}
function normalizeProject(raw) {
  const p = { ...raw };
  p.title = field(raw, "title", "name", "projectName") || "Featured Property";
  p.slug = field(raw, "slug", "projectSlug") || String(p.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  p.location = field(raw, "location", "area", "projectLocation") || "Pune";
  p.bhk = field(raw, "bhk", "configuration", "configurations", "unitType") || "Residential homes";
  p.startingPrice = field(raw, "startingPrice", "starting_price", "price", "displayedPrice");
  p.propertyType = field(raw, "propertyType", "property_type", "type") || "Featured Residence";
  p.coverImage = field(raw, "coverImage", "cover_image", "featured_image", "image", "imageUrl");
  p.developer = field(raw, "developer", "builder", "developerName");
  p.minCarpetArea = field(raw, "minCarpetArea", "min_carpet_area");
  p.maxCarpetArea = field(raw, "maxCarpetArea", "max_carpet_area");
  p.possession = field(raw, "possession", "possessionDate", "possession_date");
  p.status = field(raw, "status", "constructionStatus");
  p.amenities = field(raw, "amenities", "features");
  p.gallery = field(raw, "gallery", "images") || [];
  return p;
}
async function loadProjects() {
  const grid = $("#projectGrid");
  try {
    const endpoint = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PROJECTS_PATH}?ref=${BRANCH}`;
    const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}. Check the repository and ${PROJECTS_PATH} folder.`);
    const listing = await response.json();
    if (!Array.isArray(listing)) throw new Error("GitHub did not return a project file list.");
    const markdownFiles = listing.filter(file => file.type === "file" && file.name.toLowerCase().endsWith(".md"));
    const loaded = await Promise.all(markdownFiles.map(async file => {
      try {
        const fileResponse = await fetch(file.download_url);
        if (!fileResponse.ok) return null;
        return parseMarkdown(await fileResponse.text(), file.name);
      } catch { return null; }
    }));
    const cmsProjects = loaded.filter(project => project && String(project.draft).toLowerCase() !== "true").map(normalizeProject);
    projects = cmsProjects.length ? cmsProjects : FALLBACK_PROJECTS.map(normalizeProject);
    if (!cmsProjects.length) console.info("No published Markdown projects found; showing the starter project.");
  } catch (error) {
    console.warn("Could not load Pages CMS projects:", error.message);
    projects = FALLBACK_PROJECTS.map(normalizeProject);
    if (grid) grid.dataset.loadNote = "fallback";
  }
  populateLocations();
  renderProjects();
}
function populateLocations() {
  const select = $("#locationFilter");
  if (!select) return;
  const current = select.value;
  const locations = [...new Set(projects.map(project => project.location).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All locations</option>' + locations.map(location => `<option value="${safe(location)}">${safe(location)}</option>`).join("");
  select.value = locations.includes(current) ? current : "";
}
function matchesBhk(project, selected) {
  if (!selected) return true;
  return String(project.bhk || "").toLowerCase().includes(selected.toLowerCase());
}
function renderProjects() {
  const grid = $("#projectGrid");
  if (!grid) return;
  const location = $("#locationFilter")?.value || "";
  const bhk = $("#bhkFilter")?.value || "";
  const budget = $("#budgetFilter")?.value || "";
  const [minimum, maximum] = budget ? budget.split("-").map(Number) : [0, Infinity];
  const filtered = projects.filter(project => {
    const price = Number(project.startingPrice || 0);
    return (!location || project.location === location) && matchesBhk(project, bhk) && (!budget || (price >= minimum && price < maximum));
  });
  const count = $("#resultsCount");
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? "property" : "properties"} to explore`;
  const empty = $("#emptyState");
  if (empty) empty.hidden = filtered.length > 0;
  if (!filtered.length) { grid.innerHTML = ""; return; }
  grid.innerHTML = filtered.map(project => {
    const image = project.coverImage || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80";
    const configuration = Array.isArray(project.bhk) ? project.bhk.join(", ") : project.bhk;
    const price = money(project.startingPrice);
    return `<article class="project-card">
      <div class="project-image"><img src="${safe(image)}" alt="${safe(project.title)}" loading="lazy"><span class="project-tag">${safe(project.propertyType)}</span></div>
      <div class="project-content"><div class="project-location">⌖ ${safe(project.location)}</div><h3>${safe(project.title)}</h3>
        <div class="project-meta"><span>${safe(configuration || "Residential homes")}</span>${project.developer ? `<span>${safe(project.developer)}</span>` : ""}</div>
     <div class="project-bottom">
  <div>
    <span class="price-label">Starting from</span>
    <span class="project-price">${safe(price)}</span>
  </div>
  <div class="project-actions">
    <a href="#project-details" class="card-link" data-project="${safe(project.slug)}">View details ↗</a>
    
    ${(field(project, "brochure", "brochurePdf", "brochureUrl") || project.slug === "yashada-evo-punawale") ? `<a href="#brochure-lead" class="card-link brochure-link" data-brochure="${safe(project.slug)}">Download Brochure PDF ↗</a>` : ""}

  </div>
</div>
</div></article>`;
    }).join("");
    grid.querySelectorAll("[data-project]").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    const project = projects.find(item => item.slug === link.dataset.project);
    if (project) openDetails(project);
  }));
  grid.querySelectorAll("[data-brochure]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();

    const project = projects.find(
      item => item.slug === link.dataset.brochure
    );

    if (project) openBrochureLead(project);
  });
});
  grid.querySelectorAll(".project-image img").forEach(image => image.addEventListener("error", () => {
    image.src = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80";
  }, { once: true }));
}
function openBrochureLead(project) {
  document.querySelector(".detail-modal")?.remove();

  const brochureUrl = field(project, "brochure", "brochurePdf", "brochureUrl") ||
  (project.slug === "yashada-evo-punawale"
    ? "/media/EVO%20Presenter_Digital_Vertical_A3.pdf"
    : "");
  const modal = document.createElement("div");
  modal.className = "detail-modal";

  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <button class="modal-close" type="button" aria-label="Close">×</button>
      <p class="eyebrow">VASTUNEST REALTY</p>
      <h2>Get Your Project Brochure</h2>
      <p>Please share your details to access ${safe(project.title)} brochure.</p>

      <form class="brochure-lead-form">
        <label>Full Name
          <input name="name" type="text" required placeholder="Full name">
        </label>
        <label>Mobile Number
          <input name="mobile" type="tel" required pattern="[+]?[0-9 ]{10,15}" placeholder="Mobile number">
        </label>
        <label>Email Address
          <input name="email" type="email" required placeholder="Email address">
        </label>
        <label>Preferred Configuration
          <select name="configuration" required>
            <option value="">Select configuration</option>
           ${configurationOptions}
          </select>
        </label>
        <button class="lead-submit" type="submit">Submit & Get Brochure ↗</button>
        <p class="lead-status" aria-live="polite"></p>
      </form>
    </div>`;

  document.body.appendChild(modal);

  const form = modal.querySelector(".brochure-lead-form");
  const status = modal.querySelector(".lead-status");
  const submit = modal.querySelector(".lead-submit");

  modal.querySelector(".modal-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", event => {
    if (event.target === modal) modal.remove();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const brochureTab = window.open("about:blank", "_blank");
    const data = new URLSearchParams(new FormData(form));
    data.set("project", project.title);

    submit.disabled = true;
    status.textContent = "Submitting your details…";

    try {
      await fetch(LEAD_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: data
      });

      if (brochureTab) {
        brochureTab.location.href = brochureUrl;
      } else {
        window.location.href = brochureUrl;
      }
      modal.remove();
    } catch (error) {
      if (brochureTab) brochureTab.close();
      status.textContent = "Could not submit. Please try again.";
      submit.disabled = false;
    }
  });
}
function openDetails(project) {
  document.querySelector(".detail-modal")?.remove();
  const area = project.minCarpetArea && project.maxCarpetArea ? `${project.minCarpetArea}–${project.maxCarpetArea} sq ft` : project.minCarpetArea ? `${project.minCarpetArea}+ sq ft` : "On request";
  const amenities = Array.isArray(project.amenities) ? project.amenities.join(", ") : project.amenities;
  const message = encodeURIComponent(`Hello Vastunest Realty, please share details for ${project.title}.`);
  const modal = document.createElement("div");
  
  const configurations = (Array.isArray(project.bhk)
    ? project.bhk.join(", ")
    : String(project.bhk || "")).match(/\d+\s*BHK/gi) || ["2 BHK", "3 BHK"];

  const configurationOptions = [...new Set(configurations)]
    .map(item => `<option value="${safe(item)}">${safe(item)}</option>`)
    .join("");

  modal.className = "detail-modal";
  modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${safe(project.title)} details">
    <button class="modal-close" type="button" aria-label="Close details">×</button><p class="eyebrow">VASTUNEST PROPERTY DETAILS</p><h2>${safe(project.title)}</h2>
    <p>${safe(project.description || "Contact our property advisor for detailed project information and current availability.")}</p>
    <div class="modal-details"><div><small>Location</small><strong>${safe(project.location)}</strong></div><div><small>Configuration</small><strong>${safe(Array.isArray(project.bhk) ? project.bhk.join(", ") : project.bhk || "On request")}</strong></div><div><small>Starting price</small><strong>${safe(money(project.startingPrice))}</strong></div><div><small>Carpet area</small><strong>${safe(area)}</strong></div><div><small>Developer</small><strong>${safe(project.developer || "Details on request")}</strong></div><div><small>Possession / Status</small><strong>${safe([project.possession, project.status].filter(Boolean).join(" · ") || "Contact advisor")}</strong></div>${amenities ? `<div class="modal-wide"><small>Amenities</small><strong>${safe(amenities)}</strong></div>` : ""}</div>
<div class="modal-actions"><a href="https://wa.me/${WHATSAPP_NUMBER}?text=${message}" target="_blank" rel="noopener">Enquire on WhatsApp ↗</a><a href="mailto:${OFFICIAL_EMAIL}?subject=${encodeURIComponent("Property enquiry: " + project.title)}">Email an advisor ↗</a>
${(field(project, "brochure", "brochurePdf", "brochureUrl") || project.slug === "yashada-evo-punawale") ? `<a href="#brochure-lead" class="card-link brochure-modal-link" data-brochure="${safe(project.slug)}">Download Brochure PDF ↗</a>` : ""}
</div></div>`;
  document.body.appendChild(modal);
  modal.querySelector(".brochure-modal-link")?.addEventListener("click", event => {
  event.preventDefault();
  modal.remove();
  openBrochureLead(project);
});
  const close = () => { modal.remove(); document.removeEventListener("keydown", onKeyDown); };
  const onKeyDown = event => { if (event.key === "Escape") close(); };
  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.addEventListener("click", event => { if (event.target === modal) close(); });
  document.addEventListener("keydown", onKeyDown);
  modal.querySelector(".modal-close").focus();
}
function startWebsite() {
  $("#searchButton")?.addEventListener("click", renderProjects);
  [$("#locationFilter"), $("#bhkFilter"), $("#budgetFilter")].forEach(element => element?.addEventListener("change", renderProjects));
  const toggle = $("#menuToggle");
  const nav = $("#navLinks");
  if (toggle && nav) toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    toggle.textContent = isOpen ? "×" : "☰";
  });
  nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle?.setAttribute("aria-expanded", "false");
    if (toggle) { toggle.textContent = "☰"; toggle.setAttribute("aria-label", "Open menu"); }
  }));
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
  loadProjects();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWebsite);
else startWebsite();
