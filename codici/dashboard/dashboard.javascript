document.addEventListener('DOMContentLoaded', async () => {
  // Navigazione tra le pagine
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = btn.getAttribute('data-target');
    });
  });

  // Ottenimento dati da localStorage con fallback ai file .json locali
  let players = [];
  let tournaments = [];

  try {
    const lsPlayers = localStorage.getItem('mpl_players');
    if (lsPlayers) {
      players = JSON.parse(lsPlayers);
    } else {
      const resP = await fetch('../giocatori/giocatori.json');
      if (resP.ok) {
        const jsonP = await resP.json();
        if (Array.isArray(jsonP) && jsonP.length > 0) {
          players = jsonP;
          localStorage.setItem('mpl_players', JSON.stringify(players));
        }
      }
    }
  } catch (e) {
    console.warn('Caricamento giocatori:', e);
  }

  try {
    const lsTournaments = localStorage.getItem('mpl_tournaments');
    if (lsTournaments) {
      tournaments = JSON.parse(lsTournaments);
    } else {
      const resT = await fetch('../torneo/torneo.json');
      if (resT.ok) {
        const jsonT = await resT.json();
        if (Array.isArray(jsonT) && jsonT.length > 0) {
          tournaments = jsonT;
          localStorage.setItem('mpl_tournaments', JSON.stringify(tournaments));
        }
      }
    }
  } catch (e) {
    console.warn('Caricamento tornei:', e);
  }

  // Calcolo statistiche generali
  let totalSets = 0;
  let totalGames = 0;

  tournaments.forEach(t => {
    totalSets += Number(t.totaleSet || 0);
    totalGames += Number(t.totaleGame || 0);
  });

  document.getElementById('kpiPlayers').textContent = players.length;
  document.getElementById('kpiTournaments').textContent = tournaments.length;
  document.getElementById('kpiSets').textContent = totalSets;
  document.getElementById('kpiGames').textContent = totalGames;

  // Aggregazione rendimento giocatori
  const enriched = players.map(p => {
    const stats = p.stats || {};
    const vittorieTornei = Number(stats.torneiVinti || 0);
    const partiteVinte = Number(stats.partiteVinte || 0);
    const partitePerse = Number(stats.partitePerse || 0);
    const setVinti = Number(stats.setVinti || 0);
    const setPersi = Number(stats.setPersi || 0);
    const gameVinti = Number(stats.gameVinti || 0);
    const gamePersi = Number(stats.gamePersi || 0);
    const podi = Number(stats.podi || 0);

    // Indice testa di serie: pesa tornei vinti, vittorie match, podi e diff set/game
    const seedRating =
      vittorieTornei * 100 +
      podi * 35 +
      partiteVinte * 15 -
      partitePerse * 4 +
      (setVinti - setPersi) * 3 +
      (gameVinti - gamePersi) * 0.5;

    return {
      ...p,
      vittorieTornei,
      partiteVinte,
      partitePerse,
      setVinti,
      setPersi,
      gameVinti,
      gamePersi,
      podi,
      seedRating: Math.round(seedRating * 10) / 10
    };
  });

  // Podio 3 più vincenti (per tornei vinti, poi partite vinte, poi diff set)
  const topWinners = [...enriched]
    .sort((a, b) =>
      b.vittorieTornei - a.vittorieTornei ||
      b.partiteVinte - a.partiteVinte ||
      (b.setVinti - b.setPersi) - (a.setVinti - a.setPersi)
    )
    .slice(0, 3);

  const podiumContainer = document.getElementById('podiumContainer');
  if (topWinners.length === 0) {
    podiumContainer.innerHTML = `<div class="empty-state">Nessun giocatore registrato. Inserisci i giocatori nella sezione <strong>Giocatori</strong> e disputa un torneo per popolare il podio.</div>`;
  } else {
    // Ordine visivo podio: 2° a sinistra, 1° al centro, 3° a destra
    const order = [
      { player: topWinners[1], rank: 2 },
      { player: topWinners[0], rank: 1 },
      { player: topWinners[2], rank: 3 }
    ].filter(item => item.player);

    podiumContainer.innerHTML = `
      <div class="podium-stage">
        ${order.map(({ player, rank }) => {
          const initials = ((player.nome?.[0] || '') + (player.cognome?.[0] || '')).toUpperCase();
          return `
            <div class="podium-step step-${rank}">
              <div class="podium-player">
                <div class="podium-avatar">${initials}</div>
                <div class="podium-name">${player.nome} ${player.cognome}</div>
                <div class="podium-nick">"${player.nickname || '-'}"</div>
                <div class="podium-stats">${player.vittorieTornei} tornei &bull; ${player.partiteVinte} W</div>
              </div>
              <div class="podium-block">${rank}°</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Prime 3 Teste di Serie
  const topSeeds = [...enriched]
    .sort((a, b) => b.seedRating - a.seedRating || b.partiteVinte - a.partiteVinte)
    .slice(0, 3);

  const seedsContainer = document.getElementById('seedsContainer');
  if (topSeeds.length === 0) {
    seedsContainer.innerHTML = `<div class="empty-state">Nessuna testa di serie disponibile.</div>`;
  } else {
    seedsContainer.innerHTML = topSeeds.map((p, idx) => `
      <div class="seed-item">
        <div class="seed-left">
          <div class="seed-rank">#${idx + 1}</div>
          <div class="seed-info">
            <h4>${p.nome} ${p.cognome}</h4>
            <span>Nickname: ${p.nickname || 'N/D'} &bull; ID: ${p.id}</span>
          </div>
        </div>
        <div class="seed-score">
          <strong>${p.seedRating} pt</strong>
          <small>${p.partiteVinte}V - ${p.partitePerse}P</small>
        </div>
      </div>
    `).join('');
  }
});
