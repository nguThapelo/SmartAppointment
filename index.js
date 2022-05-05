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
const feedbacks = [];

app.get('/', (req, res) => {
    res.render("Home")
});

app.get('/Patient', (req, res) => {
    res.render("Patient", { feedbacks })
});

app.get('/Doctor', (req, res) => {
    res.render("Doctor", { appointments })
});

app.post('/queries', (req, res) => {
    const queries = req.body.queries
    appointments.push(queries)
    // console.log(queries)
    res.redirect('patient')
});

app.post('/feedback', (req, res) => {
    const feedback = req.body.feedback
    feedbacks.push(feedback)
    // console.log(queries)
    res.redirect('Doctor')
});

const PORT = process.env.PORT || 3018

app.listen(PORT, () =>  {
console.log(`App Running at port: ${PORT}`)
});