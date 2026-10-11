export function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
export function mediaURL(value = "") {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}
export function optimizeCloudinaryVideo(value = "") {
  const safe = mediaURL(value);
  if (!safe) return "";
  const url = new URL(safe);
  if (url.hostname !== "res.cloudinary.com") return safe;
  const upload = url.pathname.indexOf("/video/upload/");
  if (upload < 0 || /\/s--[\w-]+--\//.test(url.pathname)) return safe;
  const prefixEnd = url.pathname.search(/\/v\d+\//);
  if (prefixEnd < upload) return safe;
  const transformations = url.pathname.slice(upload + "/video/upload/".length, prefixEnd);
  if (/(?:^|\/)(?:q_|f_)/.test(transformations)) return safe;
  url.pathname =
    url.pathname.slice(0, prefixEnd) +
    "/q_auto/f_auto" +
    url.pathname.slice(prefixEnd);
  return url.href;
}
export function parseVideo(value) {
  const safe = mediaURL(value);
  if (!safe) throw new Error("יש להזין כתובת HTTPS תקינה, לא קוד HTML.");
  const url = new URL(safe),
    host = url.hostname.toLowerCase();
  if (/\.(mp4|webm|ogv)$/i.test(url.pathname)) return { type: "video", src: safe };
  if (
    [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com",
    ].includes(host)
  ) {
    const id =
      host === "youtu.be"
        ? url.pathname.split("/")[1]
        : url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("קישור YouTube אינו תקין.");
    return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const direct = url.pathname.match(/^\/(\d+)(?:\/([a-f0-9]{6,}))?\/?$/i);
    const embedded = url.pathname.match(/\/(?:video|videos)\/(\d+)(?:\/|$)/);
    const channel = url.pathname.match(/^\/channels\/[^/]+\/(\d+)\/?$/);
    const id = direct?.[1] || embedded?.[1] || channel?.[1];
    if (!id) throw new Error("קישור Vimeo אינו תקין.");
    const privacy = url.searchParams.get("h") || direct?.[2];
    const hash = privacy && /^[a-f0-9]{6,}$/.test(privacy) && privacy !== id ? `?h=${privacy}` : "";
    return { type: "iframe", src: `https://player.vimeo.com/video/${id}${hash}` };
  }
  if (typeof location !== "undefined" && url.origin === location.origin)
    throw new Error("יש להשתמש בקישור הטמעה מאתר וידאו חיצוני.");
  return { type: "iframe", src: safe };
}
