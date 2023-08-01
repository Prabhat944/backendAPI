import express from 'express';
import cookieParser from 'cookie-parser';
import userRouter from './routes/user.js';

export const app = express();


// app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use(express.json());
app.use(userRouter);

