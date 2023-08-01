import { app } from "./app.js"
import connectMongo from "./database/database.js";
import {config} from 'dotenv';

config({path:'./database/config.env'})
connectMongo();

app.listen(process.env.PORT,()=>{
    console.log(`server is running on ${process.env.PORT}`)
})