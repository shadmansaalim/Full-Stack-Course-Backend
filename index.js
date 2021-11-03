//Imports
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
const ObjectId = require('mongodb').ObjectId;
const nodemailer = require("nodemailer");
var admin = require("firebase-admin");


const app = express();
const port = process.env.PORT || 5000;


//Firebase Admin Initialization
var serviceAccount = require("./react-course-app-88b8d-firebase-adminsdk-h4zlz-81684f38d1");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


//Middleware use for server course
app.use(cors());
app.use(express.json());


//MONGO DB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.up7gk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Function to verify user token so that API stays secure
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer')) {
        // Splitting the idToken by removing string "Bearer"
        const courseIdToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(courseIdToken);
            req.decodedUserEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}


async function run() {
    try {
        await client.connect();
        const database = client.db("courseApp");
        const coursesCollection = database.collection("courses");
        const orderCollection = database.collection("orders");

        //GET COURSES FROM DB
        app.get('/courses', async (req, res) => {
            const cursor = coursesCollection.find({});
            const page = req.query.page;
            const size = parseInt(req.query.size);
            const count = await cursor.count();
            let courses;
            if (page) {
                courses = await cursor.skip(page * size).limit(size).toArray();
            }
            else {
                courses = await cursor.toArray();
            }

            res.send({
                count,
                courses
            });
        })


        //GET SINGLE COURSE BY ID
        app.get('/course/:id', async (req, res) => {
            const id = req.params.id;
            const query1 = { _id: ObjectId(id) }
            const course = await coursesCollection.findOne(query1);
            const userEmail = req?.query?.email;
            let purchased = false;
            if (userEmail) {
                const query2 = { email: (userEmail) };
                const orderDetails = await orderCollection.find(query2).toArray();
                if (orderDetails.length) {
                    const keys = Object.keys(orderDetails[0].order)
                    for (const key of keys) {
                        if (key == course.courseID) {
                            purchased = true;
                        }
                    }
                }
            }
            res.json({
                course,
                purchased
            });
        })

        //USE POST to get data by keys
        app.post('/courses/byKeys', async (req, res) => {
            const keys = req.body;
            const query = { courseID: { $in: keys } };
            const courses = await coursesCollection.find(query).toArray();
            res.json(courses);
        })

        //Add Orders API
        app.post('/orders', async (req, res) => {
            const order = req.body;
            //Taking the keys of order course ID in an array
            const orderIds = (Object.keys(req.body.order));
            //Checking whether any previous order exists of same user
            const query = { email: (order.email) };
            const orderDetails = await orderCollection.find(query).toArray();
            let result;
            //If user exists with previous orders then Updating user's previous order details rather creating new one
            if (orderDetails.length) {
                for (const id of orderIds) {
                    (orderDetails[0].order)[id] = 1;
                }
                const filter = { _id: orderDetails[0]._id };
                const updateDoc = {
                    $set: {
                        order: orderDetails[0].order
                    },
                };
                result = await orderCollection.updateOne(filter, updateDoc);
            }
            //If user doesn't exists with orders then inserting new order
            else {
                result = await orderCollection.insertOne(order);
            }
            res.json(result);

        })

        app.get('/myClasses', verifyToken, async (req, res) => {
            const userEmail = req.query.email;
            if (req.decodedUserEmail === userEmail) {
                const query1 = { email: userEmail };
                //Using options to get only the order field making code efficient
                const options = {
                    projection: { _id: 0, order: 1 }
                }
                const cursor = orderCollection.find(query1, options);
                const orderDetails = await cursor.toArray();
                // Checking if user has any purchased course
                if (orderDetails.length) {
                    const keys = Object.keys(orderDetails[0].order)
                    const query2 = { courseID: { $in: keys } };
                    const courses = await coursesCollection.find(query2).toArray();
                    res.json(courses)
                }
                else {
                    res.json(0);
                }
            }
            else {
                //Sending status of unauthorization
                res.status(401).json({ message: 'User Not Authorized' })
            }
        })

        // app.post('/myClassesID')


    }
    finally {
        //   await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    console.log('Hitting backend');
    res.send('Course App Backend Coming Soon')
})

app.listen(port, () => {
    console.log('Listening to port number ', port);
})

