function formatDuration(totalSeconds) {
  if (!totalSeconds) return "";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDate(isoDate) {
  // Parse as local calendar date, not UTC midnight, so the day doesn't
  // shift backwards in timezones behind UTC.
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderMix(mix, template) {
  const node = template.content.cloneNode(true);
  const audioUrl = new URL(mix.audio, AUDIO_BASE_URL).href;

  const cover = node.querySelector(".mix-cover");
  cover.src = mix.cover;
  cover.alt = `${mix.title} cover art`;

  node.querySelector(".mix-title").textContent = mix.title;
  node.querySelector(".mix-meta").textContent = [
    formatDate(mix.date),
    formatDuration(mix.durationSeconds),
  ]
    .filter(Boolean)
    .join(" · ");
  node.querySelector(".mix-description").textContent = mix.description || "";

  const audio = node.querySelector("audio");
  audio.src = audioUrl;

  const download = node.querySelector(".mix-download");
  download.href = audioUrl;
  download.download = mix.audio.split("/").pop();

  return node;
}

async function main() {
  const list = document.getElementById("mix-list");
  const template = document.getElementById("mix-card-template");

  const response = await fetch("mixes.json");
  const mixes = await response.json();

  mixes
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((mix) => list.appendChild(renderMix(mix, template)));
}

main();
