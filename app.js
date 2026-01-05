var currentMode = 'entrate';
var allData = {}; 
var speseList = []; // Qui salviamo la lista spese

window.onload = function() {
    document.getElementById('data').valueAsDate = new Date();
    
    // Inizializza Filtri Lista
    initFiltri();
    
    loadData(); // Carica dropdown
    
    // Gestione input Euro
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

function loadData() {
    document.getElementById('status').innerText = "Caricamento...";
    fetch(API_URL + "?action=getDropdownData")
    .then(res => res.json())
    .then(data => {
        allData = data;
        populateUI(data);
        document.getElementById('status').innerText = "";
    })
    .catch(err => document.getElementById('status').innerText = "Errore conn.");
}

function populateUI(data) {
    let addOpt = (selId, val, txt) => {
        let opt = document.createElement("option"); opt.value = val; opt.text = txt || val;
        document.getElementById(selId).add(opt);
    };

    data.accounts.forEach(acc => { addOpt('conto', acc); addOpt('contoBen', acc); });
    ["Felice", ...data.users.filter(u => u!=="Felice")].forEach(u => { addOpt('utente', u); addOpt('beneficiario', u); });
    document.getElementById('utente').value = "Felice";
    data.cars.forEach(c => addOpt('macchina', c));

    switchTab('entrate'); 
}

// --- LOGICA LISTA SPESE SMART ---
function loadSpeseList() {
    var loader = document.getElementById("loader-lista");
    loader.classList.remove('hidden');
    loader.innerText = "Verifica aggiornamenti...";

    // 1. Carica Cache
    var cachedData = localStorage.getItem("spese_data");
    var cachedVer = localStorage.getItem("spese_ver") || "0";
    
    if (cachedData) {
        speseList = JSON.parse(cachedData);
        renderTable(); // Mostra subito quello che ha
    }

    // 2. Chiedi al server
    fetch(API_URL + "?action=getSpeseSmart&v=" + cachedVer)
    .then(res => res.json())
    .then(resp => {
        if (resp.updateNeeded) {
            // Nuovi dati trovati!
            speseList = resp.list;
            localStorage.setItem("spese_data", JSON.stringify(speseList));
            localStorage.setItem("spese_ver", resp.version);
            renderTable(); // Aggiorna tabella
            loader.innerText = "Aggiornato!";
        } else {
            loader.innerText = ""; // Nessuna novità
        }
        setTimeout(() => loader.classList.add('hidden'), 1500);
    })
    .catch(err => {
        console.log(err);
        loader.innerText = "Offline (Uso dati locali)";
    });
}

function renderTable() {
    var tbody = document.getElementById("tbodySpese");
    tbody.innerHTML = "";
    
    var mese = document.getElementById("filtroMese").value;
    var anno = document.getElementById("filtroAnno").value;
    
    // Filtra lato Client
    var filtered = speseList.filter(r => {
        // La data dal server arriva come GG/MM/AAAA.
        // Estraiamo mese e anno dalla stringa data o controlliamo se c'è un campo mese nel json
        // Nel GS ho mappato solo la data. Facciamo parsing semplice.
        var parts = r.data.split('/'); 
        // parts[1] è mese numerico (01, 02..). Converto in nome? 
        // Meglio: Nel GS il json non ha il nome mese. 
        // Trucco: filtro per sottostringa o uso un helper.
        // Poiché il GS restituisce "dd/MM/yyyy", dobbiamo fare attenzione.
        // Soluzione: modifica GS per restituire anche il nome mese, OPPURE gestiamo qui.
        // Per semplicità, controlliamo se la stringa data contiene l'anno.
        return r.data.endsWith(anno); 
        // Nota: Filtrare per Mese (Nome) richiederebbe di convertire "01" in "Gennaio".
        // Per ora mostro tutto l'anno, oppure implementiamo un check mese veloce.
    });

    // Filtro Mese preciso:
    var mesiMap = {"01":"Gennaio", "02":"Febbraio", "03":"Marzo", "04":"Aprile", "05":"Maggio", "06":"Giugno", "07":"Luglio", "08":"Agosto", "09":"Settembre", "10":"Ottobre", "11":"Novembre", "12":"Dicembre"};
    
    filtered = filtered.filter(r => {
       var parts = r.data.split('/'); // 15/01/2025
       if(parts.length < 3) return false;
       var mNum = parts[1];
       var mName = mesiMap[mNum];
       return mName === mese;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' class='empty-msg'>Nessuna spesa trovata.</td></tr>";
        return;
    }

    filtered.forEach(r => {
        var tr = document.createElement("tr");
        
        var rimborsoHtml = "";
        if(r.rimborso && r.rimborso.toLowerCase().includes("si")) {
            rimborsoHtml = `<br><span class="badge-rimborso">RIMBORSO</span>`;
        }
        
        tr.innerHTML = `
            <td>${r.id}</td>
            <td>${r.data.substring(0,5)}</td>
            <td>
                <b>${r.categoria}</b><br>
                <span style="color:#666; font-size:11px;">${r.sottocategoria}</span>
                ${rimborsoHtml}
            </td>
            <td class="col-importo">${r.importo} €</td>
        `;
        tbody.appendChild(tr);
    });
}
// ----------------------------

function switchTab(mode) {
    currentMode = mode;
    
    // Gestione visuale LISTA
    if (mode === 'lista') {
        document.getElementById('area-lista').classList.remove('hidden');
        document.getElementById('area-input').classList.add('hidden');
        document.getElementById('btn-group-main').classList.add('hidden');
        document.getElementById('btn-group-risparmi').classList.add('hidden');
        document.getElementById('btn-group-macchina').classList.add('hidden');
        
        // Attiva Bottone
        document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn');
        document.querySelector('.tab-btn[onclick="switchTab(\'lista\')"]').classList.add('active-spese'); // Uso rosso spese
        
        loadSpeseList(); // <--- CARICA DATI
        return;
    }
    
    // Gestione visuale NORMALE (Input)
    document.getElementById('area-lista').classList.add('hidden');
    document.getElementById('area-input').classList.remove('hidden');

    let map = {
        'entrate': { show: ['group-subcat', 'group-idRif', 'area-categorie', 'area-dettagli'], hide: ['group-rimborso', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-main', class: 'btn-entrate' },
        'spese': { show: ['group-subcat', 'group-rimborso', 'area-categorie', 'area-dettagli'], hide: ['group-idRif', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-main', class: 'btn-spese' },
        'risparmi': { show: ['area-dettagli'], hide: ['group-subcat', 'group-idRif', 'group-rimborso', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-risparmi', class: 'btn-risparmi', cats: allData.saveCategories },
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
    
    if(mode === 'risparmi') conf.cats.forEach(c => addOpt('categoria', c));
    else if(['entrate','spese'].includes(mode)) allData.categories.forEach(c => addOpt('categoria', c[0], c[1]));

    if(mode === 'entrate') document.getElementById('idAuto').value = allData.idEntrata;
    if(mode === 'spese') document.getElementById('idAuto').value = allData.idSpesa;

    let activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${mode}')"]`);
    if(activeBtn) activeBtn.classList.add('active-' + mode);
    
    let btnSave = document.getElementById('btnSave');
    btnSave.className = `save-btn ${conf.class}`;
    btnSave.innerText = mode === 'trasferimenti' ? "Giroconto" : "Salva";
}

function onCategoryChange() {
    let catSel = document.getElementById('categoria');
    document.getElementById('categoriaText').value = catSel.options[catSel.selectedIndex].text;
    let subSel = document.getElementById('sottocategoria');
    subSel.innerHTML = "";
    let subs = allData.subCategories.filter(r => r[1] == catSel.value);
    if(subs.length === 0) subSel.add(new Option("Nessuna", ""));
    else subs.forEach(s => subSel.add(new Option(s[0], s[0])));
}

function addOpt(id, val, txt) { document.getElementById(id).add(new Option(txt||val, val)); }

function submitForm(param1) {
    if(!document.getElementById('mainForm').checkValidity()){
        document.getElementById('status').innerText = "Compila tutti i campi!";
        document.getElementById('status').style.color = "red";
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
        kmQuadro: document.getElementById('kmQuadro').value,
        prezzoLitro: document.getElementById('prezzoLitro').value,
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
        document.getElementById('status').innerText = "✅ Dati inviati!";
        document.getElementById('status').style.color = "green";
        
        // Pulizia Campi
        document.getElementById('importo').value = "";
        document.getElementById('note').value = "";
        document.getElementById('idRif').value = "";
        document.getElementById('kmQuadro').value = "";
        document.getElementById('prezzoLitro').value = "";
        
        // Incremento ID manuale
        let idField = document.getElementById('idAuto');
        if(idField.value && !isNaN(idField.value)) {
            idField.value = parseInt(idField.value) + 1;
            if(currentMode === 'entrate') allData.idEntrata++;
            if(currentMode === 'spese') allData.idSpesa++;
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
