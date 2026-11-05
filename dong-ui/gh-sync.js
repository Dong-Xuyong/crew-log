/**
 * dong-ui GitHub progress sync: one JSON file per app in a private repo.
 * The token lives in localStorage, shared by every app on this origin.
 *
 *   GhSync.save(appId, getPayload, applyPayload, { quiet }) -> Promise<message>
 *   GhSync.load(appId, applyPayload)             -> Promise<message>
 */
(function (global) {
  "use strict";

  var CONFIG_KEY = "dong-gh-sync";
  var DEFAULT_REPO = "Dong-Xuyong/progress-sync";
  var API = "https://api.github.com/repos/";

  function getConfig() {
    var cfg = null;
    try {
      cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    } catch (e) {}
    if (cfg && cfg.token) return cfg;
    var token = global.prompt(
      "Paste a GitHub fine-grained token with Contents read/write on " +
        DEFAULT_REPO +
        " only.\nIt is saved in this browser for all your apps."
    );
    if (!token || !token.trim()) throw new Error("No GitHub token, sync cancelled");
    cfg = { token: token.trim(), repo: DEFAULT_REPO };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    return cfg;
  }

  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64(b64) {
    return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ""))));
  }

  function request(cfg, method, path, body) {
    return fetch(API + cfg.repo + "/contents/" + path, {
      method: method,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + cfg.token,
        Accept: "application/vnd.github+json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem(CONFIG_KEY);
        throw new Error("GitHub token rejected; you will be asked for a new one");
      }
      if (res.status === 404 && method === "GET") return null;
      if (res.status === 409) throw new Error("Saved from another device meanwhile; try again");
      if (!res.ok) throw new Error("GitHub error " + res.status);
      return res.json();
    });
  }

  // 409 handling: refetch, field-level merge, retry once.
  // mergeFields(remote, local): local wins on fields it has; remote-only fields are kept;
  // arrays whose items all carry an "id" are unioned by id (local wins per id, remote order first).
  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function hasIds(arr) {
    return arr.length > 0 && arr.every(function (x) { return isPlainObject(x) && x.id != null; });
  }

  function mergeFields(remote, local) {
    if (Array.isArray(remote) && Array.isArray(local) && (hasIds(remote) || hasIds(local)) &&
        (!remote.length || hasIds(remote)) && (!local.length || hasIds(local))) {
      var byId = {};
      local.forEach(function (x) { byId[String(x.id)] = x; });
      var out = [];
      var seen = {};
      remote.forEach(function (x) {
        var k = String(x.id);
        seen[k] = true;
        out.push(byId[k] ? mergeFields(x, byId[k]) : x);
      });
      local.forEach(function (x) { if (!seen[String(x.id)]) out.push(x); });
      return out;
    }
    if (isPlainObject(remote) && isPlainObject(local)) {
      var merged = {};
      Object.keys(remote).forEach(function (k) { merged[k] = remote[k]; });
      Object.keys(local).forEach(function (k) {
        merged[k] = k in remote ? mergeFields(remote[k], local[k]) : local[k];
      });
      return merged;
    }
    return local === undefined ? remote : local;
  }

  function isConflict(err) {
    return !!err && (err.status === 409 || /another device/i.test(String(err.message || "")));
  }

  function putWithRetry(cfg, appId, body, getPayload, applyPayload) {
    return request(cfg, "PUT", appId + ".json", body).catch(function (err) {
      if (!isConflict(err)) throw err;
      return fetchRemote(cfg, appId).then(function (remote) {
        var remoteData = remote ? remote.data : null;
        if (remoteData && typeof applyPayload === "function") applyPayload(remoteData);
        var merged = remoteData ? mergeFields(remoteData, getPayload()) : getPayload();
        var retry = { message: body.message, content: toBase64(JSON.stringify(merged)) };
        if (remote && remote.sha) retry.sha = remote.sha;
        return request(cfg, "PUT", appId + ".json", retry).catch(function (err2) {
          if (!isConflict(err2)) throw err2;
          // Retried once already: report without the "another device" wording so callers stop too.
          var stop = new Error("GitHub file changed again during the merge retry; not retrying");
          stop.status = 409;
          throw stop;
        });
      });
    });
  }

  function authFetch(cfg, url, accept) {
    return fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + cfg.token,
        Accept: accept,
      },
    }).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem(CONFIG_KEY);
        throw new Error("GitHub token rejected; you will be asked for a new one");
      }
      return res;
    });
  }

  function textIfOk(res) {
    if (!res || !res.ok) return Promise.resolve("");
    return res.text().then(function (text) {
      return text && String(text).trim() ? text : "";
    });
  }

  // Contents API leaves content empty above 1 MB. Read the bytes with the raw
  // media type, then download_url, then the git blob. Same path for every file,
  // including crew-log.json.
  function readBlob(cfg, file) {
    if (!file || !file.sha) throw new Error("GitHub file has no content");
    return authFetch(cfg, API + cfg.repo + "/git/blobs/" + file.sha, "application/vnd.github.raw").then(function (res) {
      return textIfOk(res).then(function (text) {
        if (!text) throw new Error("GitHub file has no content");
        return JSON.parse(text);
      });
    });
  }

  function readDownload(cfg, file) {
    if (!file || !file.download_url) return readBlob(cfg, file);
    return authFetch(cfg, file.download_url, "application/vnd.github.raw").then(function (res) {
      return textIfOk(res).then(function (text) {
        if (text) return JSON.parse(text);
        return readBlob(cfg, file);
      });
    });
  }

  function readOversized(cfg, path, file) {
    return authFetch(cfg, API + cfg.repo + "/contents/" + path, "application/vnd.github.raw").then(function (res) {
      return textIfOk(res).then(function (text) {
        if (text) return JSON.parse(text);
        return readDownload(cfg, file);
      });
    });
  }

  function fetchRemote(cfg, appId) {
    var path = appId + ".json";
    return request(cfg, "GET", path).then(function (file) {
      if (!file) return null;
      var inline = file.content && String(file.content).replace(/\s/g, "");
      if (inline) return { sha: file.sha, data: JSON.parse(fromBase64(file.content)) };
      return readOversized(cfg, path, file).then(function (data) {
        return { sha: file.sha, data: data };
      });
    });
  }

  function save(appId, getPayload, applyPayload, opts) {
    var cfg;
    if (
      !(opts && opts.quiet) &&
      (!global.confirm("Save " + appId + " progress to GitHub?") ||
        !global.confirm("Are you sure? This updates the copy your other devices load."))
    ) {
      return Promise.reject(new Error("Save cancelled"));
    }
    try {
      cfg = getConfig();
    } catch (e) {
      return Promise.reject(e);
    }
    return fetchRemote(cfg, appId).then(function (remote) {
      if (remote) applyPayload(remote.data);
      var body = {
        message: "Save " + appId + " progress",
        content: toBase64(JSON.stringify(getPayload())),
      };
      if (remote) body.sha = remote.sha;
      return putWithRetry(cfg, appId, body, getPayload, applyPayload).then(function () {
        return "Saved to GitHub";
      });
    });
  }

  function load(appId, applyPayload) {
    var cfg;
    try {
      cfg = getConfig();
    } catch (e) {
      return Promise.reject(e);
    }
    return fetchRemote(cfg, appId).then(function (remote) {
      if (!remote) return "Nothing saved on GitHub yet";
      applyPayload(remote.data);
      return "Imported from GitHub";
    });
  }

  global.GhSync = { save: save, load: load };
})(typeof window !== "undefined" ? window : globalThis);
