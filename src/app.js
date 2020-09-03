const express = require("express")
const mongoose = require("mongoose")
const bodyParser = require("body-parser")
const { promisify } = require("util")
const { trace } = require("console")
const todos = require("./models/todos")
const { get } = require("http")

const redisClient = require("redis").createClient
const redis = redisClient({
    host: "redis"
})
const getAsync = promisify(redis.get).bind(redis)

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

mongoose.connect("mongodb://my-mongodb/todos")

const db = mongoose.connection
db.on("error", console.error.bind(console, "connection error: "))
db.once("open", () => {
    console.log("Connected MongoDB")
})

redis.on("error", err => {
    console.error("Redis Error" + err)
})

// routes

app.post("/todo", async (req, res) => {
    try {
        // [1]
        if (!req.body) {
            res.status(400).json({
                success: false,
                message: "Please send the todo body"
            })
        }

        // [2]
        try {
            let todo = new todos(req.body)
            await todo.save()

            res.status(200).json({
                success: true,
                data: todo
            })
        } catch (e) {
            throw "Unable to insert new document"
        }
    } catch (e) {
        console.error("Unable to add new todo", e)
        res.status(400).json({
            success: false,
            message: "Unable to add new todo"
        })
    }
})

app.get("/todo/:title", async (req, res) => {
    try {
        const title = req.params.title

        if (!title) {
            res.status(400).json({
                success: false,
                message: "Invalid param"
            })
        }

        // find from cache
        let getTitleDataFromCache = await getAsync(title)

        if (!getTitleDataFromCache) {
            let result = await todos.findOne({ title: title })

            if (!result) {
                throw 'Not found todo'
            }

            // set to cacahe
            await redis.set(title, JSON.stringify(result))

            res.status(200).json({
                success: true,
                source: "mongodb",
                data: result
            })
        }

        res.status(200).json({
            success: true,
            source: "redis",
            data: JSON.parse(getTitleDataFromCache)
        })
    } catch (e) {
        console.error("Unable to get todo by title", e)
        res.status(400).json({
            SUCCESS: false,
            message: e
        })
    }
})

app.listen(8080, () => {
    console.log("Listening on port 8080")
})