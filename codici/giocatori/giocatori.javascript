document.addEventListener('DOMContentLoaded', async () => {
  // Navigazione
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = btn.getAttribute('data-target');
    });
  });

  const form = document.getElementById('playerForm');
  const nomeInput = document.getElementById('playerNome');
  const cognomeInput = document.getElementById('playerCognome');
  const nicknameInput = document.getElementById('playerNickname');
  const tableBody = document.getElementById('playersTableBody');
  const countSpan = document.getElementById('playersCount');
  const editingBanner = document.getElementById('editingBanner');
  const editingIdLabel = document.getElementById('editingIdLabel');
  const formTitle = document.getElementById('formTitle');
  const btnSubmit = document.getElementById('btnSubmitPlayer');
  const btnCancelEdit = document.getElementById('btnCancelEdit');
  const btnLoadSaves = document.getElementById('btnLoadSaves');
  const btnDownloadSaves = document.getElementById('btnDownloadSaves');
  const fileInputJson = document.getElementById('fileInputJson');

  let players = [];
  let editingId = null;

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function generatePlayerId() {
    const num = Math.floor(1000 + Math.random() * 9000);
    const id = `MPL-${num}`;
    return players.some(p => p.id === id) ? generatePlayerId() : id;
  }

  function saveToStorage() {
    localStorage.setItem('mpl_players', JSON.stringify(players));
  }

  async function initData() {
    const saved = localStorage.getItem('mpl_players');
    if (saved) {
      players = JSON.parse(saved);
    } else {
      try {
        const res = await fetch('giocatori.json');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            players = data;
            saveToStorage();
          }
        }
      } catch (e) {
        players = [];
      }
    }
    renderTable();
  }

  function resetEditMode() {
    editingId = null;
    editingBanner.classList.remove('visible');
    formTitle.textContent = 'Nuovo Giocatore';
    btnSubmit.textContent = 'Salva Giocatore';
    form.reset();
  }

  function renderTable() {
    countSpan.textContent = players.length;
    if (players.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#5C6B63;">Nessun giocatore presente nel database. Aggiungine uno dal form qui sopra.</td></tr>`;
      return;
    }

    tableBody.innerHTML = players.map(player => `
      <tr>
        <td><strong>${escapeHtml(player.nome)}</strong></td>
        <td>${escapeHtml(player.cognome)}</td>
        <td>${escapeHtml(player.nickname || '-')}</td>
        <td><span class="id-badge">${escapeHtml(player.id)}</span></td>
        <td class="action-cell">
          <button type="button" class="btn-sm btn-edit" data-action="edit" data-id="${player.id}">Modifica</button>
          <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${player.id}">Elimina</button>
        </td>
      </tr>
    `).join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Salvataggio / Modifica giocatore
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = nomeInput.value.trim();
    const cognome = cognomeInput.value.trim();
    const nickname = nicknameInput.value.trim();

    if (!nome || !cognome || !nickname) {
      showToast('Compila tutti i campi richiesti.');
      return;
    }

    if (editingId) {
      const idx = players.findIndex(p => p.id === editingId);
      if (idx !== -1) {
        players[idx] = {
          ...players[idx],
          nome,
          cognome,
          nickname
        };
        showToast(`Giocatore ${nome} ${cognome} aggiornato!`);
      }
      resetEditMode();
    } else {
      const newPlayer = {
        id: generatePlayerId(),
        nome,
        cognome,
        nickname,
        piazzamenti: [],
        stats: {
          torneiGiocati: 0,
          torneiVinti: 0,
          podi: 0,
          partiteVinte: 0,
          partitePerse: 0,
          setVinti: 0,
          setPersi: 0,
          gameVinti: 0,
          gamePersi: 0
        }
      };
      players.push(newPlayer);
      form.reset();
      showToast(`Giocatore ${nome} aggiunto con ID ${newPlayer.id}`);
    }

    saveToStorage();
    renderTable();
  });

  // Azioni tabella: Modifica ed Elimina
  tableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    const player = players.find(p => p.id === id);
    if (!player) return;

    if (action === 'edit') {
      editingId = id;
      nomeInput.value = player.nome;
      cognomeInput.value = player.cognome;
      nicknameInput.value = player.nickname || '';
      editingIdLabel.textContent = id;
      editingBanner.classList.add('visible');
      formTitle.textContent = `Modifica Giocatore (${id})`;
      btnSubmit.textContent = 'Aggiorna Giocatore';
      nomeInput.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'delete') {
      if (confirm(`Eliminare definitivamente ${player.nome} ${player.cognome}?`)) {
        players = players.filter(p => p.id !== id);
        if (editingId === id) resetEditMode();
        saveToStorage();
        renderTable();
        showToast('Giocatore eliminato.');
      }
    }
  });

  btnCancelEdit.addEventListener('click', resetEditMode);

  // Pulsante "scarica salvataggi" -> crea file "inserimento giocatori.json"
  btnDownloadSaves.addEventListener('click', () => {
    const jsonString = JSON.stringify(players, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inserimento giocatori.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('File "inserimento giocatori.json" scaricato!');
  });

  // Pulsante "carica salvataggi" -> carica file "inserimento giocatori.json"
  btnLoadSaves.addEventListener('click', () => {
    fileInputJson.click();
  });

  fileInputJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!Array.isArray(parsed)) {
          throw new Error('Formato JSON non valido: atteso un array di giocatori.');
        }
        players = parsed.map(item => ({
          id: item.id || generatePlayerId(),
          nome: item.nome || '',
          cognome: item.cognome || '',
          nickname: item.nickname || '',
          piazzamenti: Array.isArray(item.piazzamenti) ? item.piazzamenti : [],
          stats: item.stats || {
            torneiGiocati: 0,
            torneiVinti: 0,
            podi: 0,
            partiteVinte: 0,
            partitePerse: 0,
            setVinti: 0,
            setPersi: 0,
            gameVinti: 0,
            gamePersi: 0
          }
        }));
        saveToStorage();
        renderTable();
        showToast(`Caricati ${players.length} giocatori da "${file.name}"!`);
      } catch (err) {
        alert('Errore durante il caricamento del file JSON: ' + err.message);
      } finally {
        fileInputJson.value = '';
      }
    };
    reader.readAsText(file);
  });

  await initData();
});
