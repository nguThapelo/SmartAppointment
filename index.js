const express = require("express");
const exphbs = require('express-handlebars');
const app = express();

const bodyParser = require('body-parser');


app.engine('handlebars', exphbs.engine({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

app.use(express.static('public'));

const appointments = [];

app.get('/', function(req, res) {
    res.render("Home")
});

app.get('/Patient', function(req, res) {
    res.render("Patient")
});

app.get('/Doctor', function(req, res) {
    res.render("Doctor", { appointments })
});

app.post('/queries', function(req, res) {
    const queries = req.body.queries
    appointments.push(queries)
    
    // console.log(queries)
    res.redirect('patient')
});

const PORT = process.env.PORT || 3018

app.listen(PORT, function () {
console.log(`App Running at port: ${PORT}`)
});