const fs = require('fs');
const path = require('path');

function processBlock(template, startMarker, endMarker, keep) {
    let result = '';
    let index = 0;

    while (true) {
        const start = template.indexOf(startMarker, index);
        if (start === -1) {
            result += template.slice(index);
            break;
        }

        result += template.slice(index, start);
        const end = template.indexOf(endMarker, start);
        if (end === -1) {
            result += template.slice(start);
            break;
        }

        const innerContent = template.slice(start + startMarker.length, end);
        if (keep) {
            result += innerContent;
        }

        index = end + endMarker.length;
    }

    return result;
}

function renderLoggedinMenu(vars) {
    const filePath = path.join(__dirname, 'masterframe', 'loggedinmenu.html');
    let tpl = fs.readFileSync(filePath, 'utf8');
    if (!vars) return tpl;

    Object.keys(vars).forEach(key => {
        const re = new RegExp('#\{' + key + '\}', 'g');
        tpl = tpl.replace(re, String(vars[key] === undefined || vars[key] === null ? '' : vars[key]));
    });

    const accessLevel = String(vars.securityaccesslevel || '').toUpperCase();
    const showAdminOrAbove = accessLevel === 'A' || accessLevel === 'B';
    const showAdminOnly = accessLevel === 'A';

    tpl = processBlock(tpl, '<!-- IF_ADMIN_OR_ABOVE -->', '<!-- END_IF_ADMIN_OR_ABOVE -->', showAdminOrAbove);
    tpl = processBlock(tpl, '<!-- IF_ADMIN_ONLY -->', '<!-- END_IF_ADMIN_ONLY -->', showAdminOnly);

    return tpl;
}

module.exports = renderLoggedinMenu;
