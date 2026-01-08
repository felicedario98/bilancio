var currentMode = 'entrate';
var allData = {}; 
var speseList = []; 

window.onload = function() {
    // Imposta data odierna
    document.getElementById('data').valueAsDate = new Date();
    
    // Inizializza i filtri della lista (Mese/Anno)
    initFiltri();
    
    // Carica i menu a tendina (Cache + Rete)
    loadDataSmart();
    
    // Gestione input Euro (sostituisce punto con virgola mentre scrivi, solo estetico)
    document.getElementById('importo').addEventListener('input', function(e) {
        let val = e.target.value.replace('.', ',').replace(/[^0-9,]/g, '');
        if ((val.match(/,/g) || []).length > 1) val = val.substring(0, val.lastIndexOf(','));
        e.target.value = val;
    });
};

function initFiltri() {
    var mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    var selMese = document.getElementById("filtroMese");
    var today = new Date();
    
    mesi.forEach((m, i) => {
        var opt = new Option(m, m);
        if(i === today.getMonth()) opt.selected = true;
        selMese.add(opt);
    });
    
    var selAnno = document.getElementById("filtroAnno");
    var curYear = today.getFullYear();
    for(var y = 2024; y <= curYear + 1; y++) {
        var opt = new Option(y, y);
        if(y === curYear) opt.selected = true;
        selAnno.add(opt);
    }
}

// ----------------------------------------------------
// GESTIONE DATI SMART (DROPDOWN)
// ----------------------------------------------------
function loadDataSmart() {
    var status = document.getElementById('status');
    status.innerText = "Avvio...";

    // 1. Cache Locale
    var cachedDrop = localStorage.getItem("dropdown_data");
    var cachedVer = localStorage.getItem("dropdown_ver") || "0";

    if (cachedDrop) {
        allData = JSON.parse(cachedDrop);
        populateUI(allData);
    }

    // 2. Controllo Server
    fetch(API_URL + "?action=getDropdownSmart&v=" + cachedVer)
    .then(res => res.json())
    .then(resp => {
        if (resp.updateNeeded) {
            allData = resp.data;
            localStorage.setItem("dropdown_data", JSON.stringify(allData));
            localStorage.setItem("dropdown_ver", resp.version);
            populateUI(allData);
            status.innerText = "";
        } else {
            status.innerText = "";
        }
        
        // Aggiorna gli ID visuali se presenti
        if(currentMode === 'entrate' && allData.idEntrata) document.getElementById('idAuto').value = allData.idEntrata;
        if(currentMode === 'spese' && allData.idSpesa) document.getElementById('idAuto').value = allData.idSpesa;
    })
    .catch(err => {
        console.log("Offline dropdown", err);
        status.innerText = "";
    });
}

function populateUI(data) {
    let resetAndAdd = (selId, items, isObj = false) => {
        let el = document.getElementById(selId);
        if(!el) return;
        el.innerHTML = ""; 
        items.forEach(i => {
             let val = isObj ? i : i; 
             let txt = isObj ? i : i;
             if(isObj && i.length > 1) { val = i[0]; txt = i[1] || i[0]; } 
             el.add(new Option(txt, val));
        });
    };

    if(data.accounts) {
        resetAndAdd('conto', data.accounts);
        resetAndAdd('contoBen', data.accounts);
    }
    
    if(data.users) {
        let userList = ["Felice", ...data.users.filter(u => u!=="Felice")];
        resetAndAdd('utente', userList);
        resetAndAdd('beneficiario', userList);
        document.getElementById('utente').value = "Felice";
    }
    
    if(data.cars) resetAndAdd('macchina', data.cars);

    // Ricarica la tab corrente per applicare le categorie giuste
    switchTab(currentMode); 
}

// ----------------------------------------------------
// GESTIONE LISTA SPESE (SMART LIST)
// ----------------------------------------------------
function loadSpeseList() {
    var loader = document.getElementById("loader-lista");
    loader.classList.remove('hidden');
    loader.innerText = "Verifica aggiornamenti...";

    var cachedData = localStorage.getItem("spese_data");
    var cachedVer = localStorage.getItem("spese_ver") || "0";
    
    if (cachedData) {
        speseList = JSON.parse(cachedData);
        renderTable(); 
    }

    fetch(API_URL + "?action=getSpeseSmart&v=" + cachedVer)
    .then(res => res.json())
    .then(resp => {
        if (resp.updateNeeded) {
            speseList = resp.list;
            localStorage.setItem("spese_data", JSON.stringify(speseList));
            localStorage.setItem("spese_ver", resp.version);
            renderTable(); 
            loader.innerText = "Aggiornato!";
        } else {
            loader.innerText = ""; 
        }
        setTimeout(() => loader.classList.add('hidden'), 1500);
    })
    .catch(err => {
        loader.innerText = "Offline";
    });
}

function renderTable() {
    var tbody = document.getElementById("tbodySpese");
    tbody.innerHTML = "";
    
    var mese = document.getElementById("filtroMese").value;
    var anno = document.getElementById("filtroAnno").value;
    var mesiMap = {"01":"Gennaio", "02":"Febbraio", "03":"Marzo", "04":"Aprile", "05":"Maggio", "06":"Giugno", "07":"Luglio", "08":"Agosto", "09":"Settembre", "10":"Ottobre", "11":"Novembre", "12":"Dicembre"};

    // 1. FILTRO
    var filtered = speseList.filter(r => {
        var parts = r.data.split('/'); 
        if(parts.length < 3) return false;
        var y = parts[2]; 
        var mNum = parts[1]; 
        var mName = mesiMap[mNum]; 
        return y === anno && mName === mese;
    });

    // 2. ORDINAMENTO (Data più recente in alto)
    filtered.sort((a, b) => {
        var da = a.data.split('/');
        var db = b.data.split('/');
        var dateA = new Date(da[2], da[1]-1, da[0]);
        var dateB = new Date(db[2], db[1]-1, db[0]);
        return dateB - dateA; 
    });

    if (filtered.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' class='empty-msg'>Nessuna spesa trovata.</td></tr>";
        return;
    }

    // 3. RENDER
    filtered.forEach(r => {
        var tr = document.createElement("tr");
        
        // Click per modificare
        tr.onclick = function() { preparaModifica(r.id); };
        tr.style.cursor = "pointer";

        var rimborsoHtml = "";
        if(String(r.rimborso).toUpperCase() === "TRUE") {
            rimborsoHtml = `<br><span class="badge-rimborso">RIMBORSO</span>`;
        }

        // Pulizia Importo visuale
        var rawImporto = r.importo.toString();
        var importoPulito = rawImporto.replace('€', '').trim();

        tr.innerHTML = `
            <td>${r.id}</td>
            <td>${r.data.substring(0,5)}</td>
            <td>
                <b>${r.categoria}</b><br>
                <span style="color:#666; font-size:11px;">${r.sottocategoria}</span>
                ${rimborsoHtml}
            </td>
            <td class="col-importo">€ ${importoPulito}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// LOGICA MODIFICA SPESA
// ----------------------------------------------------
function preparaModifica(id) {
    var spesa = speseList.find(s => s.id == id);
    if(!spesa) return;

    if(!confirm("Vuoi modificare la spesa ID " + id + "?")) return;

    // Setta ID nascosto
    document.getElementById('idModifica').value = id;

    // Data: da dd/MM/yyyy a yyyy-MM-dd
    var parts = spesa.data.split('/'); 
    if(parts.length === 3) {
        document.getElementById('data').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    // Importo: via € e punti, rimane virgola decimale se c'è
    var imp = spesa.importo.replace('€', '').trim().replace(/\./g, ''); 
    document.getElementById('importo').value = imp;

    // Categoria
    var catSelect = document.getElementById('categoria');
    for(var i=0; i<catSelect.options.length; i++) {
        if(catSelect.options[i].text === spesa.categoria) {
            catSelect.selectedIndex = i;
            break;
        }
    }
    document.getElementById('categoriaText').value = spesa.categoria;
    
    // Trigger cambio categoria per popolare le sottocategorie
    onCategoryChange(); 
    
    // Sottocategoria
    document.getElementById('sottocategoria').value = spesa.sottocategoria;

    // Rimborso
    var isRimb = String(spesa.rimborso).toUpperCase() === "TRUE";
    document.getElementById('daRimborsare').value = isRimb ? "SI" : "NO";

    // UI Modifica
    var btn = document.getElementById('btnSave');
    btn.innerText = "AGGIORNA SPESA";
    btn.style.backgroundColor = "#ff9800"; 
    
    switchTab('spese');
}

// ----------------------------------------------------
// UI TABS E FORM
// ----------------------------------------------------
function switchTab(mode) {
    currentMode = mode;
    
    // LISTA
    if (mode === 'lista') {
        document.getElementById('area-lista').classList.remove('hidden');
        document.getElementById('area-input').classList.add('hidden');
        document.getElementById('btn-group-main').classList.add('hidden');
        document.getElementById('btn-group-risparmi').classList.add('hidden');
        document.getElementById('btn-group-macchina').classList.add('hidden');
        
        document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn');
        document.querySelector('.tab-btn[onclick="switchTab(\'lista\')"]').classList.add('active-spese');
        
        loadSpeseList(); 
        return;
    }
    
    // INPUT NORMALE
    document.getElementById('area-lista').classList.add('hidden');
    document.getElementById('area-input').classList.remove('hidden');

    // Reset se stavo modificando e cambio tab (opzionale, ma pulito)
    if(mode !== 'spese' && document.getElementById('idModifica').value) {
         document.getElementById('idModifica').value = "";
         document.getElementById('btnSave').innerText = "Salva";
         document.getElementById('btnSave').style.backgroundColor = "";
         document.getElementById('mainForm').reset();
         document.getElementById('data').valueAsDate = new Date();
    }

    let map = {
        'entrate': { show: ['group-subcat', 'group-idRif', 'area-categorie', 'area-dettagli'], hide: ['group-rimborso', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-main', class: 'btn-entrate' },
        'spese': { show: ['group-subcat', 'group-rimborso', 'area-categorie', 'area-dettagli'], hide: ['group-idRif', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-main', class: 'btn-spese' },
        'risparmi': { show: ['area-dettagli'], hide: ['group-subcat', 'group-idRif', 'group-rimborso', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-risparmi', class: 'btn-risparmi', cats: allData.saveCategories || [] },
        'trasferimenti': { show: ['area-beneficiario'], hide: ['group-subcat', 'group-idRif', 'group-rimborso', 'area-categorie', 'area-macchina'], btn: 'btn-group-main', class: 'btn-trasferimenti' },
        'macchina': { show: ['area-macchina'], hide: ['row-ids', 'area-categorie', 'area-dettagli', 'group-note', 'group-rimborso'], btn: 'btn-group-macchina', class: 'btn-macchina-std' }
    };

    let conf = map[mode];
    
    document.querySelectorAll('.hidden').forEach(el => {
        if(el.id !== 'area-lista') el.classList.remove('hidden');
    });
    
    document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn');
    document.querySelectorAll('#btn-group-main, #btn-group-risparmi, #btn-group-macchina').forEach(b => b.classList.add('hidden'));

    conf.hide?.forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById(conf.btn).classList.remove('hidden');
    
    let catSel = document.getElementById('categoria');
    catSel.innerHTML = '<option value="" disabled selected>Seleziona</option>';
    
    if(mode === 'risparmi') (conf.cats || []).forEach(c => addOpt('categoria', c));
    else if(['entrate','spese'].includes(mode)) (allData.categories || []).forEach(c => addOpt('categoria', c[0], c[1]));

    if(mode === 'entrate') document.getElementById('idAuto').value = allData.idEntrata || "";
    if(mode === 'spese' && !document.getElementById('idModifica').value) document.getElementById('idAuto').value = allData.idSpesa || "";

    let activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${mode}')"]`);
    if(activeBtn) activeBtn.classList.add('active-' + mode);
    
    let btnSave = document.getElementById('btnSave');
    if(!document.getElementById('idModifica').value) {
        btnSave.className = `save-btn ${conf.class}`;
        btnSave.innerText = mode === 'trasferimenti' ? "Giroconto" : "Salva";
        btnSave.style.backgroundColor = ""; 
    }
}

function onCategoryChange() {
    let catSel = document.getElementById('categoria');
    if(catSel.selectedIndex < 0) return;
    document.getElementById('categoriaText').value = catSel.options[catSel.selectedIndex].text;
    let subSel = document.getElementById('sottocategoria');
    subSel.innerHTML = "";
    let subs = (allData.subCategories || []).filter(r => r[1] == catSel.value);
    if(subs.length === 0) subSel.add(new Option("Nessuna", ""));
    else subs.forEach(s => subSel.add(new Option(s[0], s[0])));
}

function addOpt(id, val, txt) { 
    let el = document.getElementById(id);
    if(el) el.add(new Option(txt||val, val)); 
}

// ----------------------------------------------------
// INVIO DATI
// ----------------------------------------------------
function submitForm(param1) {
    if(!document.getElementById('mainForm').checkValidity()){
        document.getElementById('status').innerText = "Compila tutti i campi!";
        document.getElementById('status').style.color = "red";
        return;
    }

    let form = {
        action: 'save' + currentMode.charAt(0).toUpperCase() + currentMode.slice(1),
        idModifica: document.getElementById('idModifica').value,
        idRif: document.getElementById('idRif').value,
        data: document.getElementById('data').value,
        categoriaText: document.getElementById('categoriaText').value,
        sottocategoria: document.getElementById('sottocategoria').value,
        
        // GESTIONE DECIMALI: Sostituisco virgola con punto per il server
        importo: document.getElementById('importo').value.replace(',', '.'), 
        kmQuadro: document.getElementById('kmQuadro').value.replace(',', '.'),
        prezzoLitro: document.getElementById('prezzoLitro').value.replace(',', '.'),
        
        conto: document.getElementById('conto').value,
        utente: document.getElementById('utente').value,
        note: document.getElementById('note').value,
        daRimborsare: document.getElementById('daRimborsare').value === "SI",
        contoBen: document.getElementById('contoBen').value,
        beneficiario: document.getElementById('beneficiario').value,
        macchina: document.getElementById('macchina').value,
        isPrimo: param1
    };
    
    if(currentMode === 'risparmi' && param1) form.importo = "-" + form.importo;

    document.getElementById('status').innerText = "Invio in corso...";
    document.getElementById('status').style.color = "#333";
    document.querySelectorAll('button').forEach(b => b.disabled = true);

    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
    }).then(() => {
        document.getElementById('status').innerText = "✅ Eseguito!";
        document.getElementById('status').style.color = "green";
        
        // Pulizia Campi Base
        document.getElementById('importo').value = "";
        document.getElementById('note').value = "";
        document.getElementById('idRif').value = "";
        document.getElementById('kmQuadro').value = "";
        document.getElementById('prezzoLitro').value = "";
        
        // Gestione Reset ID Modifica
        if(document.getElementById('idModifica').value) {
            document.getElementById('idModifica').value = "";
            document.getElementById('btnSave').innerText = "Salva";
            document.getElementById('btnSave').style.backgroundColor = ""; 
            // Torna in modalità normale
            if(currentMode === 'spese') document.getElementById('idAuto').value = allData.idSpesa;
        } else {
            // Se era inserimento nuovo, incrementa ID visuale
            let idField = document.getElementById('idAuto');
            if(idField.value && !isNaN(idField.value)) {
                idField.value = parseInt(idField.value) + 1;
                if(currentMode === 'entrate') allData.idEntrata++;
                if(currentMode === 'spese') allData.idSpesa++;
            }
        }

        setTimeout(() => {
            document.querySelectorAll('button').forEach(b => b.disabled = false);
            document.getElementById('status').innerText = "";
        }, 2000);
        
    }).catch(err => {
        document.getElementById('status').innerText = "❌ Errore invio";
        document.querySelectorAll('button').forEach(b => b.disabled = false);
    });
}
