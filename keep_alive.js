const express = require('express');

const app = express();

app.get('/', (req, res) => {
    res.send('VM Obfuscator Active');
});

function keepAlive() {
    app.listen(8080, () => {});
}

module.exports = keepAlive;
