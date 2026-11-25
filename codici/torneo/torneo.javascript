document.addEventListener('DOMContentLoaded', async () => {
  // Navigazione
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = btn.getAttribute('data-target');
    });
  });

  const playerSelect = document.getElementById('playerSelect');
  const btnAddPlayer = document.getElementById('btnAddPlayer');
  const selectedPlayersList = document.getElementById('selectedPlayersList');
  const participantsCounter = document.getElementById('participantsCounter');
  const form = document.getElementById('tournamentForm');

  const titleInput = document.getElementById('tournamentTitle');
  const descInput = document.getElementById('tournamentDesc');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const formatSelect = document.getElementById('tournamentFormat');
  const bestOfSelect = document.getElementById('bestOfSets');

  const matchesSection = document.getElementById('matchesSection');
  const phaseBanner = document.getElementById('phaseBanner');
  const standingsContainer = document.getElementById('standingsContainer');
  const matchesList = document.getElementById('matchesList');
  const btnConfirmPhase = document.getElementById('btnConfirmPhase');
  const btnResetTournament = document.getElementById('btnResetTournament');
  const podiumOutput = document.getElementById('podiumOutput');

  let allPlayers = [];
  let selectedPlayers = [];
  let activeTournament = null;

  // Caricamento giocatori da localStorage o giocatori.json
  async function loadPlayers() {
    const saved = localStorage.getItem('mpl_players');
    if (saved) {
      allPlayers = JSON.parse(saved);
    } else {
      try {
        const res = await fetch('../giocatori/giocatori.json');
        if (res.ok) {
          allPlayers = await res.json();
          localStorage.setItem('mpl_players', JSON.stringify(allPlayers));
        }
      } catch (e) {
        allPlayers = [];
      }
    }
    populatePlayerSelect();
  }

  function populatePlayerSelect() {
    playerSelect.innerHTML = `<option value="">-- Seleziona giocatore dall'anagrafica --</option>`;
    allPlayers.forEach(p => {
      if (!selectedPlayers.some(sp => sp.id === p.id)) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nome} ${p.cognome} (${p.nickname || p.id})`;
        playerSelect.appendChild(opt);
      }
    });
  }

  function renderSelectedPlayers() {
    participantsCounter.textContent = selectedPlayers.length;
    if (selectedPlayers.length === 0) {
      selectedPlayersList.innerHTML = `<span style="color:var(--text-muted); font-size:0.88rem;">Nessun partecipante selezionato.</span>`;
    } else {
      selectedPlayersList.innerHTML = selectedPlayers.map(p => `
        <div class="player-chip">
          <span>${p.nome} ${p.cognome} <em>(${p.nickname || p.id})</em></span>
          <button type="button" data-remove-id="${p.id}" title="Rimuovi">&times;</button>
        </div>
      `).join('');
    }
    populatePlayerSelect();
  }

  btnAddPlayer.addEventListener('click', () => {
    const id = playerSelect.value;
    if (!id) return;
    const found = allPlayers.find(p => p.id === id);
    if (found && !selectedPlayers.some(sp => sp.id === id)) {
      selectedPlayers.push(found);
      document.getElementById('errPlayers').classList.remove('visible');
      renderSelectedPlayers();
    }
  });

  selectedPlayersList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-remove-id');
    selectedPlayers = selectedPlayers.filter(p => p.id !== id);
    renderSelectedPlayers();
  });

  // Validazione form
  function validateForm() {
    let valid = true;

    const title = titleInput.value.trim();
    if (title.length < 3) {
      titleInput.classList.add('field-error');
      document.getElementById('errTitle').classList.add('visible');
      valid = false;
    } else {
      titleInput.classList.remove('field-error');
      document.getElementById('errTitle').classList.remove('visible');
    }

    const start = startDateInput.value;
    if (!start) {
      startDateInput.classList.add('field-error');
      document.getElementById('errStartDate').classList.add('visible');
      valid = false;
    } else {
      startDateInput.classList.remove('field-error');
      document.getElementById('errStartDate').classList.remove('visible');
    }

    const end = endDateInput.value;
    if (!end || (start && end < start)) {
      endDateInput.classList.add('field-error');
      document.getElementById('errEndDate').classList.add('visible');
      valid = false;
    } else {
      endDateInput.classList.remove('field-error');
      document.getElementById('errEndDate').classList.remove('visible');
    }

    if (selectedPlayers.length < 3) {
      document.getElementById('errPlayers').classList.add('visible');
      valid = false;
    } else {
      document.getElementById('errPlayers').classList.remove('visible');
    }

    return valid;
  }

  /**
   * VINCOLO FONDAMENTALE:
   * Ordina gli incontri in modo che NESSUN giocatore disputi due partite consecutive
   * (deve avere almeno una partita di pausa tra due suoi incontri).
   */
  function scheduleMatchesWithRest(rawMatches) {
    if (rawMatches.length <= 1) return rawMatches;

    // Backtracking con euristica MRV per garantire zero giocatori consecutivi
    const used = new Array(rawMatches.length).fill(false);
    const result = [];

    function sharesPlayer(m1, m2) {
      if (!m1 || !m2) return false;
      const p1 = [m1.p1.id, m1.p2.id];
      const p2 = [m2.p1.id, m2.p2.id];
      return p1.some(id => p2.includes(id));
    }

    function backtrack(lastMatch) {
      if (result.length === rawMatches.length) return true;

      // Ordina candidati dando priorità ai giocatori con più partite rimanenti
      const remainingCounts = {};
      rawMatches.forEach((m, i) => {
        if (!used[i]) {
          remainingCounts[m.p1.id] = (remainingCounts[m.p1.id] || 0) + 1;
          remainingCounts[m.p2.id] = (remainingCounts[m.p2.id] || 0) + 1;
        }
      });

      const candidates = [];
      for (let i = 0; i < rawMatches.length; i++) {
        if (!used[i] && !sharesPlayer(lastMatch, rawMatches[i])) {
          const weight = (remainingCounts[rawMatches[i].p1.id] || 0) + (remainingCounts[rawMatches[i].p2.id] || 0);
          candidates.push({ index: i, weight });
        }
      }

      candidates.sort((a, b) => b.weight - a.weight);

      for (const cand of candidates) {
        used[cand.index] = true;
        result.push(rawMatches[cand.index]);
        if (backtrack(rawMatches[cand.index])) return true;
        result.pop();
        used[cand.index] = false;
      }
      return false;
    }

    if (backtrack(null)) {
      return result;
    }

    // Fallback greedy nel rarissimo caso matematico (es. 3 giocatori con 1 solo match ciascuno)
    const pool = [...rawMatches];
    const fallback = [];
    let prev = null;
    while (pool.length > 0) {
      let idx = pool.findIndex(m => !sharesPlayer(prev, m));
      if (idx === -1) idx = 0;
      const chosen = pool.splice(idx, 1)[0];
      fallback.push(chosen);
      prev = chosen;
    }
    return fallback;
  }

  // Genera incontri Girone (solo andata o andata/ritorno)
  function buildRoundRobinMatches(participants, doubleLeg) {
    const matches = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        matches.push({
          id: `M-${matches.length + 1}`,
          fase: 'Girone (Andata)',
          p1: participants[i],
          p2: participants[j],
          sets: [],
          completed: false,
          winnerId: null
        });
      }
    }
    if (doubleLeg) {
      const returnMatches = matches.map((m, idx) => ({
        id: `M-${matches.length + idx + 1}`,
        fase: 'Girone (Ritorno)',
        p1: m.p2,
        p2: m.p1,
        sets: [],
        completed: false,
        winnerId: null
      }));
      return scheduleMatchesWithRest([...matches, ...returnMatches]);
    }
    return scheduleMatchesWithRest(matches);
  }

  // Genera turno eliminazione diretta (Andata/Ritorno tranne FINALE che è sempre SECCA)
  function buildKnockoutRound(participants, doubleLeg, roundName) {
    const isFinal = participants.length === 2;
    const effectiveDoubleLeg = isFinal ? false : doubleLeg; // ATTENZIONE: finale sempre secca!
    const label = isFinal ? 'FINALE (Gara Secca)' : roundName;

    const pairs = [];
    const count = participants.length;
    // Se dispari, il primo passa con BYE
    let activeList = [...participants];
    let byePlayer = null;
    if (activeList.length % 2 !== 0) {
      byePlayer = activeList.shift();
    }

    for (let i = 0; i < activeList.length / 2; i++) {
      const p1 = activeList[i];
      const p2 = activeList[activeList.length - 1 - i];
      pairs.push({
        id: `KO-${Date.now()}-${i}-A`,
        fase: `${label}${effectiveDoubleLeg ? ' - Andata' : ''}`,
        tieKey: `TIE-${i}`,
        p1,
        p2,
        sets: [],
        completed: false,
        winnerId: null
      });
      if (effectiveDoubleLeg) {
        pairs.push({
          id: `KO-${Date.now()}-${i}-R`,
          fase: `${label} - Ritorno`,
          tieKey: `TIE-${i}`,
          p1: p2,
          p2: p1,
          sets: [],
          completed: false,
          winnerId: null
        });
      }
    }

    return {
      matches: scheduleMatchesWithRest(pairs),
      byePlayer,
      isFinal,
      effectiveDoubleLeg
    };
  }

  function getRoundLabel(numPlayers) {
    if (numPlayers === 2) return 'FINALE (Gara Secca)';
    if (numPlayers <= 4) return 'Semifinali';
    if (numPlayers <= 8) return 'Quarti di Finale';
    return 'Turno Eliminatorio';
  }

  // Generazione torneo al submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const format = formatSelect.value;
    const bestOf = Number(bestOfSelect.value);
    const hasGroups = format.startsWith('girone') || format.startsWith('gironi');
    const groupsDouble = format.includes('girone_andata_ritorno') || format.includes('gironi_ar');
    const knockoutDouble = format.includes('finali_andata_ritorno') || format.includes('finali_ar');

    activeTournament = {
      id: `TRN-${Date.now()}`,
      titolo: titleInput.value.trim(),
      descrizione: descInput.value.trim(),
      dataInizio: startDateInput.value,
      dataFine: endDateInput.value,
      formula: format,
      bestOf,
      partecipanti: [...selectedPlayers],
      hasGroups,
      groupsDouble,
      knockoutDouble,
      stage: hasGroups ? 'GROUP' : 'KNOCKOUT',
      currentMatches: [],
      allPlayedMatches: [],
      byePlayer: null,
      semifinalLosers: [],
      podium: [],
      finished: false
    };

    if (hasGroups) {
      activeTournament.currentMatches = buildRoundRobinMatches(selectedPlayers, groupsDouble);
    } else {
      const ko = buildKnockoutRound(selectedPlayers, knockoutDouble, getRoundLabel(selectedPlayers.length));
      activeTournament.currentMatches = ko.matches;
      activeTournament.byePlayer = ko.byePlayer;
    }

    localStorage.setItem('mpl_active_tournament', JSON.stringify(activeTournament));
    renderActiveTournament();
  });

  function renderActiveTournament() {
    if (!activeTournament) return;
    matchesSection.classList.add('active');
    podiumOutput.innerHTML = '';

    const stageLabel = activeTournament.stage === 'GROUP'
      ? 'Fase a Gironi'
      : (activeTournament.currentMatches.length === 1 && activeTournament.currentMatches[0].fase.includes('FINALE')
        ? 'Finale Secca'
        : 'Fase ad Eliminazione Diretta');

    phaseBanner.innerHTML = `
      <div>
        <h4>${activeTournament.titolo} — ${stageLabel}</h4>
        <span>Dal ${activeTournament.dataInizio} al ${activeTournament.dataFine} &bull; Formula: Al meglio dei ${activeTournament.bestOf} set</span>
      </div>
      <div>
        <strong>${activeTournament.currentMatches.length}</strong> incontri in programma
      </div>
    `;

    // Se fase a gironi, mostra classifica live
    if (activeTournament.stage === 'GROUP') {
      const tableData = computeGroupStandings(activeTournament.partecipanti, activeTournament.currentMatches);
      standingsContainer.innerHTML = `
        <table class="standings-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Giocatore</th>
              <th>PG</th>
              <th>V</th>
              <th>P</th>
              <th>Set V-P</th>
              <th>Game V-P</th>
              <th>Punti</th>
            </tr>
          </thead>
          <tbody>
            ${tableData.map((row, idx) => `
              <tr>
                <td><strong>${idx + 1}°</strong></td>
                <td>${row.player.nome} ${row.player.cognome} (${row.player.nickname || '-'})</td>
                <td>${row.played}</td>
                <td>${row.won}</td>
                <td>${row.lost}</td>
                <td>${row.setsWon}-${row.setsLost}</td>
                <td>${row.gamesWon}-${row.gamesLost}</td>
                <td><strong>${row.points}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      standingsContainer.innerHTML = activeTournament.byePlayer
        ? `<p style="margin-bottom:14px; color:var(--pine-dark); font-weight:600;">Passaggio turno automatico (BYE): <strong>${activeTournament.byePlayer.nome} ${activeTournament.byePlayer.cognome}</strong></p>`
        : '';
    }

    const numSetBoxes = activeTournament.bestOf;
    matchesList.innerHTML = activeTournament.currentMatches.map((m, idx) => {
      const winnerName = m.winnerId
        ? (m.winnerId === m.p1.id ? `${m.p1.nome} ${m.p1.cognome}` : `${m.p2.nome} ${m.p2.cognome}`)
        : null;

      let setInputsHtml = '';
      for (let s = 0; s < numSetBoxes; s++) {
        const g1 = m.sets[s] ? m.sets[s].g1 : '';
        const g2 = m.sets[s] ? m.sets[s].g2 : '';
        setInputsHtml += `
          <div class="set-box">
            <label>Set ${s + 1}</label>
            <div class="set-pair">
              <input type="number" min="0" max="7" data-match="${idx}" data-set="${s}" data-side="1" value="${g1}" placeholder="0" />
              <span>-</span>
              <input type="number" min="0" max="7" data-match="${idx}" data-set="${s}" data-side="2" value="${g2}" placeholder="0" />
            </div>
          </div>
        `;
      }

      return `
        <div class="match-card ${m.completed ? 'completed' : ''}">
          <div class="match-order">
            Match #${idx + 1}
            <small>${m.fase}</small>
          </div>
          <div class="match-players">
            <span>${m.p1.nome} ${m.p1.cognome}</span>
            <span class="vs-badge">VS</span>
            <span>${m.p2.nome} ${m.p2.cognome}</span>
            ${winnerName ? `<span class="winner-tag">Vince: ${winnerName}</span>` : ''}
          </div>
          <div class="sets-inputs">
            ${setInputsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  // Valutazione singolo match in base agli input dei set
  function evaluateMatchesFromInputs() {
    const setsNeededToWin = Math.ceil(activeTournament.bestOf / 2);

    for (let i = 0; i < activeTournament.currentMatches.length; i++) {
      const match = activeTournament.currentMatches[i];
      const sets = [];
      let s1 = 0;
      let s2 = 0;

      for (let s = 0; s < activeTournament.bestOf; s++) {
        const inp1 = matchesList.querySelector(`input[data-match="${i}"][data-set="${s}"][data-side="1"]`);
        const inp2 = matchesList.querySelector(`input[data-match="${i}"][data-set="${s}"][data-side="2"]`);
        const v1 = inp1.value !== '' ? Number(inp1.value) : null;
        const v2 = inp2.value !== '' ? Number(inp2.value) : null;

        if (v1 !== null && v2 !== null) {
          if (v1 === v2) {
            alert(`Match #${i + 1} (Set ${s + 1}): un set non può terminare in pareggio.`);
            return false;
          }
          sets.push({ g1: v1, g2: v2 });
          if (v1 > v2) s1++;
          else s2++;
        }
      }

      if (s1 < setsNeededToWin && s2 < setsNeededToWin) {
        alert(`Completa il risultato del Match #${i + 1} (${match.p1.nome} vs ${match.p2.nome}): servono ${setsNeededToWin} set vinti.`);
        return false;
      }

      match.sets = sets;
      match.completed = true;
      match.winnerId = s1 > s2 ? match.p1.id : match.p2.id;
    }

    return true;
  }

  function computeGroupStandings(participants, matches) {
    const map = {};
    participants.forEach(p => {
      map[p.id] = {
        player: p,
        played: 0,
        won: 0,
        lost: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 0
      };
    });

    matches.forEach(m => {
      if (!m.completed) return;
      const r1 = map[m.p1.id];
      const r2 = map[m.p2.id];
      r1.played++;
      r2.played++;

      m.sets.forEach(s => {
        r1.gamesWon += s.g1;
        r1.gamesLost += s.g2;
        r2.gamesWon += s.g2;
        r2.gamesLost += s.g1;
        if (s.g1 > s.g2) {
          r1.setsWon++;
          r2.setsLost++;
        } else {
          r2.setsWon++;
          r1.setsLost++;
        }
      });

      if (m.winnerId === m.p1.id) {
        r1.won++;
        r1.points += 3;
        r2.lost++;
      } else {
        r2.won++;
        r2.points += 3;
        r1.lost++;
      }
    });

    return Object.values(map).sort((a, b) =>
      b.points - a.points ||
      (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
      (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)
    );
  }

  // Conferma risultati fase e avanzamento torneo
  btnConfirmPhase.addEventListener('click', () => {
    if (!activeTournament || activeTournament.finished) return;
    if (!evaluateMatchesFromInputs()) return;

    activeTournament.allPlayedMatches.push(...activeTournament.currentMatches);
    const formula = activeTournament.formula;
    const onlyGroups = formula === 'girone_solo_andata' || formula === 'girone_andata_ritorno';

    if (activeTournament.stage === 'GROUP') {
      const standings = computeGroupStandings(activeTournament.partecipanti, activeTournament.currentMatches);
      if (onlyGroups) {
        // Torneo concluso: classifica finale dal girone
        const fullRanking = standings.map((s, idx) => ({
          posizione: idx + 1,
          player: s.player
        }));
        finalizeTournament(fullRanking);
        return;
      } else {
        // Passa alle fasi finali con i migliori (fino a 4 o tutti se <=4)
        const qualifiersCount = standings.length >= 4 ? 4 : standings.length;
        const qualifiers = standings.slice(0, qualifiersCount).map(s => s.player);
        activeTournament.eliminatedInGroups = standings.slice(qualifiersCount).map(s => s.player);
        activeTournament.stage = 'KNOCKOUT';
        const ko = buildKnockoutRound(qualifiers, activeTournament.knockoutDouble, getRoundLabel(qualifiers.length));
        activeTournament.currentMatches = ko.matches;
        activeTournament.byePlayer = ko.byePlayer;
        localStorage.setItem('mpl_active_tournament', JSON.stringify(activeTournament));
        renderActiveTournament();
        return;
      }
    }

    // Gestione turno eliminazione diretta
    const isFinalRound = activeTournament.currentMatches.length === 1 && activeTournament.currentMatches[0].fase.includes('FINALE');
    if (isFinalRound) {
      const finalMatch = activeTournament.currentMatches[0];
      const champion = finalMatch.winnerId === finalMatch.p1.id ? finalMatch.p1 : finalMatch.p2;
      const runnerUp = finalMatch.winnerId === finalMatch.p1.id ? finalMatch.p2 : finalMatch.p1;
      const thirdPlace = activeTournament.semifinalLosers[0] || (activeTournament.eliminatedInGroups && activeTournament.eliminatedInGroups[0]) || null;

      const ranking = [
        { posizione: 1, player: champion },
        { posizione: 2, player: runnerUp }
      ];
      if (thirdPlace) ranking.push({ posizione: 3, player: thirdPlace });

      // Aggiungi restanti partecipanti
      let posCounter = ranking.length + 1;
      activeTournament.partecipanti.forEach(p => {
        if (!ranking.some(r => r.player.id === p.id)) {
          ranking.push({ posizione: posCounter++, player: p });
        }
      });

      finalizeTournament(ranking);
      return;
    }

    // Calcola vincitori del turno KO (gestendo sia gara secca che andata/ritorno)
    const tieGroups = {};
    activeTournament.currentMatches.forEach(m => {
      if (!tieGroups[m.tieKey]) tieGroups[m.tieKey] = [];
      tieGroups[m.tieKey].push(m);
    });

    const winners = [];
    const losers = [];

    Object.values(tieGroups).forEach(legs => {
      const pA = legs[0].p1;
      const pB = legs[0].p2;
      let winsA = 0, winsB = 0, setsA = 0, setsB = 0, gamesA = 0, gamesB = 0;

      legs.forEach(leg => {
        if (leg.winnerId === pA.id) winsA++;
        else winsB++;

        leg.sets.forEach(s => {
          if (leg.p1.id === pA.id) {
            gamesA += s.g1; gamesB += s.g2;
            if (s.g1 > s.g2) setsA++; else setsB++;
          } else {
            gamesA += s.g2; gamesB += s.g1;
            if (s.g2 > s.g1) setsA++; else setsB++;
          }
        });
      });

      const aAdvances =
        winsA > winsB ||
        (winsA === winsB && setsA > setsB) ||
        (winsA === winsB && setsA === setsB && gamesA >= gamesB);

      if (aAdvances) {
        winners.push(pA);
        losers.push(pB);
      } else {
        winners.push(pB);
        losers.push(pA);
      }
    });

    if (activeTournament.byePlayer) {
      winners.unshift(activeTournament.byePlayer);
      activeTournament.byePlayer = null;
    }

    if (winners.length === 2) {
      activeTournament.semifinalLosers = losers;
    }

    const nextKo = buildKnockoutRound(winners, activeTournament.knockoutDouble, getRoundLabel(winners.length));
    activeTournament.currentMatches = nextKo.matches;
    activeTournament.byePlayer = nextKo.byePlayer;
    localStorage.setItem('mpl_active_tournament', JSON.stringify(activeTournament));
    renderActiveTournament();
  });

  // Salvataggio podio su torneo.json (storage) e piazzamenti su giocatori.json (storage)
  function finalizeTournament(fullRanking) {
    activeTournament.finished = true;
    const topThree = fullRanking.slice(0, 3).map(r => ({
      posizione: r.posizione,
      id: r.player.id,
      nome: r.player.nome,
      cognome: r.player.cognome,
      nickname: r.player.nickname || ''
    }));

    // Calcolo totali game e set del torneo
    let totaleSet = 0;
    let totaleGame = 0;
    const perPlayerMatchStats = {};

    activeTournament.partecipanti.forEach(p => {
      perPlayerMatchStats[p.id] = {
        partiteVinte: 0,
        partitePerse: 0,
        setVinti: 0,
        setPersi: 0,
        gameVinti: 0,
        gamePersi: 0
      };
    });

    activeTournament.allPlayedMatches.forEach(m => {
      totaleSet += m.sets.length;
      const st1 = perPlayerMatchStats[m.p1.id];
      const st2 = perPlayerMatchStats[m.p2.id];

      if (m.winnerId === m.p1.id) {
        if (st1) st1.partiteVinte++;
        if (st2) st2.partitePerse++;
      } else {
        if (st2) st2.partiteVinte++;
        if (st1) st1.partitePerse++;
      }

      m.sets.forEach(s => {
        totaleGame += s.g1 + s.g2;
        if (st1) {
          st1.gameVinti += s.g1;
          st1.gamePersi += s.g2;
          if (s.g1 > s.g2) st1.setVinti++; else st1.setPersi++;
        }
        if (st2) {
          st2.gameVinti += s.g2;
          st2.gamePersi += s.g1;
          if (s.g2 > s.g1) st2.setVinti++; else st2.setPersi++;
        }
      });
    });

    // 1. Aggiorna archivio tornei ("torneo.json")
    const archivedTournaments = JSON.parse(localStorage.getItem('mpl_tournaments') || '[]');
    const tournamentRecord = {
      id: activeTournament.id,
      titolo: activeTournament.titolo,
      descrizione: activeTournament.descrizione,
      dataInizio: activeTournament.dataInizio,
      dataFine: activeTournament.dataFine,
      formula: activeTournament.formula,
      bestOf: activeTournament.bestOf,
      podio: topThree,
      totaleSet,
      totaleGame,
      numeroIncontri: activeTournament.allPlayedMatches.length
    };
    archivedTournaments.push(tournamentRecord);
    localStorage.setItem('mpl_tournaments', JSON.stringify(archivedTournaments));

    // 2. Aggiorna piazzamenti e statistiche di ogni giocatore ("giocatori.json")
    const updatedPlayers = allPlayers.map(p => {
      const rankEntry = fullRanking.find(r => r.player.id === p.id);
      if (!rankEntry) return p;

      const mStats = perPlayerMatchStats[p.id];
      const prevStats = p.stats || {
        torneiGiocati: 0, torneiVinti: 0, podi: 0,
        partiteVinte: 0, partitePerse: 0,
        setVinti: 0, setPersi: 0,
        gameVinti: 0, gamePersi: 0
      };

      const piazzamenti = Array.isArray(p.piazzamenti) ? [...p.piazzamenti] : [];
      piazzamenti.push({
        torneoId: activeTournament.id,
        torneoTitolo: activeTournament.titolo,
        dataFine: activeTournament.dataFine,
        posizione: rankEntry.posizione
      });

      return {
        ...p,
        piazzamenti,
        stats: {
          torneiGiocati: prevStats.torneiGiocati + 1,
          torneiVinti: prevStats.torneiVinti + (rankEntry.posizione === 1 ? 1 : 0),
          podi: prevStats.podi + (rankEntry.posizione <= 3 ? 1 : 0),
          partiteVinte: prevStats.partiteVinte + (mStats ? mStats.partiteVinte : 0),
          partitePerse: prevStats.partitePerse + (mStats ? mStats.partitePerse : 0),
          setVinti: prevStats.setVinti + (mStats ? mStats.setVinti : 0),
          setPersi: prevStats.setPersi + (mStats ? mStats.setPersi : 0),
          gameVinti: prevStats.gameVinti + (mStats ? mStats.gameVinti : 0),
          gamePersi: prevStats.gamePersi + (mStats ? mStats.gamePersi : 0)
        }
      };
    });

    allPlayers = updatedPlayers;
    localStorage.setItem('mpl_players', JSON.stringify(allPlayers));
    localStorage.removeItem('mpl_active_tournament');

    renderActiveTournament();
    btnConfirmPhase.style.display = 'none';

    podiumOutput.innerHTML = `
      <div class="podium-result-box">
        <h4>Torneo Concluso! Podio Ufficiale Salvato</h4>
        <div class="podium-cards">
          ${topThree.map(t => `
            <div class="podium-mini">
              <strong>${t.posizione}° Posto</strong>
              <div style="font-size:1.1rem; font-weight:800; color:var(--pine-dark); margin:4px 0;">${t.nome} ${t.cognome}</div>
              <small style="color:var(--text-muted);">Nickname: ${t.nickname || '-'}</small>
            </div>
          `).join('')}
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button type="button" class="btn btn-pine" id="btnExportTorneoJson">Esporta torneo.json</button>
          <button type="button" class="btn btn-ochre" id="btnExportGiocatoriJson">Esporta giocatori.json</button>
        </div>
      </div>
    `;

    document.getElementById('btnExportTorneoJson').addEventListener('click', () => {
      downloadJsonFile('torneo.json', archivedTournaments);
    });
    document.getElementById('btnExportGiocatoriJson').addEventListener('click', () => {
      downloadJsonFile('giocatori.json', allPlayers);
    });
  }

  function downloadJsonFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  btnResetTournament.addEventListener('click', () => {
    activeTournament = null;
    localStorage.removeItem('mpl_active_tournament');
    matchesSection.classList.remove('active');
    btnConfirmPhase.style.display = 'inline-block';
    podiumOutput.innerHTML = '';
    form.reset();
    selectedPlayers = [];
    renderSelectedPlayers();
  });

  await loadPlayers();
  renderSelectedPlayers();

  // Ripristina eventuale torneo in corso
  const savedActive = localStorage.getItem('mpl_active_tournament');
  if (savedActive) {
    activeTournament = JSON.parse(savedActive);
    renderActiveTournament();
  }
});
