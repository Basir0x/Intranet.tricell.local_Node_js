const config = require('../config/globals.json');
const express = require('express');
const router = express.Router();

router.use(express.static('./public'));
const path = require('path');

const renderLoggedinMenu = require('../renderLoggedinMenu');

// --------------------- Läs in Masterframen --------------------------------
const readHTML = require('../readHTML.js');
const fs = require('fs');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');

var htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
var htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');

// Research entries components
var htmlResearchEntriesCSS = readHTML('./masterframe/researchentries_css.html');
var htmlResearchEntriesJS = readHTML('./masterframe/researchentries_js.html');
var htmlResearchEntries = readHTML('./masterframe/researchentries.html');

// Virus image component styles
var htmlVirusimagesCSS = readHTML('./masterframe/virusimages_css.html');

// Virus database component styles
var htmlVirusDatabaseCSS = readHTML('./masterframe/virusdatabase_css.html');

// Öppna databasen
const ADODB = require('node-adodb');
const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');

const { getVirusImagesHTML } = require('./virusimages');

const backupVirus = require('../backup.js');


// --------------------- Växla Open/Archive -------------------
router.get('/toggle/:id', async function(request, response) {
    // säkerhetskontroll - endast nivå A kan växla open/archive
    if (request.session.securityAccessLevel !== 'A') {
        response.write('Access Denied. Only administrators (A) can toggle archive status.');
        response.end();
        return;
    }

    const targetId = parseInt(request.params.id);

    try {
        const result = await connection.query(`SELECT objectStatus FROM ResearchObjects WHERE ID = ${targetId}`);
        if (result.length > 0) {
            const currentStatus = result[0].objectStatus;
            const newStatus = (currentStatus === 'open') ? 'archive' : 'open';
            await connection.execute(`UPDATE ResearchObjects SET objectStatus = '${newStatus}' WHERE ID = ${targetId}`);
        }
        response.redirect('/api/virusdatabase/' + targetId);
    } catch (error) {
        console.log("Toggle Error: ", error);
        response.write('Error toggling status.');
        response.end();
    }
});


// --------------------- Backup virus -------------------
router.get('/backup/:id', async function(request, response) {
    // säkerhetskontroll - endast nivå A och B kan göra backup
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied. You do not have the required security clearance.');
        response.end();
        return;
    }

    const targetId = parseInt(request.params.id);

    try {
        const result = await connection.query(`SELECT * FROM ResearchObjects WHERE ID = ${targetId}`);
        if (result.length === 0) {
            response.write('Virus not found.');
            response.end();
            return;
        }

        // kör backup-funktionen och få status
        const backupSuccess = await backupVirus(result);
        const status = backupSuccess ? 'success' : 'error';

        // Spara backup-status i sessionen för att visa på detaljsidan
        request.session.backupStatus = status;

        // omdirigera tillbaka till detaljsidan där ett meddelande kommer att visas baserat på backup-status
        response.redirect(`/api/virusdatabase/${targetId}`);
    } catch (error) {
        console.log("Backup Error: ", error);
        response.write('Error during backup.');
        response.end();
    }
});


// ---------------------- Huvudsida: Alla virus ------------------------------------------------
router.get('/', async function(request, response)
{
    // Säkerhetskontroll: Endast nivå A och B kan se virusdatabasen
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied. You do not have the required security clearance to view the Research Database.');
        response.end();
        return;
    }

    response.setHeader('Content-type', 'text/html');
    response.write(htmlHead);
    if(request.session.loggedin){response.write(htmlLoggedinMenuCSS);}
    if(request.session.loggedin){response.write(htmlLoggedinMenuJS);}
    if(request.session.loggedin){
        response.write(renderLoggedinMenu({
            employeecode: request.cookies.employeecode,
            name: request.cookies.name,
            logintimes: request.cookies.logintimes,
            lastlogin: request.cookies.lastlogin,
            securityaccesslevel: request.session.securityAccessLevel,
            webaddress : config.webaddress
        }));
    }
    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);

    // Inkludera CSS för virusbilder
    response.write(`
    <link rel="stylesheet" href="css/researchobjects.css" />
    `);

    if(request.session.loggedin) {
        response.write('<div class="research-header"><h2>Research Objects</h2><a href="/api/virusdatabase/new" class="add-research-btn">➕ Add Research Object</a></div>');
    } else {
        response.write('<div class="research-header"><h2>Research Objects</h2></div>');
    }

    // Bygg tabellen manuellt för att kunna inkludera entry count och last entry date
    response.write('<div id="table-resp">');
    response.write('<div id="table-header">');
    response.write('<div class="table-header-cell-light">Number</div>');
    response.write('<div class="table-header-cell-dark">Name</div>');
    response.write('<div class="table-header-cell-light">Created</div>');
    response.write('<div class="table-header-cell-light">By</div>');
    response.write('<div class="table-header-cell-light">Entries</div>');
    response.write('<div class="table-header-cell-light">Last entry</div>');
    response.write('<div class="table-header-cell-light">Status</div>');
    if(request.session.loggedin) {
        response.write('<div class="table-header-cell-light">Edit</div>');
        response.write('<div class="table-header-cell-light">Delete</div>');
        if(request.session.securityAccessLevel === 'A') {
            response.write('<div class="table-header-cell-light">Archive/Open</div>');
        }
    }
    response.write('</div><div id="table-body">');

    try {
        let sql = 'SELECT * FROM ResearchObjects';
        const virusList = await connection.query(sql);

        // Bestäm användarens säkerhetsnivå för att avgöra vilka rader som ska visas
        let userLevel = request.session.securityAccessLevel ? request.session.securityAccessLevel.toString().trim().toUpperCase() : "";

        for (let i = 0; i < virusList.length; i++) {
            // Hämta antal forskningsposter och datum för senaste posten för varje objekt
            let entryCount = 0;
            let lastEntryDate = '--';
            try {
                // researchObjectId may be stored as text; use CStr conversion to match ID robustly
                const entryResult = await connection.query("SELECT COUNT(*) AS entryCount, MAX(entryDate) AS lastDate FROM ResearchEntries WHERE CStr(researchObjectId)='" + virusList[i].ID + "'");
                if (entryResult.length > 0) {
                    const row = entryResult[0];
                    entryCount = (row.entryCount || row.COUNT || row.Expr1000 || 0);
                    lastEntryDate = (row.lastDate || row.LASTDATE || row.Expr1001 || '--');
                }
            } catch (entryError) {
                console.log("Error getting entry count for object " + virusList[i].ID + ":", entryError);
            }

            // Kolla om objektet är arkiverat
            const isArchived = virusList[i].objectStatus === 'archive';
            
            // Visa inte arkiverade objekt för nivå C-användare
            if (isArchived && userLevel !== 'A') {
                continue;
            }
            
            // Bestäm rad- och statusklasser baserat på arkivstatus
            const archiveClass = (virusList[i].objectStatus === 'archive') ? 'row-archived' : '';
            const statusClass = (virusList[i].objectStatus === 'archive') ? 'status-archive' : 'status-open';
            const statusText = (virusList[i].objectStatus === 'archive') ? 'ARCHIVED' : 'OPEN';

            response.write(`<div class="resp-table-row ${archiveClass}">
                <div class="table-body-cell" data-label="Number"><span>${virusList[i].objectNumber}</span></div>
                <div class="table-body-cell-bigger" data-label="Name"><span><a href="/api/virusdatabase/${virusList[i].ID}" style="color:#8bc2a8;">${virusList[i].objectName}</a></span></div>
                <div class="table-body-cell" data-label="Created"><span>${virusList[i].objectCreatedDate}</span></div>
                <div class="table-body-cell" data-label="By"><span>${virusList[i].objectCreator}</span></div>
                <div class="table-body-cell" data-label="Entries"><span>${entryCount || 0}</span></div>
                <div class="table-body-cell" data-label="Last entry"><span>${lastEntryDate || '-'}</span></div>
                <div class="table-body-cell" data-label="Status"><span class="status-badge ${statusClass}">${statusText}</span></div>`);
            
            if (request.session.loggedin) {
                response.write(`<div class="table-body-cell" data-label="Edit"><span><a href="/api/virusdatabase/edit/${virusList[i].ID}" class="action-link">E</a></span></div>
                               <div class="table-body-cell" data-label="Delete"><span><a href="/api/virusdatabase/delete/${virusList[i].ID}" class="action-link">D</a></span></div>`);
                
                // Visa Archive/Open-knapp 
                if (request.session.securityAccessLevel === 'A') {
                    const toggleText = virusList[i].objectStatus === 'archive' ? 'Open' : 'Archive';
                    response.write(`<div class="table-body-cell" data-label="Archive/Open"><span><a href="/api/virusdatabase/toggle/${virusList[i].ID}" class="action-link" style="color:#ff9800;">${toggleText}</a></span></div>`);
                }
            }
            response.write('</div>\n');
        }
    } catch (error) {
        console.log("Database Error: ", error);
        response.write('<div class="resp-table-row"><div class="table-body-cell" colspan="10">Error loading database connection.</div></div>');
    }

    response.write('</div></div>');

    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();
});


// ---------------------- Toggle Archive/Open Status (GET) ---------------------------------------
router.get('/toggle/:id', async function(request, response)
{
    // säkerhetskontroll - endast nivå A kan växla open/archive
    if (request.session.securityAccessLevel !== 'A') {
        response.write('Access Denied. Only Level A administrators can change archive status.');
        response.end();
        return;
    }

    const id = parseInt(request.params.id);

    try {
        // Hämta nuvarande status för objektet
        const getSql = 'SELECT objectStatus FROM ResearchObjects WHERE ID=' + id;
        const result = await connection.query(getSql);
        
        if (result.length > 0) {
            const currentStatus = result[0].objectStatus || 'open';
            const newStatus = (currentStatus === 'archive') ? 'open' : 'archive';
            
            // Uppdatera status
            const updateSql = `UPDATE ResearchObjects SET objectStatus='${newStatus}' WHERE ID=${id}`;
            await connection.execute(updateSql);
            
            response.redirect('/api/virusdatabase/' + id);
        } else {
            response.write('Research object not found.');
            response.end();
        }
        
    } catch (error) {
        console.log("Database Toggle Error: ", error);
        response.write('Error toggling archive status.');
        response.end();
    }
});


// ---------------------- Formulär för att lägga till nytt virus (GET) ------------------------------
router.get('/new', function(request, response)
{
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied. You do not have the required security clearance.');
        response.end();
        return;
    }

    response.setHeader('Content-type', 'text/html');
    response.write(htmlHead);
    if(request.session.loggedin){response.write(htmlLoggedinMenuCSS);}
    if(request.session.loggedin){response.write(htmlLoggedinMenuJS);}
    if(request.session.loggedin){response.write(htmlVirusDatabaseCSS);}
    if(request.session.loggedin){
        response.write(renderLoggedinMenu({
            employeecode: request.cookies.employeecode,
            name: request.cookies.name,
            logintimes: request.cookies.logintimes,
            lastlogin: request.cookies.lastlogin,
            securityaccesslevel: request.session.securityAccessLevel,
            webaddress : config.webaddress
        }));
    }
    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);

    response.write('<div class="form-wrapper"><h2>Add New Research Object</h2>');
    
    response.write(`
    <form action="/api/virusdatabase/new" method="POST">
        <div class="form-group">
            <label>Object Number:</label>
            <input type="text" name="objectNumber" required placeholder="e.g., TCL#12" />
        </div>

        <div class="form-group">
            <label>Object Name:</label>
            <input type="text" name="objectName" required placeholder="Name of the research object" />
        </div>

        <div class="form-group">
            <label>Information / Description:</label>
            <textarea name="objectText" required placeholder="Detailed information and description"></textarea>
        </div>

        <div class="form-group">
            <label>Security Presentation Video URL: <span style="font-size: 11px; color: #a8d5a8; font-weight: normal;">(Optional)</span></label>
            <input type="url" name="presentationVideoLink" placeholder="https://..." />
        </div>

        <div class="form-group">
            <label>Security Handling Video URL: <span style="font-size: 11px; color: #a8d5a8; font-weight: normal;">(Optional)</span></label>
            <input type="url" name="securityVideoLink" placeholder="https://..." />
        </div>

        <div class="form-actions">
            <button type="submit" class="btn-primary">💾 Save to Database</button>
            <button type="reset" class="btn-secondary">🔄 Clear Form</button>
        </div>
    </form>
    `);

    response.write('</div>');

    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();
});


// ---------------------- Spara nytt virus i databasen (POST) ---------------------------------------
router.post('/new', async function(request, response)
{
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied.');
        response.end();
        return;
    }

    const objectNumber = request.body.objectNumber;
    const objectName = request.body.objectName;
    const objectText = request.body.objectText;
    const presentationVideoLink = request.body.presentationVideoLink || "";
    const securityVideoLink = request.body.securityVideoLink || "";
    const objectCreator = request.cookies.employeecode; 
    const objectStatus = "open";

    // Auto-generate today's date and time
    let date_ob = new Date();
    let date = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    let objectCreatedDate = date + "." + month + "." + year;

    let hours = ("0" + date_ob.getHours()).slice(-2);
    let minutes = ("0" + date_ob.getMinutes()).slice(-2);
    let objectCreatedTime = hours + ":" + minutes;

    try {
        let sql = `INSERT INTO ResearchObjects (objectNumber, objectName, objectText, objectCreatedDate, objectCreatedTime, objectCreator, objectStatus, presentationVideoLink, securityVideoLink) VALUES ('${objectNumber}', '${objectName}', '${objectText}', '${objectCreatedDate}', '${objectCreatedTime}', '${objectCreator}', '${objectStatus}', '${presentationVideoLink}', '${securityVideoLink}')`;
        
        await connection.execute(sql);
        response.redirect('/api/virusdatabase');
        
    } catch (error) {
        console.log("Database Insert Error: ", error);
        response.write('Error saving to the database.');
        response.end();
    }
});


// ---------------------- Radera virus och filer (GET) ---------------------------------------
router.get('/delete/:id', async function(request, response)
{
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied. You do not have the required security clearance.');
        response.end();
        return;
    }

    const id = parseInt(request.params.id);

    try {
        const getSql = 'SELECT objectNumber FROM ResearchObjects WHERE ID=' + id;
        const result = await connection.query(getSql);

        if (result.length > 0) {
            const objectNumber = result[0].objectNumber;
            const deleteSql = 'DELETE FROM ResearchObjects WHERE ID=' + id;
            await connection.execute(deleteSql);

            const pdfPath = './data/safetydatasheets/' + objectNumber + '.pdf';
            if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
            }

            const imagePath = `./public/virusphoto/${objectNumber}`;
            if (fs.existsSync(imagePath)) {
                fs.rmdirSync(imagePath, { recursive: true });
            }
        }
        response.redirect('/api/virusdatabase');

    } catch (error) {
        console.log("Database Delete Error: ", error);
        response.write('Error deleting from the database.');
        response.end();
    }
});


// ---------------------- Formulär för att redigera virus (GET) ------------------------------
router.get('/edit/:id', async function(request, response)
{
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied. You do not have the required security clearance.');
        response.end();
        return;
    }

    const id = parseInt(request.params.id);

    response.setHeader('Content-type', 'text/html');
    response.write(htmlHead);
    if(request.session.loggedin){response.write(htmlLoggedinMenuCSS);}
    if(request.session.loggedin){response.write(htmlLoggedinMenuJS);}
    if(request.session.loggedin){response.write(htmlVirusDatabaseCSS);}
    if(request.session.loggedin){
        response.write(renderLoggedinMenu({
            employeecode: request.cookies.employeecode,
            name: request.cookies.name,
            logintimes: request.cookies.logintimes,
            lastlogin: request.cookies.lastlogin,
            securityaccesslevel: request.session.securityAccessLevel,
            webaddress : config.webaddress
        }));
    }
    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);

    try {
        const result = await connection.query('SELECT * FROM ResearchObjects WHERE ID=' + id);
        
        if (result.length > 0) {
            const virus = result[0];

            response.write('<div class="form-wrapper">');
            response.write('<h2>Edit Research Object</h2>');
            response.write('<form action="/api/virusdatabase/edit/' + id + '" method="POST">');
            
            response.write('<div class="form-group">');
            response.write('<label>Object Number:</label>');
            response.write('<input type="text" name="objectNumber" value="' + virus.objectNumber + '" required />');
            response.write('</div>');
            
            response.write('<div class="form-group">');
            response.write('<label>Object Name:</label>');
            response.write('<input type="text" name="objectName" value="' + virus.objectName + '" required />');
            response.write('</div>');
            
            response.write('<div class="form-group">');
            response.write('<label>Information/Description:</label>');
            response.write('<textarea name="objectText" required>' + virus.objectText + '</textarea>');
            response.write('</div>');
            
            let pVideo = virus.presentationVideoLink ? virus.presentationVideoLink : "";
            let sVideo = virus.securityVideoLink ? virus.securityVideoLink : "";

            response.write('<div class="form-group">');
            response.write('<label>Security Presentation Video URL:</label>');
            response.write('<input type="url" name="presentationVideoLink" value="' + pVideo + '" />');
            response.write('</div>');
            
            response.write('<div class="form-group">');
            response.write('<label>Security Handling Video URL:</label>');
            response.write('<input type="url" name="securityVideoLink" value="' + sVideo + '" />');
            response.write('</div>');
            
            // Visa status dropdown för admin-användare
            if (request.session.securityAccessLevel === 'A') {
                response.write('<div class="form-group">');
                response.write('<label>Status:</label>');
                response.write('<select name="objectStatus">');
                response.write('<option value="open"' + (virus.objectStatus === 'open' ? ' selected' : '') + '>Open</option>');
                response.write('<option value="archive"' + (virus.objectStatus === 'archive' ? ' selected' : '') + '>Archived</option>');
                response.write('</select>');
                response.write('</div>');
            }
            
            response.write('<div class="form-actions">');
            response.write('<button type="submit" class="btn-primary">💾 Update Database</button>');
            response.write('<a href="/api/virusdatabase/' + id + '" class="btn-secondary" style="padding: 12px 20px; display: inline-block; text-decoration: none; text-align: center;">↩ Cancel</a>');
            response.write('</div>');
            response.write('</form>');
            response.write('</div>');

            // lägg till CSS för virusbilder
            response.write(htmlVirusimagesCSS);
            // visa virusbilderna under redigeringsformuläret
            response.write('<h3 class="research-section-title">Virus Images</h3>');
            response.write(getVirusImagesHTML(id));
        } else {
            response.write('<p>Virus not found.</p>');
        }
    } catch (error) {
        console.log("Database Error: ", error);
        response.write('<p>Error loading virus data for editing.</p>');
    }

    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();
});

// ---------------------- Uppdatera virus i databasen (POST) ---------------------------------------
router.post('/edit/:id', async function(request, response)
{
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied.');
        response.end();
        return;
    }

    const id = parseInt(request.params.id);
    
    const objectNumber = request.body.objectNumber.replace(/'/g, "''");
    const objectName = request.body.objectName.replace(/'/g, "''");
    const objectText = request.body.objectText.replace(/'/g, "''");
    
    const presentationVideoLink = request.body.presentationVideoLink ? request.body.presentationVideoLink.replace(/'/g, "''") : "";
    const securityVideoLink = request.body.securityVideoLink ? request.body.securityVideoLink.replace(/'/g, "''") : "";
    
    // bara admin-användare kan uppdatera status
    let objectStatusUpdate = '';
    if (request.session.securityAccessLevel === 'A' && request.body.objectStatus) {
        objectStatusUpdate = `, objectStatus='${request.body.objectStatus}'`;
    }

    try {
        let sql = `UPDATE ResearchObjects SET objectNumber='${objectNumber}', objectName='${objectName}', objectText='${objectText}', presentationVideoLink='${presentationVideoLink}', securityVideoLink='${securityVideoLink}'${objectStatusUpdate} WHERE ID=${id}`;
        await connection.execute(sql);
        response.redirect('/api/virusdatabase/' + id);
    } catch (error) {
        console.log("Database Update Error: ", error);
        response.write('Error updating the database.');
        response.end();
    }
});


// ---------------------- Specifikt virus (ID) ------------------------------------------------
router.get('/:id', async function(request, response)
{
    // säkerhetskontroll - endast nivå A och B kan se virusdetaljer
    if (request.session.securityAccessLevel !== 'A' && request.session.securityAccessLevel !== 'B') {
        response.write('Access Denied. You do not have the required security clearance.');
        response.end();
        return;
    }

    const id = parseInt(request.params.id);

    response.setHeader('Content-type', 'text/html');
    response.write(htmlHead);
    if(request.session.loggedin){response.write(htmlLoggedinMenuCSS);}
    if(request.session.loggedin){response.write(htmlLoggedinMenuJS);}
    if(request.session.loggedin){response.write(htmlResearchEntriesCSS);}
    if(request.session.loggedin){response.write(htmlResearchEntriesJS);}
    if(request.session.loggedin){response.write(htmlVirusDatabaseCSS);}
    if(request.session.loggedin){
        response.write(renderLoggedinMenu({
            employeecode: request.cookies.employeecode,
            name: request.cookies.name,
            logintimes: request.cookies.logintimes,
            lastlogin: request.cookies.lastlogin,
            securityaccesslevel: request.session.securityAccessLevel,
            webaddress : config.webaddress
        }));
    }
    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);

    try {
        const result = await connection.query('SELECT * FROM ResearchObjects WHERE ID=' + id);
        
        if (result.length > 0) {
            const virus = result[0];
            
            // Kontrollera om objektet är arkiverat och användarens säkerhetsnivå
            const isArchived = virus.objectStatus === 'archive';
            const userLevel = request.session.securityAccessLevel;
            
            // om objektet är arkiverat och användaren inte är nivå A, visa åtkomst nekadmeddelande
            if (isArchived && userLevel !== 'A') {
                response.write('<p>Access Denied. This research object is archived and can only be viewed by Level A administrators.</p>');
                response.write(htmlInfoStop);
                response.write(htmlFooter);
                response.write(htmlBottom);
                response.end();
                return;
            }
            
            // Visa virusets namn och nummer med en statusbadge som indikerar om det är arkiverat eller inte
            const statusBadge = virus.objectStatus === 'archive' ? 
                '<span class="status-badge status-archived">ARCHIVED</span>' : 
                '<span class="status-badge status-active">ACTIVE</span>';
            
            response.write('<div class="virus-details-container">');
            response.write('<div class="virus-header">');
            response.write('<h2 class="virus-title">' + virus.objectNumber + ' ' + virus.objectName + ' ' + statusBadge + '</h2>');
            response.write('</div>');
            
            response.write('<div class="virus-metadata"><div class="virus-metadata-line">Created ' + virus.objectCreatedDate + '</div><div class="virus-metadata-line">By ' + virus.objectCreator + '</div></div>');
            
            // Visar backup-statusmeddelande om det finns i sessionen
            if (request.session.backupStatus === 'success') {
                response.write('<div class="backup-status-success">✓ Virus is now backed up</div>');
                delete request.session.backupStatus;
            } else if (request.session.backupStatus === 'error') {
                response.write('<div class="backup-status-error">✗ Error backing up virus</div>');
                delete request.session.backupStatus;
            }
            
            // lägg till CSS för virusbilder
            response.write(htmlVirusimagesCSS);

            response.write('<div class="virus-description">');
            response.write(virus.objectText);
            response.write('</div>');

            if (request.session.securityAccessLevel === 'A' || request.session.securityAccessLevel === 'B') {
                response.write('<div class="action-buttons">');
                response.write('<button class="btn-primary" onclick="window.location.href=\'/api/virusdatabase/edit/' + id + '\'">✎ Edit Info</button>');
                response.write('<button class="btn-primary" onclick="window.location.href=\'/api/data/' + id + '\'">⬆ Upload Attachment</button>');
                
                // Visar Archive/Open-knapp endast för nivå A-användare
                if (request.session.securityAccessLevel === 'A') {
                    const toggleText = virus.objectStatus === 'archive' ? 'Open Object' : 'Archive Object';
                    response.write('<button class="btn-secondary" onclick="window.location.href=\'/api/virusdatabase/toggle/' + id + '\'">🔒 ' + toggleText + '</button>');
                }

                // Visar Backup-knapp för både nivå A och B
                response.write('<button class="btn-secondary" onclick="window.location.href=\'/api/virusdatabase/backup/' + id + '\'">💾 Backup</button>');
                
                response.write('</div>');
            }

            response.write('<table class="info-table">');
            
            const pdfPath = './data/safetydatasheets/' + virus.objectNumber + '.pdf';
            response.write('<tr><td>Security Data Sheet:</td><td>');
            if (fs.existsSync(pdfPath)) {
                response.write('<a href="/safetydatasheets/' + virus.objectNumber + '.pdf" target="_blank">' + virus.objectNumber + ' ' + virus.objectName + '.pdf</a>');
            } else {
                response.write('');
            }
            response.write('</td></tr>');

            response.write('<tr><td>Security Presentation Video:</td><td>');
            if (virus.presentationVideoLink) {
                response.write('<a href="' + virus.presentationVideoLink + '" target="_blank">' + virus.presentationVideoLink + '</a>');
            }
            response.write('</td></tr>');

            response.write('<tr><td>Security Handling Video:</td><td>');
            if (virus.securityVideoLink) {
                response.write('<a href="' + virus.securityVideoLink + '" target="_blank">' + virus.securityVideoLink + '</a>');
            }
            response.write('</td></tr>');

            response.write('</table>');

            // Lägg till sektion för forskningsinlägg
            if (request.session.securityAccessLevel === 'A' || request.session.securityAccessLevel === 'B') {
                response.write(htmlResearchEntries);

                // Attached Documents Section
                let attachments = [];
                try {
                    const files = fs.readdirSync('./data/' + id + '/attachments/');
                    for (const file of files) {
                        const stat = fs.statSync('./data/' + id + '/attachments/' + file);
                        attachments.push({
                            name: file,
                            size: (stat.size / 1024).toFixed(0) + ' KB',
                            date: stat.mtime.toLocaleDateString('en-GB').replace(/\//g, '.') // DD.MM.YYYY
                        });
                    }
                } catch (e) {
                    // ignore if directory doesn't exist or error
                }

                if (attachments.length > 0) {
                    response.write('<h2 class="research-section-title">Attached Documents</h2>');
                    response.write('<div class="attachments-list">');
                    for (const att of attachments) {
                        response.write(`
                            <div class="attachment-item">
                                <div class="attachment-info">
                                    <div class="attachment-name">${att.name}</div>
                                    <div class="attachment-meta">Size: ${att.size} | Uploaded: ${att.date}</div>
                                </div>
                                <div class="attachment-actions">
                                    <a href="/attachments/${id}/attachments/${att.name}" target="_blank">📄 View</a>
                                    <a href="/api/data/${id}">⬆ Add</a>
                                    <form method="POST" action="/api/data/${id}/delete-file" style="margin: 0; display: inline;">
                                        <input type="hidden" name="fileName" value="${att.name}">
                                        <a href="#" onclick="if(confirm('Delete this attachment?')) this.closest('form').submit(); return false;" class="delete-link">🗑 Delete</a>
                                    </form>
                                </div>
                            </div>
                        `);
                    }
                    response.write('</div>');
                }

                // Lägg till sektion för virusbilder (uppladdning och galleri) för auktoriserade användare
                response.write(getVirusImagesHTML(id));
            }

            response.write('</div>'); // Close virus-details-container
        } else {
            response.write('<p>Virus not found.</p>');
        }
    } catch (error) {
        console.log("Database Error: ", error);
        response.write('<p>Error loading virus data.</p>');
    }

    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();
});

module.exports = router;
