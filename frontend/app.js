const API = (window.DEVCONNECT_CONFIG?.apiBaseUrl || "/api").replace(/\/$/, "");

const $ = id => document.getElementById(id);

function showStatus(message, type = "info") {
  const box = $("status");
  if (!box) return;
  box.textContent = message;
  box.className = `status ${type}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

async function registerUser(event) {
  event.preventDefault();
  try {
    const data = await request("/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("name").value.trim(),
        email: $("email").value.trim(),
        password: $("password").value
      })
    });
    showStatus(data.message + " You can sign in now.", "success");
    document.querySelector('[data-tab="login"]').click();
    $("loginEmail").value = $("email").value.trim();
    $("loginPassword").value = "";
    $("register-form").reset();
  } catch (error) {
    showStatus(error.message, "error");
  }
}

async function loginUser(event) {
  event.preventDefault();
  try {
    const data = await request("/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("loginEmail").value.trim(),
        password: $("loginPassword").value
      })
    });

    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = "dashboard.html";
  } catch (error) {
    showStatus(error.message, "error");
  }
}

async function authenticatedRequest(path, options = {}) {
  const token = sessionStorage.getItem("token");
  if (!token) {
    window.location.href = "index.html";
    throw new Error("Authentication required");
  }

  return request(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

async function loadNotes() {
  const notes = await authenticatedRequest("/notes");
  $("notes").innerHTML = "";
  $("note-count").textContent = notes.length;
  $("empty").style.display = notes.length ? "none" : "block";

  for (const note of notes) {
    const article = document.createElement("article");
    article.className = "note-card";

    const title = document.createElement("h3");
    title.textContent = note.title;

    const content = document.createElement("p");
    content.textContent = note.content;

    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = new Date(note.created_at).toLocaleString();

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-btn";
    deleteButton.textContent = "Delete";
    deleteButton.onclick = () => deleteNote(note.id);

    actions.appendChild(deleteButton);
    article.append(title, content, meta, actions);
    $("notes").appendChild(article);
  }
}

async function createNote(event) {
  event.preventDefault();
  try {
    await authenticatedRequest("/notes", {
      method: "POST",
      body: JSON.stringify({
        title: $("title").value.trim(),
        content: $("content").value.trim()
      })
    });
    $("note-form").reset();
    await loadNotes();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteNote(id) {
  if (!confirm("Delete this note?")) return;
  try {
    await authenticatedRequest(`/notes/${id}`, { method: "DELETE" });
    await loadNotes();
  } catch (error) {
    alert(error.message);
  }
}

function setupAuthPage() {
  const loginForm = $("login-form");
  const registerForm = $("register-form");
  if (!loginForm || !registerForm) return;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      loginForm.classList.toggle("hidden", !isLogin);
      registerForm.classList.toggle("hidden", isLogin);
      showStatus("");
    });
  });

  loginForm.addEventListener("submit", loginUser);
  registerForm.addEventListener("submit", registerUser);
}

async function setupDashboard() {
  if (!$("notes")) return;
  const user = JSON.parse(sessionStorage.getItem("user") || "null");
  if (!sessionStorage.getItem("token")) {
    window.location.href = "index.html";
    return;
  }
  $("user-label").textContent = user?.name || user?.email || "User";
  $("note-form").addEventListener("submit", createNote);
  $("logout").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  });

  try {
    await loadNotes();
  } catch (error) {
    alert(error.message);
  }
}

setupAuthPage();
setupDashboard();
