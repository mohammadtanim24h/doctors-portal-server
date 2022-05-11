const express = require("express");
const cors = require("cors");
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Doctors portal is helping people");
});

app.listen(port, () => {
    console.log('Listening to Doctors Portal on port', port);
})