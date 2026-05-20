const config = require('../config/globals.json');
const express = require('express');
const router = express.Router();

router.use(express.static('./public'));
const path = require('path');

const pug = require('pug');
const { response } = require('express');
const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');

// --------------------- Läs in Masterframen --------------------------------
const readHTML = require('../readHTML.js');
const fs = require('fs');
const { json } = require('express');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');

// ---------------------- Lista all personal, Metod 4: Databas -------------------------------
router.get('/', (request, response) =>
{    
    // Öppna databasen
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/personnelregistry.mdb;');

    async function sqlQuery()
    {
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(htmlHead);
        if(request.session.loggedin)
        {
            htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
            response.write(htmlLoggedinMenuCSS);
            htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
            response.write(htmlLoggedinMenuJS);
            //htmlLoggedinMenu = readHTML('./masterframe/loggedinmenu.html');
            //response.write(htmlLoggedinMenu);
            response.write(pug_loggedinmenu({
                employeecode: request.cookies.employeecode,
                name: request.cookies.name,
                logintimes: request.cookies.logintimes,
                lastlogin: request.cookies.lastlogin,
                securityaccesslevel: request.session.securityAccessLevel, // <--- Added here!
                webaddress : config.webaddress,
              }));
        }
        response.write(htmlHeader);
        response.write(htmlMenu);
        response.write(htmlInfoStart);

        // Skapa HTML-textsträng för tabellen för utskrift av XML-data
        let htmlOutput = "" +
            "<link rel=\"stylesheet\" href=\"css/personnel_registry.css\" />" +
            "<div class=\"page-header\">" +
            "<h2>Personnel Registry</h2>";

        if (request.session.loggedin) {
            htmlOutput += "<a href=\"/api/newemployee\" class=\"action-btn\">➕ Add new employee</a>";
        }

        htmlOutput += "</div>";

        htmlOutput += "<div id=\"table-resp\">" +
            "<div id=\"table-header\">\n" +
            "<div class=\"table-header-cell-light\">Employee Code</div>\n" +
            "<div class=\"table-header-cell-dark\">Name</div>\n" +
            "<div class=\"table-header-cell-light\">Signature Date</div>\n" +
            "<div class=\"table-header-cell-light\">Rank</div>\n" +
            "<div class=\"table-header-cell-light\">Access Level</div>\n";

        if (request.session.loggedin) {
            htmlOutput += "<div class=\"table-header-cell-light\">Edit</div>\n" +
                "<div class=\"table-header-cell-light\">Delete</div>\n";
        }

        htmlOutput += "</div>\n\n" +
            "<div id=\"table-body\">\n";

        // Skicka SQL-query till databasen och läs in variabler
        const result = await connection.query('SELECT id, employeeCode, name, signatureDate, rank, securityAccessLevel FROM employee');
            
        // Ta reda på antalet employees
        var count =  result.length;

        // Loopa genom och skriv ut varje person
        let i;
        for(i=0; i<count; i++)
        {   
            str_id = result[i]['id'];      
            str_employeeCode = result[i]['employeeCode'];
            str_name = result[i]['name'];
            str_rank = result[i]['rank'];
            str_securityAccessLevel = result[i]['securityAccessLevel'];
            str_signatureDate = result[i]['signatureDate'];
                         
            // Lägg till respektive employee till utskrift-variabeln
            htmlOutput += "<div class=\"resp-table-row\">\n";
            htmlOutput += "<div class=\"table-body-cell\" data-label=\"Employee Code\"><span>" + str_employeeCode + "</span></div>\n";
            htmlOutput += "<div class=\"table-body-cell-bigger\" data-label=\"Name\"><span><a href=\"/api/personnelregistry/" + str_employeeCode + "\">" + str_name + "</a></span></div>\n";
            htmlOutput += "<div class=\"table-body-cell\" data-label=\"Signature Date\"><span>" + str_signatureDate + "</span></div>\n";
            htmlOutput += "<div class=\"table-body-cell\" data-label=\"Rank\"><span>" + str_rank + "</span></div>\n";
            htmlOutput += "<div class=\"table-body-cell\" data-label=\"Access Level\"><span>" + str_securityAccessLevel + "</span></div>\n";
            if(request.session.loggedin)
            {
                htmlOutput += "<div class=\"table-body-cell\" data-label=\"Edit\"><span><a href=\"/api/editemployee/" + str_id + "\" class=\"action-link\">E</a></span></div>\n";
                htmlOutput += "<div class=\"table-body-cell\" data-label=\"Delete\"><span><a href=\"/api/deleteemployee/" + str_id + "\" class=\"action-link\">D</a></span></div>\n";
            }
            htmlOutput += "</div>\n";
        }  

        htmlOutput += "</div></div>\n\n";
        response.write(htmlOutput); // Skriv ut XML-datat

        response.write(htmlInfoStop);
        response.write(htmlFooter);
        response.write(htmlBottom);
        response.end();
    }
    sqlQuery();
});


// --------------------- Läs en specifik person -----------------------------
router.get('/:employeeid', function(request, response)
{
    var employeeid = request.params.employeeid;
    
    // Öppna databasen
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/personnelregistry.mdb;');

    async function sqlQuery()
    {
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(htmlHead);
        if(request.session.loggedin)
        {
            htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
            response.write(htmlLoggedinMenuCSS);
            htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
            response.write(htmlLoggedinMenuJS);
            //htmlLoggedinMenu = readHTML('./masterframe/loggedinmenu.html');
            //response.write(htmlLoggedinMenu);
            response.write(pug_loggedinmenu({
                employeecode: request.cookies.employeecode,
                name: request.cookies.name,
                logintimes: request.cookies.logintimes,
                lastlogin: request.cookies.lastlogin,
                securityaccesslevel: request.session.securityAccessLevel,
                webaddress : config.webaddress,
              }));
        }
        response.write(htmlHeader);
        response.write(htmlMenu);
        response.write(htmlInfoStart);

        // Skicka SQL-query till databasen och läs in variabler
        const result = await connection.query("SELECT employeeCode, name, signatureDate, rank, securityAccessLevel, dateOfBirth, sex, bloodType, height, weight, department, background, strengths, weaknesses FROM employee WHERE employeeCode='"+employeeid+"'");
        str_employeeCode = result[0]['employeeCode'];
        str_name = result[0]['name'];
        str_rank = result[0]['rank'];
        str_securityAccessLevel = result[0]['securityAccessLevel'];
        str_signatureDate = result[0]['signatureDate'];
        str_dateOfBirth = result[0]['dateOfBirth'];
        str_sex = result[0]['sex'];
        str_bloodType = result[0]['bloodType'];
        str_height = result[0]['height'];
        str_weight = result[0]['weight'];
        str_department = result[0]['department'];
        str_background = result[0]['background'];
        str_strengths = result[0]['strengths'];
        str_weaknesses = result[0]['weaknesses'];

         // Skapa HTML-textsträng för profilsidan
        let htmlOutput = "" +
            "<link rel=\"stylesheet\" href=\"css/personnel_registry_employee.css\" />" +
            "<div class=\"profile-page\">" +
            "<div class=\"profile-header\">" +
            "<h2>Personnel Profile - " + str_name + "</h2>" +
            "<a href=\"/api/personnelregistry\" class=\"action-btn\">← Back to Registry</a>" +
            "</div>" +
            "<div class=\"profile-grid\">" +
            "<div class=\"profile-card\">" +
            "<img class=\"profile-photo\" src=\"photos/" + str_employeeCode + ".jpg\" alt=\"" + str_name + "\" />" +
            "<div class=\"profile-meta\">" +
            "<div class=\"profile-meta-item\"><span>Employee Code</span>" + str_employeeCode + "</div>" +
            "<div class=\"profile-meta-item\"><span>Security Level</span>" + str_securityAccessLevel + "</div>" +
            "<div class=\"profile-meta-item\"><span>Signature Date</span>" + str_signatureDate + "</div>" +
            "</div>" +
            "</div>" +
            "<div class=\"profile-card\">" +
            "<div class=\"detail-row\">" +
            "<div class=\"detail-block\"><h3>Name</h3><div class=\"detail-value\">" + str_name + "</div></div>" +
            "<div class=\"detail-block\"><h3>Rank</h3><div class=\"detail-value\">" + str_rank + "</div></div>" +
            "</div>" +
            "<div class=\"detail-row\">" +
            "<div class=\"detail-block\"><h3>Date of Birth</h3><div class=\"detail-value\">" + str_dateOfBirth + "</div></div>" +
            "<div class=\"detail-block\"><h3>Sex</h3><div class=\"detail-value\">" + str_sex + "</div></div>" +
            "</div>" +
            "<div class=\"detail-row\">" +
            "<div class=\"detail-block\"><h3>Blood Type</h3><div class=\"detail-value\">" + str_bloodType + "</div></div>" +
            "<div class=\"detail-block\"><h3>Height</h3><div class=\"detail-value\">" + str_height + "</div></div>" +
            "</div>" +
            "<div class=\"detail-row\">" +
            "<div class=\"detail-block\"><h3>Weight</h3><div class=\"detail-value\">" + str_weight + "</div></div>" +
            "<div class=\"detail-block\"><h3>Department</h3><div class=\"detail-value\">" + str_department + "</div></div>" +
            "</div>" +
            "</div>" +
            "</div>" +
            "<div class=\"profile-card profile-section\">" +
            "<div class=\"profile-section\"><h3>Background</h3><p>" + (str_background || 'No background data available.') + "</p></div>" +
            "<div class=\"profile-section\"><h3>Strengths</h3><p>" + (str_strengths || 'No strengths listed.') + "</p></div>" +
            "<div class=\"profile-section\"><h3>Weaknesses</h3><p>" + (str_weaknesses || 'No weaknesses listed.') + "</p></div>" +
            "</div>" +
            "</div>";

        response.write(htmlOutput); // Skriv ut 

        response.write(htmlInfoStop);
        response.write(htmlFooter);
        response.write(htmlBottom);
        response.end();
    }
    sqlQuery();
});

module.exports = router;
