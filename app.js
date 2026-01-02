var currentMode = 'entrate';
var allData = {}; 

window.onload = function() {
    document.getElementById('data').valueAsDate = new Date();
    loadData();
    
    // Gestione input Euro (sostituisce punto con virgola)
    document.getElementById('importo').addEventListener('input', function(e) {
        let val = e.target.value.replace('.', ',').replace(/[^0-9,]/g, '');
        if ((val.match(/,/g) || []).length > 1) val = val.substring(0, val.lastIndexOf(','));
        e.target.value = val;
    });
};

function loadData() {
    document.getElementById('status').innerText = "Caricamento dati...";
    fetch(API_URL + "?action=getDropdownData")
    .then(res => res.json())
    .then(data => {
        allData = data;
        populateUI(data);
        document.getElementById('status').innerText = "";
    })
    .catch(err => document.getElementById('status').innerText = "Errore connessione");
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

function switchTab(mode) {
    currentMode = mode;
    let map = {
        'entrate': { show: ['group-subcat', 'group-idRif', 'area-categorie', 'area-dettagli'], hide: ['group-rimborso', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-main', class: 'btn-entrate' },
        'spese': { show: ['group-subcat', 'group-rimborso', 'area-categorie', 'area-dettagli'], hide: ['group-idRif', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-main', class: 'btn-spese' },
        'risparmi': { show: ['area-dettagli'], hide: ['group-subcat', 'group-idRif', 'group-rimborso', 'area-macchina', 'area-beneficiario'], btn: 'btn-group-risparmi', class: 'btn-risparmi', cats: allData.saveCategories },
        'trasferimenti': { show: ['area-beneficiario'], hide: ['group-subcat', 'group-idRif', 'group-rimborso', 'area-categorie', 'area-macchina'], btn: 'btn-group-main', class: 'btn-trasferimenti' },
        'macchina': { show: ['area-macchina'], hide: ['row-ids', 'area-categorie', 'area-dettagli', 'group-note', 'group-rimborso'], btn: 'btn-group-macchina', class: 'btn-macchina-std' }
    };

    let conf = map[mode];
    
    document.querySelectorAll('.hidden').forEach(el => el.classList.remove('hidden'));
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
    // 1. Validazione
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

    // 2. Invio Dati
    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
    }).then(() => {
        // 3. Successo Apparente (No refresh)
        document.getElementById('status').innerText = "✅ Dati inviati!";
        document.getElementById('status').style.color = "green";
        
        // Pulizia Campi
        document.getElementById('importo').value = "";
        document.getElementById('note').value = "";
        document.getElementById('idRif').value = "";
        document.getElementById('kmQuadro').value = "";
        document.getElementById('prezzoLitro').value = "";
        
        // Aggiorna ID visivo manualmente (+1)
        let idField = document.getElementById('idAuto');
        if(idField.value && !isNaN(idField.value)) {
            idField.value = parseInt(idField.value) + 1;
            // Aggiorna anche la memoria interna
            if(currentMode === 'entrate') allData.idEntrata++;
            if(currentMode === 'spese') allData.idSpesa++;
        }

        // Riabilita bottoni
        setTimeout(() => {
            document.querySelectorAll('button').forEach(b => b.disabled = false);
            document.getElementById('status').innerText = "";
        }, 2000);
        
    }).catch(err => {
        document.getElementById('status').innerText = "❌ Errore invio";
        document.querySelectorAll('button').forEach(b => b.disabled = false);
    });
}
