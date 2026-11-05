/**
 * Read a JSON file from a private GitHub repo.
 * The Contents API omits `content` once a file is over 1 MB.
 * Those files are loaded with Accept: application/vnd.github.raw,
 * then download_url, then the git blobs API.
 */

function decodeContent(file) {
  if (!file || typeof file.content !== "string") return null;
  const clean = file.content.replace(/\s/g, "");
  if (!clean || typeof atob !== "function") return null;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function gh(fetchFn, url, token, accept) {
  const response = await fetchFn(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
    },
  });
  if (response.status === 401) {
    const error = new Error("GitHub token rejected");
    error.status = 401;
    throw error;
  }
  return response;
}

async function textIfOk(response) {
  if (!response || !response.ok) return "";
  const text = await response.text();
  return text && String(text).trim() ? text : "";
}

export async function fetchPrivateJson(repo, path, token, fetchImpl) {
  const fetchFn = fetchImpl || fetch;
  const root = `https://api.github.com/repos/${repo}`;
  const contentsUrl = `${root}/contents/${path}`;
  const meta = await gh(fetchFn, contentsUrl, token, "application/vnd.github+json");
  if (meta.status === 404) return null;
  if (!meta.ok) throw new Error(`GitHub HTTP ${meta.status}`);
  const file = await meta.json();
  const inline = decodeContent(file);
  if (inline != null) return { sha: file.sha || "", data: JSON.parse(inline) };

  const raw = await gh(fetchFn, contentsUrl, token, "application/vnd.github.raw");
  const rawText = await textIfOk(raw);
  if (rawText) return { sha: file.sha || "", data: JSON.parse(rawText) };

  if (file && file.download_url) {
    const download = await gh(fetchFn, file.download_url, token, "application/vnd.github.raw");
    const downloadText = await textIfOk(download);
    if (downloadText) return { sha: file.sha || "", data: JSON.parse(downloadText) };
  }

  if (file && file.sha) {
    const blob = await gh(fetchFn, `${root}/git/blobs/${file.sha}`, token, "application/vnd.github.raw");
    const blobText = await textIfOk(blob);
    if (blobText) return { sha: file.sha, data: JSON.parse(blobText) };
  }

  throw new Error("GitHub file has no content");
}
