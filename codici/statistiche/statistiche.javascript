document.addEventListener('DOMContentLoaded', async () => {
  // Navigazione
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = btn.getAttribute('data-target');
    });
  });

  const searchInput = document.getElementById('globalSearch');
  const tournamentsContainer = document.getElementById('tournamentsStatsContainer');
  const playersContainer = document.getElementById('playersStatsContainer');
  const tournamentsBadge = document.getElementById('tournamentsCountBadge');
  const playersBadge = document.getElementById('playersCountBadge');

  let tournaments = [];
  let players = [];

  async function loadData() {
    try {
      const lsT = localStorage.getItem('mpl_tournaments');
      if (lsT) {
        tournaments = JSON.parse(lsT);
      } else {
        const resT = await fetch('../torneo/torneo.json');
        if (resT.ok) tournaments = await resT.json();
      }
    } catch (e) {
      tournaments = [];
    }

    try {
      const lsP = localStorage.getItem('mpl_players');
      if (lsP) {
        players = JSON.parse(lsP);
      } else {
        const resP = await fetch('../giocatori/giocatori.json');
        if (resP.ok) players = await resP.json();
      }
    } catch (e) {
      players = [];
    }

    renderAll('');
  }

  function renderAll(query) {
    const q = query.trim().toLowerCase();

    // 1. Render Tornei
    const filteredTournaments = tournaments.filter(t =>
      !q ||
      (t.titolo && t.titolo.toLowerCase().includes(q)) ||
      (t.podio && t.podio.some(p => `${p.nome} ${p.cognome} ${p.nickname}`.toLowerCase().includes(q)))
    );

    tournamentsBadge.textContent = `${filteredTournaments.length} tornei`;

    if (filteredTournaments.length === 0) {
      tournamentsContainer.innerHTML = `<div class="empty-box">Nessun torneo trovato. Completa un torneo nella sezione <strong>Torneo</strong> per visualizzarne qui date, podio, game e set svolti.</div>`;
    } else {
      tournamentsContainer.innerHTML = `
        <div class="tournaments-grid">
          ${filteredTournaments.map(t => `
            <article class="tournament-card">
              <h4>${t.titolo}</h4>
              <div class="tournament-dates">Dal ${t.dataInizio} al ${t.dataFine}</div>
              <div class="tournament-metrics">
                <span class="metric-pill">Set svolti: ${t.totaleSet || 0}</span>
                <span class="metric-pill">Game svolti: ${t.totaleGame || 0}</span>
              </div>
              <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:6px;">TOP TRE PODIO:</div>
              <ul class="top3-list">
                ${(t.podio || []).map(p => `
                  <li>
                    <span class="medal-${p.posizione}">${p.posizione}° ${p.nome} ${p.cognome}</span>
                    <span style="color:var(--text-muted);">(${p.nickname || p.id})</span>
                  </li>
                `).join('')}
              </ul>
            </article>
          `).join('')}
        </div>
      `;
    }

    // 2. Render Giocatori
    const filteredPlayers = players.filter(p =>
      !q ||
      `${p.nome} ${p.cognome} ${p.nickname} ${p.id}`.toLowerCase().includes(q)
    );

    playersBadge.textContent = `${filteredPlayers.length} giocatori`;

    if (filteredPlayers.length === 0) {
      playersContainer.innerHTML = `<div class="empty-box">Nessun giocatore trovato.</div>`;
    } else {
      playersContainer.innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Giocatore</th>
                <th>ID</th>
                <th>Tornei (V/G)</th>
                <th>Partite (V - P)</th>
                <th>Set (Vinti - Persi)</th>
                <th>Game (Vinti - Persi)</th>
                <th>Storico Posizioni</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPlayers.map(p => {
                const st = p.stats || {
                  torneiGiocati: 0, torneiVinti: 0,
                  partiteVinte: 0, partitePerse: 0,
                  setVinti: 0, setPersi: 0,
                  gameVinti: 0, gamePersi: 0
                };
                const piazzamenti = Array.isArray(p.piazzamenti) ? p.piazzamenti : [];

                return `
                  <tr>
                    <td>
                      <strong>${p.nome} ${p.cognome}</strong><br />
                      <small style="color:var(--text-muted);">"${p.nickname || '-'}"</small>
                    </td>
                    <td><code>${p.id}</code></td>
                    <td><strong>${st.torneiVinti}</strong> / ${st.torneiGiocati}</td>
                    <td>${st.partiteVinte} V - ${st.partitePerse} P</td>
                    <td><strong>${st.setVinti}</strong> - ${st.setPersi}</td>
                    <td><strong>${st.gameVinti}</strong> - ${st.gamePersi}</td>
                    <td>
                      <div class="pos-tags">
                        ${piazzamenti.length === 0
                          ? '<span style="color:var(--text-muted); font-size:0.82rem;">Nessun piazzamento</span>'
                          : piazzamenti.map(pos => `
                              <span class="pos-tag ${pos.posizione === 1 ? 'first' : ''}">
                                ${pos.posizione}° (${pos.torneoTitolo})
                              </span>
                            `).join('')
                        }
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  searchInput.addEventListener('input', (e) => {
    renderAll(e.target.value);
  });

  await loadData();
});
