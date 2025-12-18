import { supabase } from "../supabase/supabase.js";
import { User } from "../supabase/user.js";
import components from '../components/components.js';

class TVShow {
  constructor() {
    /* ===== PLAYER ===== */
    this.videoPlayer = document.getElementById("videoPlayer");
    this.currentTitle = document.getElementById("currentVideoTitle");

    /* ===== UI ===== */
    this.tvList = document.getElementById("tvList");
    this.breadcrumb = document.getElementById("tvBreadcrumb");

    /* ===== FILTER ===== */
    this.searchInput = document.getElementById("searchInput");
    this.genreFilter = document.getElementById("genreFilter");
    this.regionFilter = document.getElementById("regionFilter");

    /* ===== STATE ===== */
    this.currentSeries = null;

    this.init();
  }

  /* =======================
     INIT
  ======================= */

  async init() {
    await this.loadFilters();
    await this.loadSeries();
    this.bindEvents();
  }

  /* =======================
     FILTER DATA
  ======================= */

  async loadFilters() {
    const [{ data: genres }, { data: regions }] = await Promise.all([
      supabase.from("genre_movie").select("id, name").order("name"),
      supabase.from("region").select("id, name").order("name")
    ]);

    this.fillSelect(this.genreFilter, genres, "Thể loại");
    this.fillSelect(this.regionFilter, regions, "Quốc gia");
  }

  fillSelect(select, data, label) {
    if (!select) return;
    select.innerHTML = `<option value="">-- ${label} --</option>`;
    data?.forEach(item => {
      select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
    });
  }

  /* =======================
     LOAD SERIES
  ======================= */

  async loadSeries() {
    this.currentSeries = null;
    this.updateBreadcrumb();

    let query = supabase
      .from("movie_series")
      .select(`
        id,
        name,
        movie_data (
          id,
          title,
          url,
          region_id,
          movie_genre ( genre_id )
        )
      `)
      .order("name");

    const search = this.searchInput?.value.trim();
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Load series error:", error);
      return;
    }

    const genre = this.genreFilter?.value;
    const region = this.regionFilter?.value;

    const filtered = data
      .filter(series =>
        !region ||
        series.movie_data.some(ep => ep.region_id == region)
      )
      .filter(series =>
        !genre ||
        series.movie_data.some(ep =>
          ep.movie_genre.some(g => g.genre_id == genre)
        )
      );
    filtered.sort((a, b) => a.id - b.id);
    this.renderSeries(filtered);
  }

  /* =======================
     RENDER SERIES
  ======================= */

  renderSeries(seriesList) {
    if (!this.tvList) return;
    this.tvList.innerHTML = "";

    if (!seriesList.length) {
      this.tvList.innerHTML = `<p>Không có bộ phim phù hợp</p>`;
      return;
    }

    seriesList.forEach(series => {
      const card = document.createElement("div");
      card.className = "tv-card";
      card.innerHTML = `
        <h4>${series.name}</h4>
        <div class="meta">${series.movie_data.length} tập</div>
      `;
      card.onclick = () => this.showEpisodes(series);
      this.tvList.appendChild(card);
    });
  }

  /* =======================
     SHOW EPISODES
  ======================= */

  showEpisodes(series) {
    if (!this.tvList) return;

    this.currentSeries = series;
    this.updateBreadcrumb(series.name);

    this.tvList.innerHTML = `
      <button class="back-series-btn">Quay lại danh sách</button>
      <h3 style="margin:15px 0">${series.name}</h3>
    `;

    this.tvList.querySelector(".back-series-btn").onclick =
      () => this.loadSeries();

      series.movie_data
      .sort((a, b) => a.id - b.id)
      .forEach(ep => {
        const epCard = document.createElement("div");
        epCard.className = "tv-card";
        epCard.innerHTML = `
          <h4>${this.formatEpisodeTitle(ep.title)}</h4>
        `;
        epCard.onclick = () => this.playEpisode(series.name, ep);
        this.tvList.appendChild(epCard);
      });
  }

  /* =======================
     PLAY EPISODE
  ======================= */

  playEpisode(seriesName, episode) {
    if (!this.videoPlayer) return;

    this.videoPlayer.src = episode.url;
    this.videoPlayer.play().catch(() => {});

    if (this.currentTitle) {
      this.currentTitle.textContent =
        `${seriesName} – ${this.formatEpisodeTitle(episode.title)}`;
    }

    this.updateBreadcrumb(seriesName, this.formatEpisodeTitle(episode.title));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =======================
     BREADCRUMB
  ======================= */

  updateBreadcrumb(series = null, episode = null) {
    if (!this.breadcrumb) return;

    this.breadcrumb.innerHTML = "";

    const tv = document.createElement("span");
    tv.className = "crumb";
    tv.textContent = "TV";
    tv.onclick = () => this.loadSeries();
    this.breadcrumb.appendChild(tv);

    if (series) {
      const s = document.createElement("span");
      s.className = episode ? "crumb" : "crumb active";
      s.textContent = series;
      s.onclick = () => this.showEpisodes(this.currentSeries);
      this.breadcrumb.appendChild(s);
    }

    if (episode) {
      const e = document.createElement("span");
      e.className = "crumb active";
      e.textContent = episode;
      this.breadcrumb.appendChild(e);
    }
  }

  /* =======================
     TITLE FORMATTER
  ======================= */

  formatEpisodeTitle(title) {
    if (!title) return "";

    const epIndex = title.indexOf("Ep.");
    if (epIndex === -1) {
      return title.trim();
    }

    return title.substring(epIndex + 3).trim();
  }

  /* =======================
     EVENTS
  ======================= */

  bindEvents() {
    this.searchInput?.addEventListener("input", () => this.loadSeries());
    this.genreFilter?.addEventListener("change", () => this.loadSeries());
    this.regionFilter?.addEventListener("change", () => this.loadSeries());

    document.getElementById("backBtn")?.addEventListener("click", () => {
      history.back();
    });
  }
}

/* =======================
   INIT
======================= */

document.addEventListener("DOMContentLoaded", () => {
  components.init();
  new TVShow();
});
