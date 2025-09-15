document.addEventListener('DOMContentLoaded', () => {
  const API      = 'https://api.coingecko.com/api/v3';
  const PER_PAGE = 250;
  let coins      = [];

  let visitCounts = {};
  try {
    visitCounts = JSON.parse(localStorage.getItem('visitCounts')) || {};
  } catch (e) {
    console.warn("Corrupted visitCounts in localStorage, resetting.");
    visitCounts = {};
  }

  const tbody       = document.querySelector('#crypto-table tbody');
  const searchInput = document.getElementById('search');
  const modal       = document.getElementById('modal');
  const modalTitle  = document.getElementById('modal-title');
  const modalClose  = document.getElementById('modal-close');

  const btnTop      = document.getElementById('btn-top');
  const btnTrending = document.getElementById('btn-trending');
  const btnNew      = document.getElementById('btn-new');
  const btnMost     = document.getElementById('btn-most');

  function debounce(fn, delay = 150) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  async function init() {
    const url = `${API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=1&sparkline=true`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      coins = await res.json();
      renderTable(coins);
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `
        <tr><td colspan="5" style="color:red;text-align:center">
          Error loading data: ${err.message}
        </td></tr>`;
    }
  }

  function renderTable(list) {
    tbody.innerHTML = '';
    if (!list || list.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;color:#888">
          No coins to display
        </td></tr>`;
      return;
    }

    list.forEach((c, i) => {
      const price  = c.current_price != null ? `$${c.current_price.toLocaleString()}` : '–';
      const change = c.price_change_percentage_24h != null ? `${c.price_change_percentage_24h.toFixed(2)}%` : '–';
      const cls    = c.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
 
      const row = document.createElement('tr');
      row.id = `row-${c.id}`;
      row.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${c.name}</strong><br/><small>(${c.symbol.toUpperCase()})</small></td>
        <td>${price}</td>
        <td class="${c.price_change_percentage_24h != null ? cls : ''}">${change}</td>
        <td class="sparkline-cell"><canvas id="spark-${c.id}"></canvas></td>
      `;
      tbody.appendChild(row);

      if (c.sparkline_in_7d && Array.isArray(c.sparkline_in_7d.price)) {
        drawSparkline(c);
      }

      row.addEventListener('click', () => openModal(c));
    });
  }

  function drawSparkline(coin) {
    const pts = coin.sparkline_in_7d.price.slice(-24);
    const ctx = document.getElementById(`spark-${coin.id}`).getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: pts.map(() => ''),
        datasets: [{
          data: pts,
          borderColor: coin.price_change_percentage_24h >= 0 ? '#00ffcc' : '#ff4d4d',
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x:{display:false}, y:{display:false} },
        plugins:{ legend:{ display:false } }
      }
    });
  }

  async function openModal(coin) {
    visitCounts[coin.id] = (visitCounts[coin.id] || 0) + 1;
    localStorage.setItem('visitCounts', JSON.stringify(visitCounts));

    modalTitle.textContent = `${coin.name} — Last 30 Days`;
    modal.classList.remove('hidden');

    const old   = document.getElementById('modal-chart');
    const fresh = old.cloneNode();
    fresh.id    = 'modal-chart';
    old.parentNode.replaceChild(fresh, old);
    const ctx   = fresh.getContext('2d');

    try {
      const res = await fetch(`${API}/coins/${coin.id}/market_chart?vs_currency=usd&days=30`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.prices?.length) throw new Error('No 30-day data');

      const prices = data.prices.map(p => p[1]);
      const labels = data.prices.map(p => {
        const d = new Date(p[0]);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });

      new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: prices,
            borderColor: '#00ffcc',
            backgroundColor: 'rgba(0,255,204,0.2)',
            pointRadius: 0,
            fill: true,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          scales: { x:{ ticks:{ maxTicksLimit:10 } } }
        }
      });
    } catch (err) {
      console.error(err);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(err.message, fresh.width/2, fresh.height/2);
    }
  }

  if (modalClose) {
    modalClose.addEventListener('click', () => modal.classList.add('hidden'));
  }

  function clearActive() {
    [btnTop, btnTrending, btnNew, btnMost].forEach(b => b?.classList.remove('active'));
  }

  function loadTop() {
    clearActive();
    btnTop?.classList.add('active');
    renderTable(coins.slice(0, 10));
  }

  async function loadTrending() {
    clearActive();
    btnTrending?.classList.add('active');
    try {
      const r1 = await fetch(`${API}/search/trending`);
      if (!r1.ok) throw new Error(r1.status);
      const { coins: arr } = await r1.json();
      const ids = arr.map(o => o.item.id).slice(0, 10);
      const r2 = await fetch(`${API}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=true`);
      if (!r2.ok) throw new Error(r2.status);
      const data = await r2.json();
      renderTable(data);
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" style="color:red;text-align:center">Error loading trending: ${e.message}</td></tr>`;
    }
  }

  async function loadNew() {
    clearActive();
    btnNew?.classList.add('active');
    try {
      const r = await fetch(`${API}/coins/markets?vs_currency=usd&order=market_cap_asc&per_page=10&page=1&sparkline=true`);
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      renderTable(data);
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" style="color:red;text-align:center">Error loading new: ${e.message}</td></tr>`;
    }
  }

  function loadMostVisited() {
    clearActive();
    btnMost?.classList.add('active');
    const visited = Object.entries(visitCounts)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    if (!visited.length || visited[0].count === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888">No “Most Visited” data yet</td></tr>`;
      return;
    }

    const subset = visited.map(o => coins.find(c => c.id === o.id)).filter(Boolean);
    renderTable(subset);
  }

  function handleSearch() {
    const q = searchInput.value.trim().toLowerCase();
    coins.forEach(c => {
      const row = document.getElementById(`row-${c.id}`);
      if (!row) return;
      const match = c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q);
      row.style.display = match ? '' : 'none';
    });
  }

  searchInput?.addEventListener('input', debounce(handleSearch));
  btnTop?.addEventListener('click', loadTop);
  btnTrending?.addEventListener('click', loadTrending);
  btnNew?.addEventListener('click', loadNew);
  btnMost?.addEventListener('click', loadMostVisited);

  init();
});
 
