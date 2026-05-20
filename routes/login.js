const config = require('../config/globals.json');
const express = require('express');
const router = express.Router();

var cookieParser = require('cookie-parser');
router.use(cookieParser());

router.use(express.static('./public'));
const path = require('path');

const pug = require('pug');
const { response } = require('express');
const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');

// --------------------- Läs in Masterframen --------------------------------------------------
const readHTML = require('../readHTML.js');
const fs = require('fs');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');


// --------------------- Router -----------------------------------------------
router.get('/', function(request, response)
{
    // Ta emot formulär-variablerna
    const employeeid = request.query.femployeecode;
    const passwd = request.query.fpassword;
    
    // Validera input
    if (!employeeid || !passwd) {
        return response.redirect('/api/login/error?msg=missing');
    }
    
    // Öppna databasen och kolla uppgifterna
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/personnelregistry.mdb;');
    
    async function sqlQuery1()
    {
        try {
            const result = await connection.query("SELECT passwd, logintimes, lastlogin, lockout FROM users WHERE employeeCode='"+employeeid+"'");        
            if(!result || result.length === 0)
            {
                return response.redirect('/api/login/error?msg=user_not_found'); 
            }
            
            // Läs in variabler
            const str_passwd = result[0]['passwd'];
            const str_logintimes= result[0]['logintimes'];    
            const str_lastlogin= result[0]['lastlogin'];    
            const str_lockout= result[0]['lockout'];    

            // Öppna employee-tabellen, och ta reda på användarens namn och security access level
            async function sqlQuery2()
            {
                try {
                    const result2 = await connection.query("SELECT * FROM employee WHERE employeeCode='"+employeeid+"'");
                    if(!result2 || result2.length === 0) {
                        return response.redirect('/api/login/error?msg=employee_not_found');
                    }
                    
                    const str_name = result2[0]['name'];
                    const str_securtyaccesslevel= result2[0]['securityAccessLevel'];    
                                  
                    if(str_lockout == null || str_lockout === "")
                    {
                        if(str_passwd == passwd)    
                        {
                            // Uppdatera user-variabler
                            const int_logintimes = parseInt(str_logintimes)+1;
                            let ts = Date.now();
                            let date_ob = new Date(ts);
                            let date = date_ob.getDate();
                            let month = date_ob.getMonth() + 1;
                            let year = date_ob.getFullYear();
                            const str_newlogin = date+"."+month+"."+year;

                            // Set cookies
                            response.cookie("employeecode", employeeid);
                            response.cookie("name", str_name);
                            response.cookie("lastlogin", str_newlogin);
                            response.cookie("logintimes", int_logintimes);

                            //Starta sessions
                            request.session.loggedin = true;
                            request.session.username = employeeid;
                            request.session.securityAccessLevel = str_securtyaccesslevel;

                            // Uppdatera databasen
                            try {
                                await connection.execute("UPDATE users SET logintimes='"+int_logintimes+"', lastlogin='"+str_newlogin+"' WHERE employeeCode='"+employeeid+"'");
                            } catch(e) {
                                console.error("Update error:", e.message);
                            }

                            return response.redirect('/api/login/success'); 
                        }
                        else
                        {
                            return response.redirect('/api/login/error?msg=invalid_password'); 
                        }
                    }
                    else
                    {
                        return response.redirect('/api/login/error?msg=locked_out'); 
                    }    
                } catch(e) {
                    console.error("Query2 error:", e.message);
                    return response.redirect('/api/login/error?msg=db_error');
                }
            }
            await sqlQuery2();
        } catch(e) {
            console.error("Query1 error:", e.message);
            return response.redirect('/api/login/error?msg=db_error');
        }
    }   
    sqlQuery1();
    
});


// --------------------- Success Route -----------------------------------------------
router.get('/success', function(request, response)
{
    response.setHeader('Content-type','text/html');
    response.write(htmlHead);
    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);

    if(request.session.loggedin)
    {
        response.write("<h2>Login Successful!</h2>");
        response.write("<p>Welcome, " + request.cookies.name + "</p>");
        response.write("<p>Employee Code: " + request.cookies.employeecode + "</p>");
        response.write("<p>You will be redirected shortly...</p>");
        response.write("<script>setTimeout(()=>{ window.location='/' }, 2000);</script>");
        
        htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
        response.write(htmlLoggedinMenuCSS);
        htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
        response.write(htmlLoggedinMenuJS);
        
        response.write(pug_loggedinmenu({
            employeecode: request.cookies.employeecode,
            name: request.cookies.name,
            logintimes: request.cookies.logintimes,
            lastlogin: request.cookies.lastlogin,
            securityaccesslevel: request.session.securityAccessLevel,
            webaddress : config.webaddress,
          }));
    }
    else
    {
        response.write("<h2>Not Logged In</h2>");
        response.write("<p>Session not found. Please <a href='/'>try logging in again</a>.</p>");
    }

    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();
});

// --------------------- Error Route -----------------------------------------------
router.get('/error', function(request, response)
{
    const msg = request.query.msg || 'unknown_error';
    const messages = {
        'missing': 'Please provide both employee code and password.',
        'user_not_found': 'Employee code not found in the system.',
        'employee_not_found': 'Employee record not found.',
        'invalid_password': 'Invalid password. Please try again.',
        'locked_out': 'This account is locked out.',
        'db_error': 'Database error. Please try again later.',
        'unknown_error': 'An unknown error occurred.'
    };
    
    response.setHeader('Content-type','text/html');
    response.write(htmlHead);
    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);
    response.write("<h2>Login Failed</h2>");
    response.write("<p style='color:red;'>" + (messages[msg] || messages['unknown_error']) + "</p>");
    response.write("<p><a href='/'>Return to Home</a></p>");
    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();   
});


module.exports = router;
