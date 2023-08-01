import { User } from "../models/user.js";
import jwt from 'jsonwebtoken';

export const getAllUserList = async(req,res)=>{
    console.log(req.body)
    const users = await User.find({});
    res.json({
        success:true,
        users
    })
}

export const registerUser = async(req,res)=>{
    const {name,email,password} = req.body;

    const token = await jwt.sign(password,"lkjhgfdsadfghjk");

    const user = await User.create({
        name,
        email,
        token
    })
    res.json({
        success:true,
        message:'user created successfully',
        user
    })
};

export const specialFunc = (req,res)=>{
    res.json({
        success:true
    })
}

export const createUserById = async(req,res)=>{
    const {name} = req.query;
    const {email} = req.params;
    const {password} = req.body;

    const user = await User.create({name, email,password})

    res.status(201).cookie("token","lolo").json({
        success:true,
        message:'success',
        user
    })
}

export const getUserById = async(req,res)=>{
    const {id} = req.params;
    const user = await User.find({_id:id})

    res.status(201).cookie("token","lolo").json({
        success:true,
        message:'success',
        user
    })
}

export const updateUserById = async(req,res)=>{
    const {id} = req.params;
    const {name,email,password} = req.body;
    const user = await User.findByIdAndUpdate(id,{name,email,password},{new:true})

    res.status(201).cookie("token","lolo").json({
        success:true,
        message:'successfully updated',
        user
    })
}

export const deleteUserById = async(req,res)=>{
    const {id} = req.params;
    const user = await User.deleteOne({_id:id});

    res.status(201).cookie("token","lolo").json({
        success:true,
        message:'successfully deleted',
        user
    })
}