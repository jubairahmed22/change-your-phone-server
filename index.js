const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;


const app = express();

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q0x3ff9.mongodb.net/?retryWrites=true&w=majority`;
function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}



const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const appointmentOptionCollections = client.db('change-your-phone').collection('cetagores');

        const cetagoryDetails = client.db('change-your-phone').collection('details');
        const sellerCetagoryDetails = client.db('change-your-phone').collection('sellersCategory');

        const buyCollection = client.db('change-your-phone').collection('buyItms');
        const usersCollection = client.db('change-your-phone').collection('users');
        const paymentsCollection = client.db('change-your-phone').collection('payments');

        // var url = "http://localhost:5000/service";


        /////////PAYMENT///////////////
        app.get('/allbuyers/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await buyCollection.findOne(query);
            res.send(result);
        })

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await buyCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })



        app.get('/cetagory', async (req, res) => {
            const query = {};
            const options = await appointmentOptionCollections.find(query).toArray();
            res.send(options);
        })

        app.get('/service', async (req, res) => {
            const query = {};
            const options = await cetagoryDetails.find(query).toArray();
            res.send(options);
        })
        app.get('/service/:id', async (req, res) => {
            const id = req.params.id;
            const query = { brand: id };
            const result = await cetagoryDetails.find(query).toArray();
            res.send(result);
            //Bookings
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const query = { email: email };
            const bookings = await buyCollection.find(query).toArray();
            res.send(bookings);
        })


        app.post('/bookings', async (req, res) => {
            const booking = req.body
            console.log(booking);
            const result = await buyCollection.insertOne(booking);
            res.send(result);
        });


        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '24hr' })
                return res.send({ accessToken: token });
            }
            console.log(user);
            res.status(403).send({ accessToken: '' })
        })

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.get('/chooseCategory', async (req, res) => {
            const query = {}
            const result = await appointmentOptionCollections.find(query).project({ brand: 1 }).toArray();
            res.send(result);
        })
        app.post('/service', async (req, res) => {
            const doctor = req.body;
            const result = await cetagoryDetails.insertOne(doctor);
            res.send(result);
        })

        /////////////sellers////////////////
        app.post('/sellerscategory', async (req, res) => {
            const doctor = req.body;
            const resul = await sellerCetagoryDetails.insertOne(doctor);
            res.send(result);
        })

        app.get('/allsellers', async (req, res) => {
            const query = {};
            const options = await sellerCetagoryDetails.find(query).toArray();
            res.send(options);
        })
        // app.get('/sellers', async (req, res) => {
        //     const query = {}
        //     const result = await sellerCetagoryDetails.find(query).toArray();
        //     res.send(result);
        // })

        app.get('/sellers', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const bookings = await cetagoryDetails.find(query).toArray();
            res.send(bookings)
        });

        /////////Delete////////////

        // app.delete('/sellers/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) };
        //     const result = await sellerCetagoryDetails.deleteOne(filter);
        //     res.send(result);
        // })
        app.delete('/sellers/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await cetagoryDetails.deleteOne(filter);
            res.send(result);
        })

        ///////////myOrders delete///////

        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await buyCollection.deleteOne(filter);
            res.send(result);
        })
        ///////////Admin User Delete/////////
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        //////////////All buyers/////////
        app.get('/allbuyers', async (req, res) => {
            const query = {};
            const users = await buyCollection.find(query).toArray();
            res.send(users);
        })
        ///////////////ALL BUYERS DELETE///////
        app.delete('/allbuy/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await buyCollection.deleteOne(filter);
            res.send(result);
        })

        ///////////ALL SELLERS DELETE////
        app.delete('/allsellers/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await sellerCetagoryDetails.deleteOne(filter);
            res.send(result);
        });




    }
    finally {

    }
}

run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('change you phone server is running');
})

app.listen(port, () => console.log(`change you phone server running ${port} `))