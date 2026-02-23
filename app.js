// ==========================================
// CONFIGURAZIONE & STATO
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbxAO7z5LpV08PZHWv-gY4HQWXwyqz6UkFrfKXZBmAyixx42TyZTt02Et-C1nUrsAYsEZg/exec";

let currentMode = 'entrate';
let allData = {}; 
let speseList = []; 

// ==========================================
// INIZIALIZZAZIONE
// ==========================================
window.onload = function() {
    // Imposta data di oggi
    document.getElementById('data').valueAsDate = new Date();
    
    // Inizializza Filtri Lista (Mese/Anno)
    initFiltri();
    
    // Carica Dati Dropdown (Smart Cache)
    loadDataSmart();
    
    // Gestione input Euro (formatta mentre scrivi)
    setupCurrencyInput('importo');
    // Gestione input decimali generici (sostituisce virgola con punto)
    setupDecimalInput('kmQuadro');
    setupDecimalInput('prezzoLitro');
};

function setupCurrencyInput(id) {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', function(e) {
        let val = e.target.value.replace('.', ',').replace(/[^0-9,]/g, '');
        // Evita doppie virgole
        if ((val.match(/,/g) || []).length > 1) {
            val = val.substring(0, val.lastIndexOf(','));
        }
        e.target.value = val;
    });
}

function setupDecimalInput(id) {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace('.', ',');
    });
}

function initFiltri() {
    const mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const selMese = document.getElementById("filtroMese");
    const today = new Date();
    
    const fragment = document.createDocumentFragment();
    mesi.forEach((m, i) => {
        let opt = new Option(m, m);
        if(i === today.getMonth()) opt.selected = true;
        fragment.appendChild(opt);
    });
    selMese.appendChild(fragment);
    
    const selAnno = document.getElementById("filtroAnno");
    const curYear = today.getFullYear();
    const fragmentYear = document.createDocumentFragment();
    for(let y = 2024; y <= curYear + 1; y++) {
        let opt = new Option(y, y);
        if(y === curYear) opt.selected = true;
        fragmentYear.appendChild(opt);
    }
    selAnno.appendChild(fragmentYear);
}

// ==========================================
// DATA LOADING (SMART CACHE)
// ==========================================
function loadDataSmart() {
    let cachedDrop = localStorage.getItem("dropdown_data");
    let cachedVer = localStorage.getItem("dropdown_ver") || "0";

    if (cachedDrop) {
        try {
            allData = JSON.parse(cachedDrop);
            populateUI(allData);
        } catch (e) {
            console.error("Cache corrotta", e);
            localStorage.removeItem("dropdown_data");
        }
    }

    fetch(API_URL + "?action=getDropdownSmart&v=" + cachedVer)
    .then(res => res.json())
    .then(resp => {
        if (resp.updateNeeded) {
            allData = resp.data;
            localStorage.setItem("dropdown_data", JSON.stringify(allData));
            localStorage.setItem("dropdown_ver", resp.version);
            populateUI(allData);
        }
        updateIdsVisually();
    })
    .catch(err => {
        console.log("Offline dropdown", err);
    });
}

function updateIdsVisually() {
    const idField = document.getElementById('idAuto');
    if(!idField) return;
    if(currentMode === 'entrate') idField.value = allData.idEntrata || "";
    if(currentMode === 'spese') idField.value = allData.idSpesa || "";
}

function populateUI(data) {
    const fillSelect = (selId, items, isObj = false) => {
        const el = document.getElementById(selId);
        if(!el) return;
        el.innerHTML = ""; 
        items?.forEach(i => {
             let val = isObj ? i : i; 
             let txt = isObj ? i : i;
             if(isObj && i.length > 1) { val = i[0]; txt = i[1] || i[0]; }
             el.add(new Option(txt, val));
        });
    };

    fillSelect('conto', data.accounts);
    fillSelect('contoBen', data.accounts);
    
    let userList = ["Felice"];
    if(data.users) {
        userList = [...userList, ...data.users.filter(u => u!=="Felice")];
    }
    fillSelect('utente', userList);
    fillSelect('beneficiario', userList);
    document.getElementById('utente').value = "Felice";
    
    fillSelect('macchina', data.cars);

    switchTab(currentMode); 
}

// ==========================================
// LISTA SPESE (Performance Optimized)
// ==========================================
function loadSpeseList() {
    const loader = document.getElementById("loader-lista");
    loader.classList.remove('hidden');
    loader.innerText = "Check...";

    const cachedData = localStorage.getItem("spese_data");
    const cachedVer = localStorage.getItem("spese_ver") || "0";
    
    if (cachedData) {
        try {
            speseList = JSON.parse(cachedData);
            renderTable(); 
        } catch(e) { console.error(e); }
    }

    fetch(API_URL + "?action=getSpeseSmart&v=" + cachedVer)
    .then(res => res.json())
    .then(resp => {
        if (resp.updateNeeded) {
            speseList = resp.list;
            localStorage.setItem("spese_data", JSON.stringify(speseList));
            localStorage.setItem("spese_ver", resp.version);
            renderTable(); 
            loader.innerText = "Aggiornato";
        } else {
            loader.innerText = ""; 
        }
        setTimeout(() => loader.classList.add('hidden'), 1000);
    })
    .catch(() => { loader.innerText = "Offline"; });
}

function renderTable() {
    const tbody = document.getElementById("tbodySpese");
    if(!tbody) return;
    
    const mese = document.getElementById("filtroMese").value;
    const anno = document.getElementById("filtroAnno").value;
    const mesiMap = {"01":"Gennaio", "02":"Febbraio", "03":"Marzo", "04":"Aprile", "05":"Maggio", "06":"Giugno", "07":"Luglio", "08":"Agosto", "09":"Settembre", "10":"Ottobre", "11":"Novembre", "12":"Dicembre"};

    // Filtra per mese e anno
    let filtered = speseList.filter(r => {
        if(!r.data) return false;
        let parts = r.data.split('/'); 
        if(parts.length < 3) return false;
        return parts[2] === anno && mesiMap[parts[1]] === mese;
    });

    // --- MODIFICA ORDINAMENTO: DATA (Desc) e poi ID (Desc) ---
    filtered.sort((a, b) => {
        let da = a.data.split('/');
        let db = b.data.split('/');
        
        // 1. Confronto le date
        let dateDiff = new Date(db[2], db[1]-1, db[0]) - new Date(da[2], da[1]-1, da[0]);

        // 2. Se le date sono diverse, restituisco la differenza
        if (dateDiff !== 0) return dateDiff;

        // 3. Se le date sono uguali, ordino per ID decrescente
        return parseInt(b.id) - parseInt(a.id);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' class='empty-msg'>Nessuna spesa.</td></tr>";
        return;
    }

    // --- RENDER CON NOTE ---
    const rowsHTML = filtered.map(r => {
        let rimborsoBadge = (String(r.rimborso).toUpperCase() === "TRUE") 
            ? `<br><span class="badge-rimborso">RIMBORSO</span>` 
            : "";

        // Gestione Note: visualizzate sotto la sottocategoria
        let notaHTML = (r.note && r.note.trim() !== "") 
            ? `<br><span style="color:#555; font-size:11px; font-style:italic;">${r.note}</span>` 
            : "";

        let importoPulito = r.importo.toString().replace('€', '').trim();
        
        return `
            <tr>
                <td>${r.id}</td>
                <td>${r.data.substring(0,5)}</td>
                <td>
                    <b>${r.categoria}</b><br>
                    <span style="color:#666; font-size:11px;">${r.sottocategoria}</span>
                    ${notaHTML}
                    ${rimborsoBadge}
                </td>
                <td class="col-importo">€ ${importoPulito}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHTML.join("");
}

// ==========================================
// NAVIGAZIONE TABS
// ==========================================
function switchTab(mode) {
    currentMode = mode;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn');
    const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${mode}')"]`);
    if(activeBtn) activeBtn.classList.add('active-' + mode);

    if (mode === 'lista') {
        document.getElementById('area-lista').classList.remove('hidden');
        document.getElementById('area-input').classList.add('hidden');
        document.querySelectorAll('.save-btn-container').forEach(el => el.classList.add('hidden'));
        loadSpeseList(); 
        return;
    }
    
    document.getElementById('area-lista').classList.add('hidden');
    document.getElementById('area-input').classList.remove('hidden');

    const map = {
        'entrate': { show: ['group-subcat', 'group-idRif', 'area-categorie', 'area-dettagli'], hide: ['group-rimborso', 'area-macchina', 'area-beneficiario'], btnId: 'btn-group-main', btnClass: 'btn-entrate', btnText: 'Salva Entrata' },
        'spese': { show: ['group-subcat', 'group-rimborso', 'area-categorie', 'area-dettagli'], hide: ['group-idRif', 'area-macchina', 'area-beneficiario'], btnId: 'btn-group-main', btnClass: 'btn-spese', btnText: 'Salva Spesa' },
        'risparmi': { show: ['area-dettagli'], hide: ['group-subcat', 'group-idRif', 'group-rimborso', 'area-macchina', 'area-beneficiario'], btnId: 'btn-group-risparmi', cats: allData.saveCategories },
        'trasferimenti': { show: ['area-beneficiario'], hide: ['group-subcat', 'group-idRif', 'group-rimborso', 'area-categorie', 'area-macchina'], btnId: 'btn-group-main', btnClass: 'btn-trasferimenti', btnText: 'Esegui Giroconto' },
        'macchina': { show: ['area-macchina'], hide: ['row-ids', 'area-categorie', 'area-dettagli', 'group-note', 'group-rimborso'], btnId: 'btn-group-macchina' }
    };

    const conf = map[mode];
    const allFormIds = ['group-subcat', 'group-idRif', 'area-categorie', 'area-dettagli', 'group-rimborso', 'area-macchina', 'area-beneficiario', 'row-ids', 'group-note'];
    allFormIds.forEach(id => document.getElementById(id)?.classList.remove('hidden'));
    conf.hide?.forEach(id => document.getElementById(id)?.classList.add('hidden'));

    document.querySelectorAll('#btn-group-main, #btn-group-risparmi, #btn-group-macchina').forEach(b => b.classList.add('hidden'));
    document.getElementById(conf.btnId).classList.remove('hidden');

    const catSel = document.getElementById('categoria');
    catSel.innerHTML = '<option value="" disabled selected>Seleziona</option>';
    
    if(mode === 'risparmi') {
        (conf.cats || []).forEach(c => catSel.add(new Option(c, c)));
    } else if(['entrate','spese'].includes(mode)) {
        (allData.categories || []).forEach(c => catSel.add(new Option(c[1] || c[0], c[0])));
    }

    updateIdsVisually();

    const btnSave = document.getElementById('btnSave');
    if(btnSave && conf.btnClass) {
        btnSave.className = `save-btn ${conf.btnClass}`;
        btnSave.innerText = conf.btnText || "Salva";
    }
}

function onCategoryChange() {
    const catSel = document.getElementById('categoria');
    if(catSel.selectedIndex < 0) return;
    document.getElementById('categoriaText').value = catSel.options[catSel.selectedIndex].text;
    const subSel = document.getElementById('sottocategoria');
    subSel.innerHTML = "";
    const subs = (allData.subCategories || []).filter(r => r[1] == catSel.value);
    if(subs.length === 0) subSel.add(new Option("Nessuna", ""));
    else subs.forEach(s => subSel.add(new Option(s[0], s[0])));
}

// ==========================================
// SUBMIT FORM (OPTIMISTIC UI)
// ==========================================
function submitForm(param1) {
    if(!document.getElementById('mainForm').checkValidity()){
        const status = document.getElementById('status');
        status.innerText = "Compila i campi obbligatori!";
        status.style.color = "red";
        return;
    }

    let form = {
        action: 'save' + currentMode.charAt(0).toUpperCase() + currentMode.slice(1),
        idRif: document.getElementById('idRif').value,
        data: document.getElementById('data').value,
        categoriaText: document.getElementById('categoriaText').value,
        sottocategoria: document.getElementById('sottocategoria').value,
        importo: document.getElementById('importo').value.replace(',', '.'), 
        conto: document.getElementById('conto').value,
        utente: document.getElementById('utente').value,
        note: document.getElementById('note').value,
        daRimborsare: document.getElementById('daRimborsare').value === "SI",
        contoBen: document.getElementById('contoBen').value,
        beneficiario: document.getElementById('beneficiario').value,
        macchina: document.getElementById('macchina').value,
        kmQuadro: document.getElementById('kmQuadro').value.replace(',', '.'),
        prezzoLitro: document.getElementById('prezzoLitro').value.replace(',', '.'),
        isPrimo: param1
    };
    
    if(currentMode === 'risparmi' && param1) form.importo = "-" + form.importo;

    if (navigator.vibrate) navigator.vibrate(50);
    const status = document.getElementById('status');
    status.innerText = "✅ Salvataggio...";
    status.style.color = "green";

    document.getElementById('importo').value = "";
    document.getElementById('note').value = "";
    document.getElementById('idRif').value = "";
    document.getElementById('kmQuadro').value = "";
    document.getElementById('prezzoLitro').value = "";
    
    let idField = document.getElementById('idAuto');
    if(idField.value && !isNaN(idField.value)) {
        let nextId = parseInt(idField.value) + 1;
        idField.value = nextId;
        if(currentMode === 'entrate') allData.idEntrata = nextId;
        if(currentMode === 'spese') allData.idSpesa = nextId;
    }

    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
    }).then(() => {
        console.log("Richiesta inviata.");
        setTimeout(() => { status.innerText = ""; }, 2500);
    }).catch(err => {
        console.error("Errore Fetch", err);
        status.innerText = "⚠️ Errore di rete";
        status.style.color = "orange";
    });
}
