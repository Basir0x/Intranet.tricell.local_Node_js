
const ADODB = require('node-adodb');
const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');

async function fixVirusText() {
    try {
        // Get all research objects
        const results = await connection.query('SELECT ID, objectName, objectText FROM ResearchObjects');
        
        console.log(`Found ${results.length} research objects`);
        
        for (const obj of results) {
            const regex = /\([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]+\s+[a-z\s]+\?\)/g;
            const newText = obj.objectText.replace(regex, '');
            
            if (newText !== obj.objectText) {
                console.log(`Updating: ${obj.objectName}`);
                console.log(`  OLD: ${obj.objectText.substring(0, 100)}...`);
                console.log(`  NEW: ${newText.substring(0, 100)}...`);
                
                const escapedText = newText.replace(/'/g, "''");
                const updateSql = `UPDATE ResearchObjects SET objectText='${escapedText}' WHERE ID=${obj.ID}`;
                await connection.execute(updateSql);
            }
        }
        
        console.log('✓ Database update complete');
    } catch (error) {
        console.error('Error:', error);
    }
}

fixVirusText();
