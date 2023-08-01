import mongoose from "mongoose";

const connectMongo = () =>{
    mongoose
  .connect(process.env.MONGO_URI, {
    dbName: "backendApi",
  })
  .then(() => console.log("mongoDb connected successfully"))
  .catch((err) =>
    console.log("Something went wrong in mongoDb connection", err)
  );
}

export default connectMongo;