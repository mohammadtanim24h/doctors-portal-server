const express = require("express");
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const cors = require("cors");
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.51ygh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: "UnAuthorized Access"})
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
        if(err) {
            return res.status(403).send({message: "Forbidden Access"});
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctorsPortal").collection("services");
        const bookingCollection = client.db("doctorsPortal").collection("bookings");
        const userCollection = client.db("doctorsPortal").collection("users");

        // Get all services
        app.get("/services", async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        app.put("/user/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email};
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            // signing token
            const token = jwt.sign({email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
            res.send({result, token});
        })

        // This is not the perfect way to query. After learning more about mongodb use aggregate, lookup, pipeline, group, mathc
        // Get Available appointments
        app.get("/available", async (req, res) => {
            const date = req.query.date;

            // step 1: get all services
            const services = await serviceCollection.find({}).toArray();

            // step 2 : get the bookings of that day
            const query = {date: date};
            const bookings = await bookingCollection.find(query).toArray();
            

            // step 3: for each service
            services.forEach(service => {
                // step 4:  find bookings for that service | output : [{obj}, {obj}, {obj}, {obj}, {obj}....]
                // prottekta service nibo and oi service er jonno ki ki bookings ase oigula niye ashbo. kuno ekta service er booking thakteo pare nao thakte pare.
                const serviceBookings = bookings.filter(booking => booking.treatment === service.name);
                
                // step 5 : select booked slots of the service | output : ['', '', '', '',]
                const bookedSlots = serviceBookings.map(booking => booking.slot);
                // step 6 : select those slots that are not in booked slots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                // step 7 : replace all slots with available slots
                service.slots = available;
            });

            // ekhane services gula change hocche kibhabe? foreach kibhabe modify kortese service gulake?
            res.send(services);
        })


        /**
         * API Naming Convention
         * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
         * app.get('/booking/:id') // get a specific booking 
         * app.post('/booking') // add a new booking
         * app.patch('/booking/:id) // update a single booking
         * app.put('/booking/:id) // upsert => update(if exists) / insert (if doesn't exist)
         * app.delete('/booking/:id) // delete a booking
        */
       
        // Get bookings for specific email
        app.get("/booking", verifyJWT, async (req, res) => {
            const patientEmail = req.query.email;
            const decodedEmail = req.decoded.email;
            if(patientEmail === decodedEmail){
                const query = {patientEmail};
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({message: "Forbidden Access"});
            }
        })

        // Create a booking
        app.post("/booking", async (req, res) => {
            const booking = req.body;
            // check kora hocche je ekta particular din er moddhe ekjon user je treatment book korte chaitase oi treatment oi user er jonno oi din er moddhe already booked ase kina. already booked thakle ar book korte dibo na.
            const query = {treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail};
            console.log(query);
            const exists = await bookingCollection.findOne(query);
            if(exists){
                return res.send({success: false, booking: exists});
            }
            // jodi already book kora na thake tahole book korte dibo.
            const result = await bookingCollection.insertOne(booking);
            return res.send({success: true, result});
        })

    }
    finally {

    }
}

run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Doctors portal is helping people");
});

app.listen(port, () => {
    console.log('Listening to Doctors Portal on port', port);
})