/* DOM helpers and application state */
const $ = (s) => document.querySelector(s);

// These names mirror the backend models in src/backend/models.py.
const MAX_ROUNDS = 5;
const PAINT_PTS = 10;

// Resolve painting status from the backend's battle-ready fields.
function isPainted(g, sd) {
  return sd === 1
    ? g.player_one_battle_ready === true
    : g.player_two_battle_ready === true;
}

// Convert painting status into the score contribution shown in the UI.
function paintPts(g, sd) {
  return isPainted(g, sd) ? PAINT_PTS : 0;
}

/* Persisted completion and game state */
// The finished state comes from the Game model and survives page reloads.
function isDone(g) {
  return g.game_finished === true;
}
const state = {
  // UI state for the selected game and open dialogs.
  games: [],
  sel: null,
  editGame: null,
  editRound: null,
  results: false,
  finId: null,
};

/* DOM, notifications, and API helpers */
const base = () => {
  return "http://127.0.0.1:8000";
};

function toast(m, err) {
  const t = $("#toast");
  t.textContent = m;
  t.className = err ? "err" : "";
  t.style.display = "block";
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.style.display = "none"), 3500);
}

// Escape values before inserting API data into rendered HTML.
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// Centralize JSON and multipart requests and normalize API errors.
async function api(method, path, body) {
  let r;
  try {
    r = await fetch(base() + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(
      "Can't reach the API at " +
        base() +
        ". Check that the server is running and allows CORS from this page.",
    );
  }
  if (r.status === 204) return null;
  const txt = await r.text();
  let data = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch (e) {
    data = txt;
  }
  if (!r.ok) {
    const d = data && data.detail;
    const msg = Array.isArray(d)
      ? d.map((x) => (x.loc || []).join(".") + ": " + x.msg).join("; ")
      : d || r.statusText;
    throw new Error(`${r.status} ${msg}`);
  }
  return data;
}

// Wrap actions that should show failures in the app toast.
const guard =
  (fn) =>
  async (...a) => {
    try {
      await fn(...a);
    } catch (e) {
      toast(e.message, true);
    }
  };

/* Game data helpers */
// The list uses the most relevant date available on each game.
const gameDate = (g) => {
  return g.created_at ? new Date(g.created_at) : null;
};
const gdate = (g) => {
  const d = gameDate(g);
  return d
    ? `<small class="gdate">${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</small>`
    : "";
};
/* Game list and game detail rendering */

// Render the sortable game navigation on the left side of the app.
function renderList() {
  const el = $("#list");
  if (!state.games.length) {
    // Keep the navigation useful even when the API returns no games.
    el.innerHTML = '<p class="meta" style="padding:8px 12px">No games yet.</p>';
    return;
  }

  // Copy before sorting so rendering does not change the stored game order.
  el.innerHTML = [...state.games]
    .sort((a, b) => +(gameDate(b) || 0) - +(gameDate(a) || 0))
    .map(
      (g) =>
        `<button class="game ${g.id === state.sel ? "on" : ""}" data-id="${esc(g.id)}"><b>${esc(g.title)}</b>${gdate(g)}<small><span class="n1">${esc(g.player_one_name)}</span> vs <span class="n2">${esc(g.player_two_name)}</span> &middot; ${(g.rounds || []).length}/${MAX_ROUNDS} rounds${isDone(g) ? " &middot; finished" : ""}</small></button>`,
    )
    .join("");
}

// Render the empty state shown before a game is selected.
function renderMain() {
  $("#main").innerHTML =
    `<div class="empty"><h2>${state.games.length ? "Pick a game" : "Start your first game"}</h2><p>${state.games.length ? "Choose a game on the left to see its rounds." : "Create a game with two players, then add rounds as you play."}</p></div>`;
}
const roundKey = (r) => r.id;
const nice = (k) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const PLAYER_ONE_FIELDS = new Set([
  "primary_score_player_one",
  "secondary_score_player_one",
]);
const PLAYER_TWO_FIELDS = new Set([
  "primary_score_player_two",
  "secondary_score_player_two",
]);
const side = (k) =>
  PLAYER_ONE_FIELDS.has(k) ? 1 : PLAYER_TWO_FIELDS.has(k) ? 2 : 0;

// Convert API field names into readable labels, including player names.
function label(k, g) {
  const sd = side(k);
  let t = nice(k);
  if (sd) {
    t = nice(k).replace(/_player_(one|two)$/, "");
    return (sd === 1 ? g.player_one_name : g.player_two_name) + ": " + t;
  }
  return t;
}

// Calculate primary, secondary, and painting totals for both players.
function totals(g) {
  const T = {
    1: { p: 0, s: 0, a: paintPts(g, 1) },
    2: { p: 0, s: 0, a: paintPts(g, 2) },
  };
  let found = T[1].a + T[2].a > 0;
  (g.rounds || []).forEach((r) =>
    Object.entries(r).forEach(([k, v]) => {
      const sd = side(k);
      if (!sd || typeof v !== "number") return;
      if (
        k === "primary_score_player_one" ||
        k === "primary_score_player_two"
      ) {
        T[sd].p += v;
        found = true;
      } else if (
        k === "secondary_score_player_one" ||
        k === "secondary_score_player_two"
      ) {
        T[sd].s += v;
        found = true;
      }
    }),
  );
  return found ? T : null;
}

// Extract one of the explicit primary/secondary score fields.
const pts = (r, sd, kind) =>
  Object.entries(r).reduce(
    (a, [k, v]) =>
      a +
      (side(k) === sd && k.startsWith(`${kind}_score_`) && typeof v === "number"
        ? v
        : 0),
    0,
  );

// Render the active game's score table and action buttons.
function renderGame(g) {
  // Finished games use a read-only results presentation.
  if (state.results && isDone(g)) return renderResults(g);
  state.results = false;
  const rounds = g.rounds || [],
    done = isDone(g),
    full = rounds.length >= MAX_ROUNDS;
  // Build columns from all rounds because the API can expose dynamic fields.
  // These are the only round fields rendered as score-table columns.
  const roundColumns = [
    "primary_score_player_one",
    "secondary_score_player_one",
    "primary_score_player_two",
    "secondary_score_player_two",
  ];
  const cols = roundColumns.filter((column) =>
    rounds.some((round) => column in round),
  );
  // Objects such as unexpected nested values need a readable cell value.
  const fmt = (v) =>
    typeof v === "object" && v !== null ? JSON.stringify(v) : v;
  // The score summary is shown above the table for both players.
  const T = totals(g);
  const sc = (n) =>
    T
      ? `<span class="score"><b>${T[n].p + T[n].s + T[n].a}</b><small>Primary ${T[n].p} / Secondary ${T[n].s}${T[n].a ? " / Painted " + T[n].a : ""}</small></span>`
      : "";
  // Separate general fields from fields belonging to either player.
  const n0 = cols.filter((c) => !side(c)),
    c1 = cols.filter((c) => side(c) === 1),
    c2 = cols.filter((c) => side(c) === 2);
  // Mark the first player-specific column so the table styling can group it.
  const gs = new Set([c1[0], c2[0]]),
    cc = (c) => (side(c) ? `g${side(c)}${gs.has(c) ? " gs" : ""}` : "");
  const gth = (c, n) =>
    c.length
      ? `<th class="g${n}" colspan="${c.length + 1}">${esc(n === 1 ? g.player_one_name : g.player_two_name)}</th>`
      : "";
  const tot = (r, n) => pts(r, n, "primary") + pts(r, n, "secondary");
  // Use two header rows: one for player groups and one for their fields.
  const hd = `<tr><th rowspan="2" class="rn">Round</th>${n0.map((c) => `<th rowspan="2">${esc(nice(c))}</th>`).join("")}${gth(c1, 1)}${gth(c2, 2)}<th rowspan="2">Photo</th>${done ? "" : '<th rowspan="2"></th>'}</tr><tr>${[
    [1, c1],
    [2, c2],
  ]
    .map(([n, c]) =>
      c.length
        ? c.map((k) => `<th class="${cc(k)}">${esc(short(k))}</th>`).join("") +
          `<th class="g${n} tot">Total</th>`
        : "",
    )
    .join("")}</tr>`;
  // Render one table row per round, including totals and edit actions.
  const bd = rounds
    .map(
      (r, i) =>
        `<tr><td class="rn"><span>${i + 1}</span></td>${n0.map((c) => `<td>${esc(fmt(r[c]))}</td>`).join("")}${[
          [1, c1],
          [2, c2],
        ]
          .map(([n, c]) =>
            c.length
              ? c
                  .map((k) => `<td class="${cc(k)}">${esc(fmt(r[k]))}</td>`)
                  .join("") + `<td class="g${n} tot">${tot(r, n)}</td>`
              : "",
          )
          .join(
            "",
          )}<td>${thumb(r)}</td>${done ? "" : `<td class="act"><button class="link" data-edit="${i}">Edit</button><button class="link" data-del="${i}">Delete</button></td>`}</tr>`,
    )
    .join("");
  // Finished games are read-only; active games expose finish and add-round actions.
  const acts = done
    ? '<button class="primary" id="viewRes">View results</button>'
    : `<button id="finish">Finish game</button> <button class="primary" id="addRound" ${full ? "disabled" : ""}>${full ? "Round limit reached" : "Add round"}</button>`;
  // Replace the main view only after all fragments have been prepared.
  $("#main").innerHTML = `
  <div class="head"><div><h2>${esc(g.title)}</h2>${g.game_description ? `<p>${esc(g.game_description)}</p>` : ""}</div>
    <div><button id="editGame">Edit game</button> <button class="danger" id="delGame">Delete</button></div></div>
  <div class="vs"><div class="a"><em>Player I</em><strong>${esc(g.player_one_name)}</strong>${sc(1)}</div><i>VS</i><div class="b"><em>Player II</em><strong>${esc(g.player_two_name)}</strong>${sc(2)}</div></div>
  <div class="meta">Created ${g.created_at ? new Date(g.created_at).toLocaleString() : ""}${done ? " &middot; Finished" : ""}</div>
  <div class="sec"><h3>Rounds ${rounds.length}/${MAX_ROUNDS}</h3><div class="acts">${acts}</div></div>
  ${rounds.length ? `<div class="tbl"><table><thead>${hd}</thead><tbody>${bd}</tbody></table></div>` : '<p class="meta">No rounds yet. Add the first one to start scoring.</p>'}`;
}

// Render the finished-game summary and round-by-round result cards.
function renderResults(g) {
  // Results use the same total calculation as the active game view.
  const T = totals(g),
    rounds = g.rounds || [],
    n1 = g.player_one_name,
    n2 = g.player_two_name;
  // Keep total-score access in one helper so winner and cards cannot disagree.
  const t = (n) => (T ? T[n].p + T[n].s + T[n].a : 0);
  const win = t(1) > t(2) ? n1 : t(2) > t(1) ? n2 : null;
  // Generate identical score cards for both players with different data.
  const card = (n, cls, name) =>
    `<div class="rc ${cls}"><em>${cls === "a" ? "Player I" : "Player II"}</em><h3>${esc(name)}</h3><div class="big">${t(n)}</div><div>Primary ${T[n].p} / Secondary ${T[n].s}${T[n].a ? " / Painted " + T[n].a : ""}</div></div>`;
  const reopen = '<button id="reopen">Reopen game</button>';
  // Show a fallback message instead of an incomplete winner card when totals fail.
  $("#main").innerHTML = `
  <div class="head"><div><h2>Results</h2><p>${esc(g.title)} &middot; ${rounds.length} of ${MAX_ROUNDS} rounds played</p></div>
    <div><button id="backGame">Back to game</button> ${reopen}</div></div>
  ${
    T
      ? `<div class="win ${t(1) > t(2) ? "a" : t(2) > t(1) ? "b" : ""}" style="margin-top:24px"><small>${win ? "Winner" : "Result"}</small><h2>${win ? esc(win) : "Draw"}</h2></div>
  <div class="rcs">${card(1, "a", n1)}${card(2, "b", n2)}</div>`
      : '<p class="meta" style="margin-top:24px">Scores could not be totaled because the point fields were not recognized.</p>'
  }
  <div class="sec"><h3>Round by round</h3></div>
  <div class="rnds">${rounds.length ? rounds.map((r, i) => roundCard(g, r, i)).join("") : '<p class="meta">No rounds were played.</p>'}</div>`;
}

const roundDesc = (r) => r.round_description?.trim() || "";

// Render one round in the results view, including its scores and images.
function roundCard(g, r, i) {
  // Each result card contains one score row per player.
  const row = (sd) => {
    const p = pts(r, sd, "primary"),
      s = pts(r, sd, "secondary");
    return `<div class="rs ${sd === 1 ? "a" : "b"}"><b>${esc(sd === 1 ? g.player_one_name : g.player_two_name)}</b><span>${p + s}</span><small>Primary ${p} / Secondary ${s}</small></div>`;
  };
  // Images are rendered below the score rows with optional captions.
  const imgs = roundImgs(r)
    .map(
      (im) =>
        `<figure><img src="${esc(imgSrc(im))}" alt="Game stage, round ${i + 1}" loading="lazy">${imgDesc(im) ? `<figcaption>${esc(imgDesc(im))}</figcaption>` : ""}</figure>`,
    )
    .join("");
  const d = roundDesc(r);
  // Keep descriptions optional so rounds without notes remain compact.
  return `<article class="rd"><h3>Round ${i + 1}</h3>${d ? `<p class="rdesc">${esc(d)}</p>` : ""}<div class="rss">${row(1)}${row(2)}</div>${imgs}</article>`;
}
/* Game loading and lifecycle actions */

// Fetch the game list and refresh the current selection.
const loadGames = guard(async () => {
  state.games = await api("GET", "/games/");
  renderList();
  if (state.sel) await openGame(state.sel, true);
});

// Fetch a complete game and update both the selected game and its list entry.
const openGame = guard(async (id, quiet) => {
  try {
    const g = await api("GET", "/games/" + id);
    state.sel = id;
    const i = state.games.findIndex((x) => x.id === id);
    if (i >= 0) state.games[i] = g;
    renderList();
    renderGame(g);
  } catch (e) {
    if (quiet) {
      state.sel = null;
      renderMain();
    }
    throw e;
  }
});

// Persist completion in the backend before showing the results view.
const finishGame = guard(async (g) => {
  await api("PATCH", `/games/${g.id}`, { game_finished: true });
  state.results = true;
  await openGame(g.id);
});

// Show the confirmation dialog when finishing before all rounds are played.
function openFinish(g) {
  if (isDone(g)) return;
  const n = (g.rounds || []).length;
  if (n >= MAX_ROUNDS) return finishGame(g);
  $("#finMsg").textContent =
    `Only ${n} of ${MAX_ROUNDS} rounds have been played. Finish the game anyway and show the results?`;
  state.finId = g.id;
  $("#finDlg").showModal();
}

/* Game dialog */

// Keep the painting buttons synchronized with names and current toggle state.
function paintBtns() {
  [1, 2].forEach((sd) => {
    const b = $("#paint" + sd),
      on = state.paint[sd],
      n =
        $(sd === 1 ? "#g_p1" : "#g_p2").value.trim() ||
        (sd === 1 ? "Player one" : "Player two");
    b.setAttribute("aria-pressed", on);
    b.classList.toggle("on", on);
    b.textContent = `${n}: army ${on ? "painted, +" + PAINT_PTS + " points" : "not painted"}`;
  });
}

// Populate and open the create/edit game dialog.
function openGameDlg(g) {
  state.editGame = g || null;
  $("#gameTitle").textContent = g ? "Edit game" : "New game";
  $("#g_title").value = g?.title || "";
  $("#g_desc").value = g?.game_description || "";
  $("#g_p1").value = g?.player_one_name || "";
  $("#g_p2").value = g?.player_two_name || "";
  state.paint = {
    1: g ? isPainted(g, 1) : false,
    2: g ? isPainted(g, 2) : false,
  };
  paintBtns();
  $("#gameDlg").showModal();
}
$("#gameForm").addEventListener(
  "submit",
  guard(async (e) => {
    const body = {
      title: $("#g_title").value.trim(),
      game_description: $("#g_desc").value.trim(),
      player_one_name: $("#g_p1").value.trim(),
      player_two_name: $("#g_p2").value.trim(),
      player_one_battle_ready: state.paint[1],
      player_two_battle_ready: state.paint[2],
    };
    let gid;
    if (state.editGame) {
      gid = state.editGame.id;
      await api("PATCH", "/games/" + gid, body);
      toast("Game saved");
    } else {
      const g = await api("POST", "/games/", body);
      gid = g.id;
      state.sel = gid;
      toast("Game created");
    }
    await loadGames();
  }),
);

/* Round dialog and backend model fields */
const ROUND_FIELDS = {
  round_description: { type: "string" },
  primary_score_player_one: { type: "integer", default: 0 },
  primary_score_player_two: { type: "integer", default: 0 },
  secondary_score_player_one: { type: "integer", default: 0 },
  secondary_score_player_two: { type: "integer", default: 0 },
};

// These fields mirror the editable fields in RoundCreate/RoundUpdate.
const fields = () => Object.entries(ROUND_FIELDS);

// Shorten score field names for the table and round form headings.
const short = (k) => {
  const t = nice(k).replace("_player_one", "").replace("_player_two", "");
  return t[0].toUpperCase() + t.slice(1);
};

// Build one form control from an OpenAPI property definition.
function mk([k, p], cur, lab) {
  const t = p.type,
    num = t === "integer" || t === "number";
  const v = cur[k] ?? p.default ?? (num ? 0 : "");
  if (t === "boolean")
    return `<label class="chk"><input type="checkbox" data-k="${k}" ${v ? "checked" : ""}> ${esc(lab)}</label>`;
  const long = k === "round_description";
  const inp = long
    ? `<textarea id="f_${k}" data-k="${k}" data-t="${t}" rows="3">${esc(v)}</textarea>`
    : `<input id="f_${k}" data-k="${k}" data-t="${t}" type="${num ? "number" : "text"}" ${t === "integer" ? 'step="1" inputmode="numeric"' : ""} value="${esc(v)}">`;
  return `<div class="fld${num ? "" : " wide"}"><label for="f_${k}">${esc(lab)}</label>${inp}</div>`;
}

// Recalculate the visible per-player round totals while editing.
const sumPanels = () =>
  document.querySelectorAll("#r_fields .pl").forEach((pl) => {
    pl.querySelector(".sub b").textContent = [
      ...pl.querySelectorAll("input[type=number]"),
    ].reduce((a, el) => a + (parseFloat(el.value) || 0), 0);
  });
const ROUND_MAX = 15,
  GAME_MAX = 45;
const capped = (k) =>
  k === "primary_score_player_one" ||
  k === "primary_score_player_two" ||
  k === "secondary_score_player_one" ||
  k === "secondary_score_player_two";

// Count points from other rounds so an edited round can use the remaining total.
const usedPts = (g, k, i) =>
  (g.rounds || []).reduce(
    (a, r, j) => a + (j === i || typeof r[k] !== "number" ? 0 : r[k]),
    0,
  );
const allow = (g, k, i) =>
  Math.max(0, Math.min(ROUND_MAX, GAME_MAX - usedPts(g, k, i)));

// Keep score inputs within both per-round and per-game limits.
$("#r_fields").addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.max === undefined || el.value === "") return;
  const mx = +el.dataset.max;
  let v = Math.floor(parseFloat(el.value));
  if (isNaN(v) || v < 0) v = 0;
  if (v > mx) {
    v = mx;
    const n = el.parentElement.querySelector(".cap");
    n.classList.add("hit");
    n.textContent = `Capped at ${mx}: ${mx < ROUND_MAX ? GAME_MAX + "-point game limit" : ROUND_MAX + "-point round limit"}`;
    clearTimeout(n.h);
    n.h = setTimeout(() => {
      n.classList.remove("hit");
      n.textContent = n.dataset.def;
    }, 2500);
  }
  el.value = v;
});
$("#r_fields").addEventListener("input", sumPanels);

// Populate the round dialog from the known round model or raw JSON input.
function openRoundDlg(i) {
  const g = state.games.find((x) => x.id === state.sel);
  if (i == null && (g.rounds || []).length >= MAX_ROUNDS) {
    toast("A game has at most " + MAX_ROUNDS + " rounds", true);
    return;
  }
  state.editRound = i == null ? null : i;
  $("#roundTitle").textContent = i == null ? "Add round" : "Edit round";
  const cur = i == null ? {} : g.rounds[i];
  const f = fields().sort((a, b) => side(a[0]) - side(b[0]));
  $("#r_fields").style.display = f.length ? "block" : "none";
  $("#r_jsonwrap").style.display = f.length ? "none" : "block";
  if (f.length) {
    const byP = (x, y) =>
      (x[0].startsWith("primary_") ? 0 : 1) -
      (y[0].startsWith("primary_") ? 0 : 1);
    const top = f.filter((x) => !side(x[0])),
      p1 = f.filter((x) => side(x[0]) === 1).sort(byP),
      p2 = f.filter((x) => side(x[0]) === 2).sort(byP);
    const panel = (n, cls, arr) =>
      arr.length
        ? `<section class="pl ${cls}"><h4>${esc(n)}</h4>${arr.map((x) => mk(x, cur, short(x[0]))).join("")}<div class="sub">Round total <b>0</b></div></section>`
        : "";
    $("#r_fields").innerHTML =
      (top.length
        ? `<div class="r-top">${top.map((x) => mk(x, cur, label(x[0], g))).join("")}</div>`
        : "") +
      `<div class="r-sides">${panel(g.player_one_name, "a", p1)}${panel(g.player_two_name, "b", p2)}</div>`;
    document.querySelectorAll("#r_fields input[type=number]").forEach((el) => {
      const k = el.dataset.k;
      if (!capped(k)) return;
      const idx = i == null ? -1 : i,
        mx = allow(g, k, idx),
        used = usedPts(g, k, idx);
      el.dataset.max = mx;
      el.min = 0;
      el.max = mx;
      const def = `0 to ${mx} (game total ${used}/${GAME_MAX})`;
      el.insertAdjacentHTML(
        "afterend",
        `<small class="cap" data-def="${def}">${def}</small>`,
      );
      if (+el.value > mx) el.value = mx;
    });
    sumPanels();
  } else {
    let seed = {};
    if (i != null) {
      seed = { ...cur };
      ["id", "created_at", "images"].forEach((k) => delete seed[k]);
    }
    $("#r_json").value = JSON.stringify(seed, null, 2);
  }
  const ci = i == null ? null : roundImgs(cur)[0];
  state.rmImg = false;
  state.imgP = null;
  $("#r_prev").innerHTML = "";
  $("#r_file").value = "";
  $("#r_idesc").value = ci ? imgDesc(ci) : "";
  $("#r_cur").innerHTML = ci
    ? `<img class="thumb" src="${esc(imgSrc(ci))}" alt=""> <button type="button" class="link" id="r_rm">Remove photo</button>`
    : "";
  $("#roundDlg").showModal();
}

// Convert the round form controls into the payload expected by the API.
$("#roundForm").addEventListener("submit", (e) => {
  let body;
  if (fields().length) {
    // Prefer the generated controls for the known round model.
    body = {};
    document.querySelectorAll("#r_fields [data-k]").forEach((el) => {
      const k = el.dataset.k,
        t = el.dataset.t;
      if (el.type === "checkbox") body[k] = el.checked;
      else if (t === "integer") body[k] = parseInt(el.value || 0, 10);
      else if (t === "number") body[k] = parseFloat(el.value || 0);
      else body[k] = el.value;
    });
  } else {
    // Raw JSON remains available as an escape hatch for manual editing.
    try {
      body = JSON.parse($("#r_json").value);
    } catch (x) {
      e.preventDefault();
      toast("Round data is not valid JSON", true);
      return;
    }
  }
  guard(async () => {
    const g = state.games.find((x) => x.id === state.sel);
    if (state.editRound == null && (g.rounds || []).length >= MAX_ROUNDS)
      throw new Error("A game has at most " + MAX_ROUNDS + " rounds");
    // Clamp scores in the browser before the backend performs final validation.
    for (const k in body) {
      if (capped(k) && typeof body[k] === "number")
        body[k] = Math.max(
          0,
          Math.min(
            Math.floor(body[k]),
            allow(g, k, state.editRound == null ? -1 : state.editRound),
          ),
        );
    }
    let rid;
    // Create or update the round first so an image has a round ID to attach to.
    if (state.editRound == null) {
      const nr = await api("POST", `/rounds/${g.id}/`, body);
      rid = nr && nr.id;
      toast("Round added");
    } else {
      rid = roundKey(g.rounds[state.editRound], state.editRound);
      await api("PATCH", `/rounds/${g.id}/${rid}`, body);
      toast("Round saved");
    }
    await savePhoto(g, rid);
    await openGame(g.id);
  })();
});
/* Image data helpers */

// RoundImage stores images in the round's images list.
const roundImgs = (r) => r.images || [];

// RoundImage uses image_description for the optional caption.
const imgDesc = (im) => im.image_description || "";

// RoundImage.image is raw base64, so display it as an inline JPEG.
function imgSrc(im) {
  return im.image ? `data:${im.mimetype};base64,${im.image}` : "";
}

// Render the first round image as a compact table thumbnail.
const thumb = (r) => {
  const im = roundImgs(r)[0];
  return im ? `<img class="thumb" src="${esc(imgSrc(im))}" alt="">` : "";
};

/* Image conversion and upload helpers */
const dims = (u) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res([im.naturalWidth, im.naturalHeight]);
    im.onerror = () => res([0, 0]);
    im.src = u;
  });
const MAX_IMG_PX = 1600;

// Resize and encode a selected image before sending it to the API.
async function toB64(file) {
  let url,
    w = 0,
    h = 0,
    ow = 0,
    oh = 0;
  try {
    const bmp = await createImageBitmap(file),
      sc = Math.min(1, MAX_IMG_PX / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * sc);
    cv.height = Math.round(bmp.height * sc);
    const cx = cv.getContext("2d");
    cx.fillStyle = "#fff";
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    url = cv.toDataURL("image/jpeg", 0.85);
    w = cv.width;
    h = cv.height;
    ow = bmp.width;
    oh = bmp.height;
  } catch (e) {
    url = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    [w, h] = await dims(url);
    ow = w;
    oh = h;
  }
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (!m) throw new Error("Could not convert the photo");
  const ext =
    {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    }[m[1]] || "";
  return {
    dataUrl: url,
    b64: m[2],
    mime: m[1],
    w,
    h,
    ow,
    oh,
    name: file.name.replace(/\.[^.]+$/, "") + ext,
  };
}

async function uploadImage(path, file, desc) {
  const image = await (state.imgP || toB64(file));
  const body = {
    image: image.b64,
    image_description: desc,
    mimetype: image.mime,
    x_dim: image.w,
    y_dim: image.h,
  };
  return api("POST", path, body);
}

// Create, replace, remove, or rename the image attached to a round.
async function savePhoto(g, rid) {
  const file = $("#r_file").files[0],
    desc = $("#r_idesc").value.trim();
  const cur =
    state.editRound == null ? null : roundImgs(g.rounds[state.editRound])[0];
  if (!file && !cur) return;
  if (rid == null) {
    const f = await api("GET", "/games/" + g.id);
    rid = (f.rounds || []).slice(-1)[0]?.id;
  }
  const path = `/rounds/${g.id}/${rid}/images/`;
  if (cur && (file || state.rmImg)) await api("DELETE", path + cur.id);
  if (file) await uploadImage(path, file, desc);
  else if (cur && !state.rmImg && desc !== imgDesc(cur))
    await api("PATCH", path + cur.id, {
      image: cur.image,
      image_description: desc,
      mimetype: cur.mimetype,
      x_dim: cur.x_dim,
      y_dim: cur.y_dim,
    });
}

// Convert the selected file immediately so the user gets a preview and errors early.
$("#r_file").addEventListener("change", async () => {
  const f = $("#r_file").files[0];
  state.imgP = null;
  $("#r_prev").innerHTML = "";
  if (!f) return;
  $("#r_prev").textContent = "Converting photo...";
  const p = (state.imgP = toB64(f));
  try {
    const r = await p;
    if (state.imgP !== p) return;
    $("#r_prev").innerHTML =
      `<img class="thumb" src="${r.dataUrl}" alt=""> Ready as base64, ${Math.round(r.b64.length / 1024)} KB`;
  } catch (e) {
    $("#r_prev").textContent = "Could not read that file.";
  }
});

// Mark the current image for deletion without deleting it until the round is saved.
$("#r_cur").addEventListener("click", (e) => {
  if (e.target.id === "r_rm") {
    state.rmImg = true;
    $("#r_cur").innerHTML = "";
  }
});
[1, 2].forEach((sd) => {
  // Painting controls are simple toggles; the form submit persists their state.
  $("#paint" + sd).onclick = () => {
    state.paint[sd] = !state.paint[sd];
    paintBtns();
  };
});
$("#g_p1").addEventListener("input", paintBtns);
$("#g_p2").addEventListener("input", paintBtns);
/* Page event wiring */

// The list is replaced during rendering, so handle selection at the container.
$("#list").addEventListener("click", (e) => {
  const b = e.target.closest(".game");
  if (b) openGame(b.dataset.id);
});
$("#main").addEventListener(
  "click",
  guard(async (e) => {
    // Main-page buttons are delegated because the game view is rendered dynamically.
    const g = state.games.find((x) => x.id === state.sel);
    if (!g) return;
    const t = e.target.closest("button");
    if (!t) return;
    if (t.id === "finish") openFinish(g);
    else if (t.id === "viewRes") {
      state.results = true;
      renderGame(g);
    } else if (t.id === "backGame") {
      state.results = false;
      renderGame(g);
    } else if (t.id === "reopen") {
      await api("PATCH", `/games/${g.id}`, { game_finished: false });
      state.results = false;
      await openGame(g.id);
    } else if (t.id === "editGame") openGameDlg(g);
    else if (t.id === "addRound") openRoundDlg();
    else if (t.id === "delGame") {
      if (confirm(`Delete "${g.title}" and all its rounds?`)) {
        await api("DELETE", "/games/" + g.id);
        state.sel = null;
        toast("Game deleted");
        await loadGames();
        renderMain();
      }
    } else if (t.dataset.edit != null) openRoundDlg(+t.dataset.edit);
    else if (t.dataset.del != null) {
      const i = +t.dataset.del;
      if (confirm("Delete this round?")) {
        await api("DELETE", `/rounds/${g.id}/${roundKey(g.rounds[i], i)}`);
        toast("Round deleted");
        await openGame(g.id);
      }
    }
  }),
);
$("#finDlg form").addEventListener("submit", () => {
  const g = state.games.find((x) => x.id === state.finId);
  if (g) finishGame(g);
});

// Static controls remain available even when the main game view is re-rendered.
$("#newGame").onclick = () => openGameDlg();
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => b.closest("dialog").close()));

// Download the backend's export response without changing its JSON contents.
$("#exportGames").onclick = () => {
  const link = document.createElement("a");
  link.href = `${base()}/games/export`;
  link.download = "export.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// Let the user choose an exported JSON file and send it to the import endpoint.
$("#importGames").onclick = () => $("#importFile").click();
$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  try {
    const content = await file.text();
    const games = JSON.parse(content);
    if (!Array.isArray(games)) {
      throw new Error("The import file must contain a JSON array of games.");
    }
    await api("POST", "/games/import", games);
    state.sel = null;
    state.results = false;
    await loadGames();
    renderMain();
    toast("Games imported");
  } catch (error) {
    toast(error.message, true);
  }
});

renderMain();
loadGames();
